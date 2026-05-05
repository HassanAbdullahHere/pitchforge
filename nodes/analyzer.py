import httpx
from bs4 import BeautifulSoup
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from state import PitchforgeState
import json
import os

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

def fetch_job_posting(source: str) -> str:
    """Fetch job text from URL or return raw text as-is"""
    if source.startswith("http"):
        try:
            response = httpx.get(source, timeout=10, follow_redirects=True)
            soup = BeautifulSoup(response.text, "html.parser")
            # Remove scripts and styles
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            return soup.get_text(separator="\n", strip=True)[:5000]
        except Exception as e:
            return f"Failed to fetch URL: {e}"
    return source

def analyze_job(state: PitchforgeState) -> dict:
    """Node 1 — fetch and analyze the job posting"""

    print("\n[Node 1] Fetching and analyzing job posting...")

    # Fetch content
    raw_text = fetch_job_posting(state["job_posting"])

    # Ask Gemini to extract structured info
    prompt = f"""
Analyze this job posting and extract structured information.
Return ONLY valid JSON with these exact keys:

{{
  "title": "job title",
  "skills_required": ["skill1", "skill2"],
  "scope": "brief description of project scope",
  "budget": "budget if mentioned or unknown",
  "client_type": "individual/startup/agency/enterprise/unknown",
  "experience_level": "entry/intermediate/expert",
  "project_duration": "duration if mentioned or unknown",
  "client_identifiable": true or false,
  "client_name": "company or client name if found or null"
}}

Job posting:
{raw_text}
"""

    response = llm.invoke([HumanMessage(content=prompt)])

    try:
        # Clean and parse JSON
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        job_analysis = json.loads(raw.strip())
    except Exception:
        # Fallback if JSON parsing fails
        job_analysis = {
            "title": "Unknown",
            "skills_required": [],
            "scope": raw_text[:200],
            "budget": "unknown",
            "client_type": "unknown",
            "experience_level": "unknown",
            "project_duration": "unknown",
            "client_identifiable": False,
            "client_name": None
        }

    print(f"[Node 1] Analysis complete — Job: {job_analysis.get('title')}")

    return {"job_analysis": job_analysis}