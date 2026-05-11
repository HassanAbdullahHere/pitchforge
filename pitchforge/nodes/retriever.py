import os
import json
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import numpy as np
import chromadb
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from rank_bm25 import BM25Okapi
from flashrank import Ranker, RerankRequest

from pitchforge.state import PitchforgeState

_CHROMA_PATH = str(Path(__file__).parent.parent / "chromadb")
_CORPUS_PATH = Path(__file__).parent.parent / "chromadb" / "bm25_corpus.json"

embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2-preview",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

_client = None
_collection = None
_bm25 = None
_corpus_texts = None
_corpus_ids = None
_reranker = None

_N_CANDIDATES = 6
_N_FINAL = 4


def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=_CHROMA_PATH)
        _collection = _client.get_collection("freelancer_profile")
    return _collection


def _get_bm25():
    global _bm25, _corpus_texts, _corpus_ids
    if _bm25 is None:
        corpus = json.loads(_CORPUS_PATH.read_text())
        _corpus_ids = [c["id"] for c in corpus]
        _corpus_texts = [c["text"] for c in corpus]
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
    Node 2 — Hybrid RAG retrieval: BM25 + vector search, RRF fusion, FlashRank re-ranking.

    Reads:  state["job_analysis"]
    Writes: state["profile_matches"]
    """
    print("\n[Node 2] Hybrid retrieval: BM25 + vector + re-ranking...")

    job = state["job_analysis"]
    query = (
        f"Required skills: {', '.join(job.get('skills_required', []))}. "
        f"Project scope: {job.get('scope', '')}. "
        f"Experience level: {job.get('experience_level', '')}."
    )

    # 1. BM25 keyword retrieval
    bm25 = _get_bm25()
    bm25_scores = bm25.get_scores(query.lower().split())
    bm25_ids = [_corpus_ids[i] for i in np.argsort(bm25_scores)[::-1][:_N_CANDIDATES]]
    print(f"  BM25 top IDs: {bm25_ids}")

    # 2. ChromaDB vector retrieval
    collection = _get_collection()
    vec_results = collection.query(
        query_embeddings=[embeddings.embed_query(query)],
        n_results=min(_N_CANDIDATES, collection.count()),
        include=["documents"]
    )
    vec_ids = vec_results["ids"][0]
    print(f"  Vector top IDs: {vec_ids}")

    # 3. RRF fusion
    fused_ids = _rrf_fuse([bm25_ids, vec_ids])
    print(f"  RRF fused order: {fused_ids}")

    # Build id→text map (BM25 corpus as base, ChromaDB docs override)
    id_to_text = dict(zip(_corpus_ids, _corpus_texts))
    id_to_text.update(zip(vec_results["ids"][0], vec_results["documents"][0]))
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
