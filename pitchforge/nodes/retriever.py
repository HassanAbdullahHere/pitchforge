import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

import asyncpg
import numpy as np
from pgvector.asyncpg import register_vector
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from rank_bm25 import BM25Okapi
from flashrank import Ranker, RerankRequest

from pitchforge.state import PitchforgeState

embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2-preview",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

# Lazy-loaded globals
_pool: asyncpg.Pool | None = None
# Per-user BM25 cache: user_id → (bm25_instance, corpus_ids, corpus_texts)
_bm25_cache: dict[str, tuple] = {}
_reranker = None

_N_CANDIDATES = 6
_N_FINAL = 4


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            os.environ["DATABASE_URL_SYNC"],
            init=register_vector,  # registers vector codec on every new connection
        )
    return _pool


async def _load_corpus(user_id: str) -> tuple:
    """Load BM25 corpus from DB for a specific user, cache by user_id."""
    if user_id not in _bm25_cache:
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT chunk_key, text FROM profile_chunks WHERE user_id = $1 ORDER BY chunk_key",
                uuid.UUID(user_id),
            )
        corpus_ids = [row["chunk_key"] for row in rows]
        corpus_texts = [row["text"] for row in rows]
        bm25 = BM25Okapi([t.lower().split() for t in corpus_texts])
        _bm25_cache[user_id] = (bm25, corpus_ids, corpus_texts)
    return _bm25_cache[user_id]


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


async def retrieve_profile(state: PitchforgeState) -> dict:
    """
    Node 2 — Hybrid RAG retrieval: BM25 + pgvector search, RRF fusion, FlashRank re-ranking.

    Reads:  state["job_analysis"], state["user_id"]
    Writes: state["profile_matches"]
    """
    print("\n[Node 2] Hybrid retrieval: BM25 + pgvector + re-ranking...")

    user_id: str = state["user_id"]
    job = state["job_analysis"]
    query = (
        f"Required skills: {', '.join(job.get('skills_required', []))}. "
        f"Project scope: {job.get('scope', '')}. "
        f"Experience level: {job.get('experience_level', '')}."
    )

    # 1. BM25 keyword retrieval (corpus loaded from DB per user, cached)
    bm25, corpus_ids, corpus_texts = await _load_corpus(user_id)
    bm25_scores = bm25.get_scores(query.lower().split())
    bm25_ids = [corpus_ids[i] for i in np.argsort(bm25_scores)[::-1][:_N_CANDIDATES]]
    print(f"  BM25 top IDs: {bm25_ids}")

    # 2. pgvector cosine similarity search, filtered to this user's chunks
    # <=> is cosine distance — correct for Gemini's L2-normalized embeddings
    query_vector = np.array(embeddings.embed_query(query), dtype=np.float32)
    pool = await _get_pool()
    async with pool.acquire() as conn:
        vec_rows = await conn.fetch(
            "SELECT chunk_key, text FROM profile_chunks WHERE user_id = $1 ORDER BY embedding <=> $2 LIMIT $3",
            uuid.UUID(user_id),
            query_vector.tolist(),  # pgvector.asyncpg encodes list → vector after register_vector
            _N_CANDIDATES,
        )
    vec_ids = [row["chunk_key"] for row in vec_rows]
    vec_id_to_text = {row["chunk_key"]: row["text"] for row in vec_rows}
    print(f"  Vector top IDs: {vec_ids}")

    # 3. RRF fusion
    fused_ids = _rrf_fuse([bm25_ids, vec_ids])
    print(f"  RRF fused order: {fused_ids}")

    # Build id→text map (BM25 corpus as base, vector results override)
    id_to_text = dict(zip(corpus_ids, corpus_texts))
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
