import os
import json
import structlog
from google.genai.errors import ServerError
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pitchforge.state import PitchforgeState

log = structlog.get_logger(__name__)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    thinking_budget=0,
    max_output_tokens=600,
    generation_config={"response_mime_type": "application/json"},
).with_retry(
    retry_if_exception_type=(ServerError,),
    stop_after_attempt=3,
    wait_exponential_jitter=True,
)

SYSTEM_PROMPT = """You are a senior freelance bidding strategist with 10+ years of experience on Upwork and Freelancer. Your job is to evaluate job-freelancer fit and recommend a bid price that maximises the freelancer's chance of winning while protecting their earnings.

You are NOT a conservative advisor. You do not recommend low-ball bids. You recommend the highest defensible price the market will bear given the freelancer's profile and the client's stated budget.

You must be evidence-based: every score and every price must be traceable to specific data in the job requirements and the freelancer profile."""

def score_fit(state: PitchforgeState) -> dict:
    """
    Node 3 — Score job fit and suggest pricing.

    Reads:  state["job_analysis"], state["profile_matches"]
    Writes: state["fit_score"], state["suggested_price"],
            state["matched_skills"], state["missing_skills"]
    """
    log.info("scoring_start")

    job = state["job_analysis"]
    profile = "\n".join(state["profile_matches"])

    prompt = f"""Evaluate the following job against the freelancer profile and return a JSON bid analysis.

━━━ JOB DETAILS ━━━
Title:            {job.get('title', 'Not specified')}
Skills required:  {', '.join(job.get('skills_required', []))}
Scope:            {job.get('scope', 'Not specified')}
Client budget:    {job.get('budget', 'Not mentioned')}
Timeline:         {job.get('timeline', 'Not specified')}
Experience level: {job.get('experience_level', 'Not specified')}

━━━ FREELANCER PROFILE ━━━
{profile}

━━━ FREELANCER RATE CARD ━━━
Hourly range:  $15–$40/hr
Fixed minimum: $500
Use the rate card only when the client has stated no budget. When a budget IS stated, anchor to the budget first.

━━━ MANDATORY PRE-STEP — CLASSIFY SKILLS FIRST, EVALUATE SECOND ━━━
Before writing any JSON, you must mentally sort every skill in the job posting into exactly one tier:

  REQUIRED   — stated as necessary with no qualifier ("must", "required", "you will need", bare list items)
  PREFERRED  — softened language: "bonus", "nice to have", "a plus", "ideally", "familiarity with", "experience with X is a plus"
  IMPLICIT   — not stated but obviously needed to deliver the scope (e.g. a FastAPI project implicitly needs Python)

HARD RULE: PREFERRED skills are permanently discarded after this step.
They must not appear in matched_skills, missing_skills, fit_reasoning, or affect fit_score in any way.
Treat them as if they do not exist in the job posting.

Only REQUIRED and IMPLICIT skills proceed to evaluation below.

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON matching this exact schema. No markdown, no code fences, no explanation.

{{
  "fit_score": <integer 0–100>,
  "fit_reasoning": "<2 sentences — name specific matched skills and name any critical gaps. Be direct.>",
  "matched_skills": ["<REQUIRED or IMPLICIT skill confirmed in profile — no PREFERRED skills ever>"],
  "missing_skills": ["<REQUIRED or IMPLICIT skill absent from profile — no PREFERRED skills ever>"],
  "suggested_price": "<price string — see pricing rules>",
  "pricing_reasoning": "<1–2 sentences — explain why this price, referencing the client budget and scope>"
}}

━━━ SKILL MATCHING RULES ━━━
Apply to REQUIRED and IMPLICIT skills only:

1. MATCHED: skill exists in the profile, even implicitly (e.g. "REST API" matches if profile shows API development work)
2. MATCHED: adjacent/equivalent technology counts (e.g. "PostgreSQL" matches general DB experience; "Node.js" matches if profile shows Express/NestJS)
3. MISSING: only mark a skill missing if there is NO related experience anywhere in the profile
4. Do not penalise the freelancer for tools they likely know but the profile chunks don't explicitly mention

━━━ SCORING RUBRIC ━━━
80–100 — Strong match: nearly all required skills present, scope aligns with demonstrated experience
60–79  — Good match: core skills present, one or two non-critical gaps
40–59  — Partial match: foundational skills match, but meaningful gaps exist in required areas
20–39  — Weak match: some transferable skills, but critical requirements are absent
0–19   — Poor match: fundamental skill mismatch, applying would waste both parties' time

━━━ PRICING RULES ━━━
Follow these rules in strict order of priority:

1. BUDGET RANGE stated (e.g. "$2,000–$3,500"):
   — Suggest 80–95% of the upper bound if fit_score ≥ 60
   — Suggest 60–80% of the upper bound if fit_score is 40–59
   — Suggest 40–60% of the upper bound if fit_score < 40
   — Rationale: clients post budget ranges expecting bids near the top; bidding at the bottom signals low confidence

2. SINGLE BUDGET stated (e.g. "$2,500 fixed"):
   — Treat it as both lower and upper bound
   — Suggest 90–100% of the stated value if fit_score ≥ 60, or 70–90% if fit_score < 60

3. HOURLY budget stated (e.g. "$30/hr"):
   — Suggest within or slightly above the stated range
   — Format as "$X/hr"

4. NO BUDGET stated:
   — Estimate scope hours (be realistic: part-time 4–6 weeks ≈ 80–120 hrs)
   — Multiply by an appropriate hourly rate from the rate card based on complexity
   — Format as "$X fixed" or "$X/hr" depending on the project nature

5. FORMAT: "$X fixed" for fixed-price, "$X/hr" for hourly — match the client's framing
6. NEVER suggest below $500 fixed for any multi-week project regardless of fit score
7. NEVER suggest more than 25% above the stated budget ceiling without explicitly justifying it in pricing_reasoning"""

    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)])

    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        log.debug("tokens", input=response.usage_metadata.get('input_tokens'), output=response.usage_metadata.get('output_tokens'))

    try:
        raw = response.content
        if isinstance(raw, list):
            raw = "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in raw)
        raw = raw.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
    except Exception as e:
        log.warning("json_parse_error", error=str(e), raw_preview=str(response.content)[:200])
        result = {
            "fit_score": 50,
            "fit_reasoning": "Could not parse scoring result.",
            "matched_skills": [],
            "missing_skills": [],
            "suggested_price": "unknown",
            "pricing_reasoning": ""
        }

    fit_score        = result.get("fit_score", 0)
    suggested_price  = result.get("suggested_price", "unknown")

    log.info(
        "scoring_done",
        fit_score=fit_score,
        suggested_price=suggested_price,
        matched=result.get("matched_skills"),
        missing=result.get("missing_skills"),
        fit_reasoning=result.get("fit_reasoning"),
        pricing_reasoning=result.get("pricing_reasoning"),
    )

    return {
        "fit_score":      fit_score,
        "suggested_price": suggested_price,
        "matched_skills": result.get("matched_skills", []),
        "missing_skills": result.get("missing_skills", []),
    }
