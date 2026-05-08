import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pitchforge.state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

def collect_job_input() -> str:
    """
    Collecting job details from user via CLI.
    Returns a single formatted string — easy to send to Gemini.
    """
    print("\n" + "="*50)
    print("PITCHFORGE — Job Details")
    print("="*50)

    title = input("\nJob title: ").strip()
    description = input("Job description (paste and press Enter): ").strip()
    budget = input("Budget (e.g. $500-800 or 'not mentioned'): ").strip()
    timeline = input("Timeline (e.g. '2 weeks' or 'not mentioned'): ").strip()
    level = input("Experience level required (entry/intermediate/expert): ").strip()
    platform = input("Platform (Upwork/Freelancer/other): ").strip()

    return f"""
Job Title: {title}
Description: {description}
Budget: {budget}
Timeline: {timeline}
Experience Level: {level}
Platform: {platform}
"""

def analyze_job(state: PitchforgeState) -> dict:
    """
    Node 1 — Analyze the job posting.

    Reads: state["job_posting"]
    Writes: state["job_analysis"]
    """
    print("\n[Node 1] Analyzing job posting...")

    prompt = f"""
Analyze this job posting and return ONLY valid JSON.
No explanation. No markdown. Just the JSON object.

{{
  "title": "job title",
  "skills_required": ["skill1", "skill2"],
  "scope": "one sentence describing the project",
  "budget": "budget as stated",
  "timeline": "timeline as stated",
  "client_type": "individual/startup/agency/enterprise/unknown",
  "experience_level": "entry/intermediate/expert",
  "client_identifiable": false
}}

Job posting:
{state["job_posting"]}
"""

    response = llm.invoke([HumanMessage(content=prompt)])

    try:
        raw = response.content.strip()
        # Strip markdown code fences if Gemini adds them
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        job_analysis = json.loads(raw.strip())

    except Exception:
        # If JSON parsing fails, store raw text as fallback
        job_analysis = {
            "title": "Unknown",
            "skills_required": [],
            "scope": state["job_posting"][:200],
            "budget": "unknown",
            "timeline": "unknown",
            "client_type": "unknown",
            "experience_level": "unknown",
            "client_identifiable": False
        }

    print(f"[Node 1] Done — {job_analysis.get('title')}")

    # Return only what changed in state
    return {"job_analysis": job_analysis}