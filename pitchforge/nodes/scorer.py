import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pitchforge.state import PitchforgeState

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
You are a senior freelance consultant evaluating whether a freelancer should bid on a job.
Your evaluation must be precise, evidence-based, and commercially realistic.

JOB REQUIREMENTS:
Title: {job.get('title')}
Skills required: {', '.join(job.get('skills_required', []))}
Scope: {job.get('scope')}
Budget: {job.get('budget')}
Timeline: {job.get('timeline')}
Experience level: {job.get('experience_level')}

FREELANCER PROFILE:
{profile}

Return ONLY valid JSON. No explanation. No markdown. No code fences.

{{
  "fit_score": <integer 0-100>,
  "fit_reasoning": "<2 sentences — cite specific matched skills and any critical gaps>",
  "matched_skills": ["skills from job requirements that exist in the freelancer profile"],
  "missing_skills": ["skills from job requirements genuinely absent from the profile — not just unlisted"],
  "suggested_price": "<realistic bid — see pricing rules below>",
  "pricing_reasoning": "<one sentence explaining the price relative to budget and scope>"
}}

Skill matching rules — apply strictly:
- A skill is MATCHED if it exists in the profile, even if not explicitly listed — Docker covers Docker Compose unless Compose is a distinct specialization being tested
- A skill is MISSING only if there is NO related experience in the profile whatsoever
- Do not mark a skill missing just because it is not word-for-word in the profile
- Adjacent skills count: "PostgreSQL" matches if profile shows database experience with similar systems
- If a skill is listed as "bonus" or "nice to have" in the job, exclude it from missing_skills entirely

Scoring rules:
- 80-100: Strong match — most required skills present, scope aligns with experience
- 60-79: Good match — core skills present, one or two minor gaps
- 40-59: Partial match — foundational skills present but meaningful gaps exist
- 0-39: Poor match — critical required skills absent

Pricing rules — follow these in order:
1. If budget is stated: your suggested_price must be at or below the stated budget unless scope clearly justifies more
2. If budget is stated and your price exceeds it: you MUST acknowledge the discrepancy in pricing_reasoning
3. If budget is "not mentioned": suggest based on scope complexity and experience level
4. Never suggest a price more than 20% above stated budget without explicit justification in pricing_reasoning
5. Format: "$X fixed" for fixed projects, "$X/hr" for hourly — match the budget format if stated

Pricing reference for this freelancer:
- Hourly range: $15-40/hr
- Minimum fixed: $100
- Calibrate within these bounds based on scope and budget
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
        "suggested_price": suggested_price,
        "matched_skills": result.get("matched_skills", []),
        "missing_skills": result.get("missing_skills", []),
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