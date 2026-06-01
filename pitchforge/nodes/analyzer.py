import os
import json
from google.genai.errors import ServerError
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pitchforge.state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    thinking_budget=0,
    max_output_tokens=400,
    generation_config={"response_mime_type": "application/json"},
).with_retry(
    retry_if_exception_type=(ServerError,),
    stop_after_attempt=3,
    wait_exponential_jitter=True,
)

SYSTEM_PROMPT = """You are a technical recruiter specialising in freelance contracts. You parse job postings into clean, structured data that downstream systems use for scoring and proposal generation. Your output must be precise — errors here cascade into every subsequent step."""


def collect_job_input() -> str:
    """
    Collecting job details from user via CLI.
    Returns a single formatted string — easy to send to Gemini.
    """
    print("\n" + "="*50)
    print("PITCHFORGE — Job Details")
    print("="*50)

    title       = input("\nJob title: ").strip()
    description = input("Job description (paste and press Enter): ").strip()
    budget      = input("Budget (e.g. $500-800 or 'not mentioned'): ").strip()
    timeline    = input("Timeline (e.g. '2 weeks' or 'not mentioned'): ").strip()
    level       = input("Experience level required (entry/intermediate/expert): ").strip()
    platform    = input("Platform (Upwork/Freelancer/other): ").strip()

    return (
        f"Job Title: {title}\n"
        f"Description: {description}\n"
        f"Budget: {budget}\n"
        f"Timeline: {timeline}\n"
        f"Experience Level: {level}\n"
        f"Platform: {platform}\n"
    )


def analyze_job(state: PitchforgeState) -> dict:
    """
    Node 1 — Analyze the job posting.

    Reads:  state["job_posting"]
    Writes: state["job_analysis"]
    """
    print("\n[Node 1] Analyzing job posting...")

    prompt = f"""Parse the following job posting and return ONLY valid JSON. No explanation. No markdown. No code fences.

{{
  "title": "<concise job title, max 8 words>",
  "skills_required": ["<normalized skill names — see rules below>"],
  "scope": "<one sentence: what needs to be built or done>",
  "budget": "<exact budget as stated, or 'not mentioned'>",
  "timeline": "<exact timeline as stated, or 'not mentioned'>",
  "client_type": "<individual | startup | agency | enterprise | unknown>",
  "experience_level": "<entry | intermediate | expert>",
  "client_identifiable": <true if the posting contains a company name, website, or other identifying detail — false otherwise>
}}

━━━ SKILL NORMALIZATION RULES ━━━
Apply every rule — do not skip:

1. Strip version numbers:       "Python 3.11" → "Python",  "Node.js 18" → "Node.js"
2. Keep compound tools intact:  "Docker Compose" stays "Docker Compose", not split into two skills
3. Normalize casing:            "fastapi" → "FastAPI",  "aws ec2" → "AWS EC2",  "github actions" → "GitHub Actions"
4. Expand abbreviations:        "k8s" → "Kubernetes",  "PG" → "PostgreSQL",  "GH Actions" → "GitHub Actions"
5. Extract implicit skills:     "reverse proxy" → add "Nginx";  "process manager" → add "PM2"
6. Do not invent skills:        only include skills mentioned or clearly implied by the posting
7. No duplicates:               deduplicate the final list

━━━ FIELD RULES ━━━
- "budget": copy the exact budget string from the posting. If a range is given, preserve it (e.g. "$2,000–$3,500 fixed").
- "client_identifiable": set true only if a real company name, domain, or publicly identifiable entity appears in the posting. Generic descriptions ("a law firm", "a startup") are NOT identifiable.
- "experience_level": infer from the posting if not explicitly stated — a $5k solo project with "5+ years required" is "expert".

Job posting:
{state["job_posting"]}"""

    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)])
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        print(f"[Node 1 analyzer] tokens — input: {response.usage_metadata.get('input_tokens')} | output: {response.usage_metadata.get('output_tokens')}")

    try:
        raw = response.content
        if isinstance(raw, list):
            raw = "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in raw)
        raw = raw.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        job_analysis = json.loads(raw.strip())
    except Exception as e:
        print(f"[Node 1 analyzer] JSON parse error: {e} — raw: {str(response.content)[:200]!r}")
        job_analysis = {
            "title": "Unknown",
            "skills_required": [],
            "scope": state["job_posting"][:200],
            "budget": "unknown",
            "timeline": "unknown",
            "client_type": "unknown",
            "experience_level": "unknown",
            "client_identifiable": False,
        }

    print(f"[Node 1] Done — {job_analysis.get('title')} | {len(job_analysis.get('skills_required', []))} skills extracted")

    return {"job_analysis": job_analysis}
