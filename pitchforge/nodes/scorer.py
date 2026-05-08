import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

def score_fit(state: PitchforgeState) -> dict:
    """
    Node 3 — Score job fit and suggest pricing.

    Reads: state["job_analysis"], state["profile_matches"]
    Writes: state["fit_score"], state["suggested_price"]
    """
    print("\n[Node 3] Scoring job fit...")

    job = state["job_analysis"]
    profile = "\n".join(state["profile_matches"])

    prompt = f"""
You are evaluating whether a freelancer should apply for a job.

JOB REQUIREMENTS:
Title: {job.get('title')}
Skills required: {', '.join(job.get('skills_required', []))}
Scope: {job.get('scope')}
Budget: {job.get('budget')}
Experience level: {job.get('experience_level')}

FREELANCER PROFILE:
{profile}

Evaluate the match and return ONLY valid JSON:
{{
  "fit_score": <integer 0-100>,
  "fit_reasoning": "<2 sentences explaining the score>",
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "suggested_price": "<suggested bid e.g. $25/hr or $600 fixed>",
  "pricing_reasoning": "<one sentence explaining the price>"
}}

Scoring guide:
80-100: Strong match, definitely apply
60-79: Good match, worth applying
40-59: Partial match, apply carefully
0-39: Poor match, don't apply
"""

    response = llm.invoke([HumanMessage(content=prompt)])

    try:
        raw = response.content.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
    except Exception:
        result = {
            "fit_score": 50,
            "fit_reasoning": "Could not parse scoring result.",
            "matched_skills": [],
            "missing_skills": [],
            "suggested_price": "unknown",
            "pricing_reasoning": ""
        }

    fit_score = result.get("fit_score", 0)
    suggested_price = result.get("suggested_price", "unknown")

    # Print scoring summary
    print(f"[Node 3] Fit score: {fit_score}/100")
    print(f"[Node 3] Reasoning: {result.get('fit_reasoning')}")
    print(f"[Node 3] Matched: {result.get('matched_skills')}")
    print(f"[Node 3] Missing: {result.get('missing_skills')}")
    print(f"[Node 3] Pricing reasoning: {result.get('pricing_reasoning')}")
    print(f"[Node 3] Suggested price: {suggested_price}")

    return {
        "fit_score": fit_score,
        "suggested_price": suggested_price
    }

def should_continue(state: PitchforgeState) -> str:
    """
    Conditional edge function — LangGraph calls this to decide next node.
    Returns a string that maps to the next node name in the graph.

    This is how LangGraph branching works —
    not an if statement in the node, but a separate routing function.
    """
    if state["fit_score"] < 40:
        return "low_fit"
    return "continue"