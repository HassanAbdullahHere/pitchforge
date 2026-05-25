"""
setup_rag.py — One-time script: chunks profile.json and upserts into
the PostgreSQL profile_chunks table.

Run from pitchforge/ directory:
    uv run python setup_rag.py

Prerequisites:
    - Docker container running (docker-compose up -d from project root)
    - Alembic migrations applied (cd backend && uv run alembic upgrade head)
    - DATABASE_URL and GEMINI_API_KEY set in pitchforge/.env
"""

import os
import json
from pathlib import Path

import numpy as np
import psycopg2
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pgvector.psycopg2 import register_vector

load_dotenv(Path(__file__).parent / ".env")

embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2-preview",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

# Load profile from absolute path — works regardless of cwd
with open(Path(__file__).parent / "profile" / "profile.json", "r") as f:
    profile = json.load(f)

# Build chunks — same structure as before
chunks = []

chunks.append({
    "id": "skills",
    "text": f"Skills: {', '.join(profile['skills'])}"
})

for i, project in enumerate(profile["projects"]):
    chunks.append({
        "id": f"project_{i}",
        "text": f"Project: {project['name']}. {project['description']}. Tech: {', '.join(project['tech'])}"
    })

for i, exp in enumerate(profile["experience"]):
    chunks.append({
        "id": f"experience_{i}",
        "text": f"Experience: {exp}"
    })

chunks.append({
    "id": "niches",
    "text": f"Specializes in: {', '.join(profile['niches'])}"
})

chunks.append({
    "id": "rates",
    "text": (
        f"Hourly rate: ${profile['rates']['hourly_min']}-${profile['rates']['hourly_max']}. "
        f"Minimum fixed: ${profile['rates']['fixed_min']}"
    )
})

# Connect to PostgreSQL and register pgvector type adapter
conn = psycopg2.connect(os.environ["DATABASE_URL"])
register_vector(conn)  # must be called after connect, before any vector ops
cur = conn.cursor()

print(f"Upserting {len(chunks)} chunks into profile_chunks...")

for chunk in chunks:
    # embed_query returns list[float] (float64) — convert to float32 for pgvector
    vector = np.array(embeddings.embed_query(chunk["text"]), dtype=np.float32)

    cur.execute(
        """
        INSERT INTO profile_chunks (id, text, embedding)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE
            SET text      = EXCLUDED.text,
                embedding = EXCLUDED.embedding
        """,
        (chunk["id"], chunk["text"], vector)
    )
    print(f"  + Upserted: {chunk['id']}")

conn.commit()
cur.close()
conn.close()

print(f"\nDone — {len(chunks)} chunks stored in PostgreSQL profile_chunks table")
