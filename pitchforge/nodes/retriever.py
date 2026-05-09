import os
from pathlib import Path
import chromadb
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pitchforge.state import PitchforgeState

_CHROMA_PATH = str(Path(__file__).parent.parent / "chromadb")

embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2-preview",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

_client = None
_collection = None

def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=_CHROMA_PATH)
        _collection = _client.get_collection("freelancer_profile")
    return _collection

def retrieve_profile(state: PitchforgeState) -> dict:
    """
    Node 2 — RAG retrieval.

    Reads: state["job_analysis"]
    Writes: state["profile_matches"]
    """
    print("\n[Node 2] Retrieving matching profile chunks...")


    job = state["job_analysis"]
    query = f"""
    Required skills: {', '.join(job.get('skills_required', []))}
    Project scope: {job.get('scope', '')}
    Experience level: {job.get('experience_level', '')}
    """

    # Convert query to vector
    query_vector = embeddings.embed_query(query)

    results = _get_collection().query(
        query_embeddings=[query_vector],
        n_results=4
    )

    # Extract the actual text chunks from results
    profile_matches = results["documents"][0]

    print(f"[Node 2] Found {len(profile_matches)} matching chunks")
    for match in profile_matches:
        print(f"  → {match[:80]}...")

    return {"profile_matches": profile_matches}