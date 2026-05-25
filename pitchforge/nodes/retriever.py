import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import numpy as np
import psycopg2
from pgvector.psycopg2 import register_vector
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from rank_bm25 import BM25Okapi
from flashrank import Ranker, RerankRequest

from pitchforge.state import PitchforgeState

embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2-preview",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

# Lazy-loaded globals — DB connection replaces ChromaDB client/collection
_conn = None
_bm25 = None
_corpus_texts = None
_corpus_ids = None
_reranker = None

_N_CANDIDATES = 6
_N_FINAL = 4


def _get_conn():
    """Return a cached psycopg2 connection with pgvector type registered."""
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg2.connect(os.environ["DATABASE_URL"])
        register_vector(_conn)  # must be called on every new connection
    return _conn


def _get_bm25():
    """Load BM25 corpus from DB on first call, cache globally."""
    global _bm25, _corpus_texts, _corpus_ids
    if _bm25 is None:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id, text FROM profile_chunks ORDER BY id")
        rows = cur.fetchall()
        cur.close()
        _corpus_ids = [row[0] for row in rows]
        _corpus_texts = [row[1] for row in rows]
        _bm25 = BM25Okapi([t.lower().split() for t in _corpus_texts])
    return _bm25


def _get_reranker():
    global _reranker
    if _reranker is None:
        _reranker = Ranker()
    return _reranker


def _rrf_fuse(ranked_lists: list[list[str]], k: int = 60) -> list[str]:
    scores: dict[str, float] = {}
    for ranked in ranked_lists:
        for rank, doc_id in enumerate(ranked, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores, key=lambda d: scores[d], reverse=True)


def retrieve_profile(state: PitchforgeState) -> dict:
    """
    Node 2 — Hybrid RAG retrieval: BM25 + pgvector search, RRF fusion, FlashRank re-ranking.

    Reads:  state["job_analysis"]
    Writes: state["profile_matches"]
    """
    print("\n[Node 2] Hybrid retrieval: BM25 + pgvector + re-ranking...")

    job = state["job_analysis"]
    query = (
        f"Required skills: {', '.join(job.get('skills_required', []))}. "
        f"Project scope: {job.get('scope', '')}. "
        f"Experience level: {job.get('experience_level', '')}."
    )

    # 1. BM25 keyword retrieval (corpus loaded from DB on first call)
    bm25 = _get_bm25()
    bm25_scores = bm25.get_scores(query.lower().split())
    bm25_ids = [_corpus_ids[i] for i in np.argsort(bm25_scores)[::-1][:_N_CANDIDATES]]
    print(f"  BM25 top IDs: {bm25_ids}")

    # 2. pgvector cosine similarity search
    # <=> is cosine distance — correct for Gemini's L2-normalized embeddings
    query_vector = np.array(embeddings.embed_query(query), dtype=np.float32)
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, text FROM profile_chunks ORDER BY embedding <=> %s LIMIT %s",
        (query_vector, _N_CANDIDATES)
    )
    vec_rows = cur.fetchall()
    cur.close()
    vec_ids = [row[0] for row in vec_rows]
    vec_id_to_text = {row[0]: row[1] for row in vec_rows}
    print(f"  Vector top IDs: {vec_ids}")

    # 3. RRF fusion
    fused_ids = _rrf_fuse([bm25_ids, vec_ids])
    print(f"  RRF fused order: {fused_ids}")

    # Build id→text map (BM25 corpus as base, vector results override)
    id_to_text = dict(zip(_corpus_ids, _corpus_texts))
    id_to_text.update(vec_id_to_text)
    fused_passages = [id_to_text[i] for i in fused_ids if i in id_to_text]

    # 4. FlashRank cross-encoder re-ranking
    reranked = _get_reranker().rerank(
        RerankRequest(
            query=query,
            passages=[{"id": i, "text": p} for i, p in enumerate(fused_passages)]
        )
    )
    reranked_texts = [r["text"] if isinstance(r, dict) else r.text for r in reranked]

    # 5. Return top N
    profile_matches = reranked_texts[:_N_FINAL]

    print(f"[Node 2] Returning {len(profile_matches)} re-ranked chunks")
    for match in profile_matches:
        print(f"  > {match[:80]}...")

    return {"profile_matches": profile_matches}
