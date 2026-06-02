"""
profile_utils.py — Shared chunking logic for profile data.
Used by setup_rag.py (dev seed) and backend profile_runner.py (API).
"""


def build_chunks(profile: dict) -> list[dict]:
    """
    Convert a structured profile dict into a flat list of {chunk_key, text} dicts
    ready for embedding and storage in profile_chunks.

    Fixed keys: bio, skills, project_0..N, experience_0..N, niches, rates.
    Separate chunk per project and experience line so the retriever can surface
    the most relevant item for each job rather than diluting all into one blob.
    """
    chunks = []

    title = profile.get("title", "")
    bio = profile.get("bio", "")
    bio_text = f"{title}. {bio}".strip(". ") if title or bio else ""
    if bio_text:
        chunks.append({"chunk_key": "bio", "text": f"Profile: {bio_text}"})

    skills = profile.get("skills", [])
    if skills:
        chunks.append({"chunk_key": "skills", "text": f"Skills: {', '.join(skills)}"})

    for i, project in enumerate(profile.get("projects", [])):
        name = project.get("name", "")
        desc = project.get("description", "")
        tech = project.get("tech", [])
        outcome = project.get("outcome", "")
        parts = [f"Project: {name}.", desc]
        if tech:
            parts.append(f"Tech: {', '.join(tech)}.")
        if outcome:
            parts.append(f"Outcome: {outcome}.")
        chunks.append({"chunk_key": f"project_{i}", "text": " ".join(p for p in parts if p)})

    for i, exp in enumerate(profile.get("experience", [])):
        if exp:
            chunks.append({"chunk_key": f"experience_{i}", "text": f"Experience: {exp}"})

    niches = profile.get("niches", [])
    if niches:
        chunks.append({"chunk_key": "niches", "text": f"Specializes in: {', '.join(niches)}"})

    rates = profile.get("rates", {})
    if rates:
        h_min = rates.get("hourly_min", 0)
        h_max = rates.get("hourly_max", 0)
        f_min = rates.get("fixed_min", 0)
        chunks.append({
            "chunk_key": "rates",
            "text": f"Hourly rate: ${h_min}-${h_max}. Minimum fixed: ${f_min}"
        })

    return chunks
