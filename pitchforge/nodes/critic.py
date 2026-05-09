import os
import json
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pitchforge.state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

def critique_proposal(state: PitchforgeState) -> dict:
    """
    Node 5 — Critic Agent.

    Reads: proposal_draft, job_analysis, profile_matches, iteration_count
    Writes: critic_feedback, quality_score
    """

    iteration = state["iteration_count"]
    print(f"\n[Node 5] Critiquing proposal draft (iteration {iteration})...")

    job = state["job_analysis"]
    profile = "\n".join(state["profile_matches"])
    draft = state["proposal_draft"]

    prompt = f"""
You are a harsh but fair proposal coach reviewing an Upwork proposal.
Score it 0-100 and give specific, actionable feedback.

JOB REQUIREMENTS:
Title: {job.get('title')}
Skills required: {', '.join(job.get('skills_required', []))}
Scope: {job.get('scope')}
Budget: {job.get('budget')}
Experience level: {job.get('experience_level')}

FREELANCER'S AVAILABLE EXPERIENCE (from profile):
{profile}

PROPOSAL TO REVIEW:
{draft}

Evaluate strictly against these 6 criteria:
1. Specificity — does it reference actual job details, or is it generic?
2. Evidence — does it use real experience from the profile as proof?
3. Structure — has hook, fit, approach, experience, and closing?
4. Tone — human and conversational, not templated or sycophantic?
5. Price — is the suggested price mentioned naturally?

Respond with ONLY valid JSON in this exact format:
{{
  "quality_score": <integer 0-100>,
  "verdict": "<PASS or FAIL>",
  "scores": {{
    "specificity": <0-20>,
    "evidence": <0-20>,
    "structure": <0-20>,
    "tone": <0-20>,
    "price": <0-10>
  }},
  "feedback": "<specific issues to fix — mention exact lines or phrases that are weak. If PASS, say what works well.>"
}}

PASS = quality_score >= 70. FAIL = quality_score < 70.
Be harsh. Generic phrases, missing price, or unproven claims are automatic point deductions.
"""

    response = llm.invoke([HumanMessage(content=prompt)])
    raw = response.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    # Escape literal control chars inside JSON string values (LLM sometimes emits raw newlines)
    raw = re.sub(
        r'"((?:[^"\\]|\\.)*)"',
        lambda m: '"' + m.group(1).replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t') + '"',
        raw,
    )

    result = json.loads(raw)

    quality_score = int(result["quality_score"])
    feedback = result["feedback"]
    verdict = result.get("verdict", "PASS" if quality_score >= 70 else "FAIL")
    scores = result.get("scores", {})

    print(f"[Node 5] Score: {quality_score}/100 — {verdict}")
    print(f"[Node 5] Breakdown: {scores}")
    print(f"[Node 5] Feedback: {feedback}")

    return {
        "critic_feedback": feedback,
        "quality_score": quality_score,
    }
