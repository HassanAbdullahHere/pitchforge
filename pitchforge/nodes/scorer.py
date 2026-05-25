import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pitchforge.state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    thinking_budget=0,
    max_output_tokens=600,
    generation_config={"response_mime_type": "application/json"},
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
    print("\n[Node 3] Scoring job fit...")

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

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON matching this exact schema. No markdown, no code fences, no explanation.

{{
  "fit_score": <integer 0–100>,
  "fit_reasoning": "<2 sentences — name specific matched skills and name any critical gaps. Be direct.>",
  "matched_skills": ["<skill>"],
  "missing_skills": ["<skill>"],
  "suggested_price": "<price string — see pricing rules>",
  "pricing_reasoning": "<1–2 sentences — explain why this price, referencing the client budget and scope>"
}}

━━━ STEP 1 — CLASSIFY SKILLS BEFORE EVALUATING ━━━
Before any matching or scoring, sort every skill mentioned in the job into one of three tiers:

  REQUIRED   — explicitly stated as necessary ("must have", "required", "you will need", or listed with no qualifier)
  PREFERRED  — softened language ("bonus", "nice to have", "plus", "ideally", "familiarity with", "experience with X is a plus")
  IMPLICIT   — not stated but obviously necessary to deliver the described scope (e.g. a REST API project implicitly requires HTTP knowledge)

Rules that follow apply ONLY to REQUIRED and IMPLICIT skills.
PREFERRED skills must be discarded entirely — they must not appear in matched_skills, missing_skills, or influence fit_score.

━━━ STEP 2 — SKILL MATCHING RULES ━━━
Apply these strictly — do not over-penalise the freelancer:

1. MATCHED: skill exists in the profile, even implicitly (e.g. "REST API" matches if profile shows API development work)
2. MATCHED: adjacent/equivalent technology counts (e.g. "PostgreSQL" matches general DB experience; "Node.js" matches if profile shows Express/NestJS)
3. MISSING: only mark a skill missing if there is NO related experience anywhere in the profile
4. Do not penalise the freelancer for tools they likely know but weren't mentioned in the profile chunks provided

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
        print(f"[Node 3 scorer] tokens — input: {response.usage_metadata.get('input_tokens')} | output: {response.usage_metadata.get('output_tokens')}")

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
        print(f"[Node 3 scorer] JSON parse error: {e} — raw: {response.content!r}")
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

    print(f"[Node 3] Fit score:         {fit_score}/100")
    print(f"[Node 3] Fit reasoning:     {result.get('fit_reasoning')}")
    print(f"[Node 3] Matched:           {result.get('matched_skills')}")
    print(f"[Node 3] Missing:           {result.get('missing_skills')}")
    print(f"[Node 3] Suggested price:   {suggested_price}")
    print(f"[Node 3] Pricing reasoning: {result.get('pricing_reasoning')}")

    return {
        "fit_score":      fit_score,
        "suggested_price": suggested_price,
        "matched_skills": result.get("matched_skills", []),
        "missing_skills": result.get("missing_skills", []),
    }


def should_continue(state: PitchforgeState) -> str:
    """
    Conditional edge — routes to END if fit is too low to bother generating a proposal.
    """
    if state["fit_score"] < 40:
        return "low_fit"
    return "continue"
