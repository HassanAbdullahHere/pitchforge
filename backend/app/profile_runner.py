import asyncio
import io
import json
import logging
import os
import uuid
from datetime import datetime, timezone

import numpy as np
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProfileChunk, UserProfile
from app.schemas import ProfileInput
from pitchforge.profile_utils import build_chunks

logger = logging.getLogger(__name__)

_embeddings = GoogleGenerativeAIEmbeddings(
    model="gemini-embedding-2-preview",
    google_api_key=os.getenv("GEMINI_API_KEY"),
)

_resume_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    thinking_budget=0,
    max_output_tokens=800,
)

_RESUME_PROMPT = """\
Extract information from the resume text below and return ONLY valid JSON — no markdown, no explanation.

Return this exact structure:
{{
  "title": "job title or professional role",
  "bio": "2-3 sentence professional summary",
  "skills": ["skill1", "skill2"],
  "projects": [
    {{"name": "...", "description": "what it does and what problem it solved", "tech": ["..."], "outcome": "optional result or impact"}}
  ],
  "experience": ["one notable achievement or role description per item"],
  "niches": ["specialization area 1", "specialization area 2"],
  "rates": {{"hourly_min": 0, "hourly_max": 0, "fixed_min": 0}}
}}

Leave rates as zeros if not mentioned. Keep experience as short, punchy one-liners.

Resume text:
{text}"""


async def _embed_text(text: str) -> list[float]:
    """Run sync embed_query in a thread so the event loop stays free."""
    return await asyncio.to_thread(_embeddings.embed_query, text)


async def save_profile(user_id: uuid.UUID, data: ProfileInput, db: AsyncSession) -> UserProfile:
    """
    Upsert user_profiles row and regenerate profile_chunks for the user.
    Embeddings are computed in parallel (one per chunk).
    """
    profile_dict = data.model_dump()

    # Upsert user_profiles
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    user_profile = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if user_profile is None:
        user_profile = UserProfile(
            user_id=user_id,
            title=data.title,
            bio=data.bio,
            skills=data.skills,
            projects=[p.model_dump() for p in data.projects],
            experience=data.experience,
            niches=data.niches,
            rates=data.rates.model_dump(),
            created_at=now,
            updated_at=now,
        )
        db.add(user_profile)
    else:
        user_profile.title = data.title
        user_profile.bio = data.bio
        user_profile.skills = data.skills
        user_profile.projects = [p.model_dump() for p in data.projects]
        user_profile.experience = data.experience
        user_profile.niches = data.niches
        user_profile.rates = data.rates.model_dump()
        user_profile.updated_at = now

    await db.flush()

    # Regenerate profile_chunks: delete old rows, embed and insert new ones in parallel
    await db.execute(delete(ProfileChunk).where(ProfileChunk.user_id == user_id))

    chunks = build_chunks(profile_dict)
    vectors = await asyncio.gather(*[_embed_text(c["text"]) for c in chunks])

    for chunk, vector in zip(chunks, vectors):
        db.add(ProfileChunk(
            user_id=user_id,
            chunk_key=chunk["chunk_key"],
            text=chunk["text"],
            embedding=np.array(vector, dtype=np.float32).tolist(),
        ))

    await db.flush()
    return user_profile


async def parse_resume(file_bytes: bytes, filename: str) -> dict:
    """
    Extract text from a PDF or DOCX resume, then use Gemini to structure it
    into our profile schema. Returns a dict matching ProfileInput shape.
    Raises ValueError on unsupported format or extraction failure.
    """
    lower = filename.lower()

    if lower.endswith(".pdf"):
        text = _extract_pdf(file_bytes)
    elif lower.endswith(".docx"):
        text = _extract_docx(file_bytes)
    else:
        raise ValueError("Unsupported file type. Upload a PDF or DOCX file.")

    if not text.strip():
        raise ValueError("Could not extract text from the file.")

    # Truncate to avoid blowing the token budget — 6000 chars is ~1500 tokens
    truncated = text[:6000]

    prompt = _RESUME_PROMPT.format(text=truncated)
    response = await asyncio.to_thread(_resume_llm.invoke, prompt)
    raw = response.content.strip()

    # Strip markdown code fences if Gemini added them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.exception("Resume parse: Gemini returned invalid JSON: %s", e)
        raise ValueError("Could not parse resume. Try filling in the form manually.")

    return parsed


def _extract_pdf(file_bytes: bytes) -> str:
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_docx(file_bytes: bytes) -> str:
    import docx
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
