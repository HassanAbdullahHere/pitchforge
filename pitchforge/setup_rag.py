"""
setup_rag.py — Dev seed tool: chunks profile.json and upserts into
the PostgreSQL profile_chunks table for a specific user.

Run from pitchforge/ directory:
    uv run python setup_rag.py <user_uuid>

Prerequisites:
    - Docker container running (docker-compose up -d from project root)
    - Alembic migrations applied (cd backend && uv run alembic upgrade head)
    - DATABASE_URL_SYNC and GEMINI_API_KEY set in pitchforge/.env
"""

import os
import sys
import json
import uuid
from pathlib import Path

import numpy as np
import psycopg2
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pgvector.psycopg2 import register_vector

from pitchforge.profile_utils import build_chunks

load_dotenv(Path(__file__).parent / ".env")

if len(sys.argv) != 2:
    print("Usage: uv run python setup_rag.py <user_uuid>")
    print("  user_uuid — UUID of the user whose profile you are seeding")
    sys.exit(1)

try:
    user_id = str(uuid.UUID(sys.argv[1]))
except ValueError:
    print(f"Error: '{sys.argv[1]}' is not a valid UUID")
    sys.exit(1)

embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2-preview",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

# Load profile from absolute path — works regardless of cwd
with open(Path(__file__).parent / "profile" / "profile.json", "r") as f:
    profile = json.load(f)

chunks = build_chunks(profile)

# Connect to PostgreSQL and register pgvector type adapter
conn = psycopg2.connect(os.environ["DATABASE_URL_SYNC"])
register_vector(conn)  # must be called after connect, before any vector ops
cur = conn.cursor()

print(f"Upserting {len(chunks)} chunks for user {user_id}...")

for chunk in chunks:
    # embed_query returns list[float] (float64) — convert to float32 for pgvector
    vector = np.array(embeddings.embed_query(chunk["text"]), dtype=np.float32)

    cur.execute(
        """
        INSERT INTO profile_chunks (user_id, chunk_key, text, embedding)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, chunk_key) DO UPDATE
            SET text      = EXCLUDED.text,
                embedding = EXCLUDED.embedding
        """,
        (user_id, chunk["chunk_key"], chunk["text"], vector)
    )
    print(f"  + Upserted: {chunk['chunk_key']}")

conn.commit()
cur.close()
conn.close()

print(f"\nDone — {len(chunks)} chunks stored for user {user_id}")
