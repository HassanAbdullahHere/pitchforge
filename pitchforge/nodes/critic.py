import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from pitchforge.state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    thinking_budget=0,
    max_output_tokens=800,
    generation_config={"response_mime_type": "application/json"},
)

SYSTEM_PROMPT = """You are a senior Upwork consultant who has reviewed thousands of proposals and coached freelancers to top-rated status. You are ruthless, specific, and constructive. You do not give empty praise. You do not penalise things that don't matter. Your feedback must be actionable in a single revision pass."""


def critique_proposal(state: PitchforgeState) -> dict:
    """
    Node 5 — Critique the current proposal draft.

    Reads:  proposal_draft, job_analysis, matched_skills, missing_skills, iteration_count
    Writes: critic_feedback, quality_score
    """
    iteration = state["iteration_count"]
    print(f"\n[Node 5] Critiquing proposal draft (iteration {iteration})...")

    job     = state["job_analysis"]
    draft   = state["proposal_draft"]
    matched = state.get("matched_skills", [])
    missing = state.get("missing_skills", [])

    matched_str = ", ".join(matched) if matched else "not available"
    missing_str = ", ".join(missing) if missing else "none"

    prompt = f"""Evaluate the proposal below against the job requirements. Return ONLY valid JSON — no markdown, no code fences.

━━━ JOB REQUIREMENTS ━━━
Title:            {job.get('title')}
Skills required:  {', '.join(job.get('skills_required', []))}
Scope:            {job.get('scope')}
Budget:           {job.get('budget')}
Timeline:         {job.get('timeline')}
Experience level: {job.get('experience_level')}

━━━ SKILL MATCH CONTEXT ━━━
Confirmed matched skills: {matched_str}
Genuine gaps (skills absent from profile): {missing_str}

━━━ PROPOSAL UNDER REVIEW ━━━
{draft}

━━━ ITERATION ━━━
{iteration} of 3

━━━ OUTPUT SCHEMA ━━━
Return ONLY valid JSON. Keep all string values concise. Total response under 750 tokens. No newlines inside JSON string values.

{{
  "quality_score": <integer 0–100>,
  "verdict": "<PASS or FAIL>",
  "scores": {{
    "hook":     <0–20>,
    "evidence": <0–20>,
    "approach": <0–20>,
    "honesty":  <0–20>,
    "closing":  <0–20>
  }},
  "feedback": "<actionable issues — max 150 words, quote the exact weak phrase then say what to do instead>",
  "passed_elements": ["<specific things that work — be precise, not generic>"],
  "failed_elements": ["<exact quotes of weak phrases or sentences — one fix instruction each>"]
}}

━━━ SCORING CRITERIA ━━━

HOOK (0–20):
20   — Opens with the client's core problem, immediately specific, does not start with "I"
10–19 — Decent opening but generic, or starts with "I", or mildly restates the job
0–9  — Restates the job description, starts with "I am", or uses a cliché opener

EVIDENCE (0–20):
20   — Names a real project or outcome from the profile, cites specific technologies
10–19 — References skills but vaguely — no named project, no specific outcome
0–9  — Generic claims ("I have experience with X"), or cites things not in the profile

APPROACH (0–20):
20   — Specific to this job's stack, shows the freelancer has thought about the actual architecture
10–19 — Reasonable but generic — could apply to any similar job
0–9  — No approach mentioned, or a generic process list with no specifics

HONESTY (0–20):
Confirmed matched skills: {matched_str}
Genuine gaps: {missing_str}
20   — Only claims skills from the matched list, handles gaps with omission or honest bridging
10–19 — Minor overreach — claims adjacent skills confidently without explicit evidence
0–9  — Claims skills that appear in the gaps list as if they are established experience (fabrication)
Note: penalise fabrication heavily — a proposal that lies about skills will destroy the freelancer's credibility in the interview

CLOSING (0–20):
20   — Price stated once confidently, smart specific question, low-friction CTA
10–19 — Price present but awkward, question is generic or missing
0–9  — Price missing, justifies or apologises for price, ends with a banned phrase

━━━ BANNED PHRASES — automatic -5 each ━━━
"I am passionate about"
"I would love to help"
"I am the perfect fit"
"look no further"
"I am confident that"
"Thank you for your consideration"
"I look forward to hearing from you"
"proven track record"
"deliver high quality"
"I have extensive experience"
"seamlessly"
"robust solution"

━━━ FACTUAL ACCURACY RULES ━━━
Only penalise missing information if it is genuinely absent and matters:
- If budget is "not mentioned" — do not penalise for not addressing price
- If timeline is "not mentioned" — do not penalise for not referencing a deadline
- Do not penalise for omitting information that was not in the job posting

━━━ FEEDBACK RULES ━━━
- Quote the exact weak phrase in quotation marks, then say specifically what is wrong, then say specifically what to write instead
- If iteration is 2 or 3 — only give feedback on what is still broken; acknowledge what improved
- Maximum 4 feedback points — highest impact issues only
- If verdict is PASS — still give 1–2 improvement notes. Never just say "looks good."
- failed_elements must contain exact quoted phrases from the proposal, not paraphrases

━━━ PASS THRESHOLD ━━━
PASS: quality_score >= 85
FAIL: quality_score < 85
Iteration 3 exception: if score >= 65, return PASS — do not loop indefinitely on marginal proposals"""

    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)])
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        print(f"[Node 5 critic] tokens — input: {response.usage_metadata.get('input_tokens')} | output: {response.usage_metadata.get('output_tokens')}")

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
        print(f"[Node 5 critic] JSON parse error: {e} — raw: {str(response.content)[:200]!r}")
        result = {
            "quality_score": 60,
            "feedback": "Could not parse critic response.",
            "verdict": "PASS",
            "scores": {},
            "passed_elements": [],
            "failed_elements": [],
        }

    quality_score = int(result.get("quality_score", 60))
    feedback      = result.get("feedback", "")
    verdict       = result.get("verdict", "PASS" if quality_score >= 85 else "FAIL")
    scores        = result.get("scores", {})
    failed        = result.get("failed_elements", [])

    # Append failed_elements to feedback so the generator has surgical targets
    if failed:
        failed_lines = "\n".join(f"- {item}" for item in failed)
        feedback = f"{feedback}\n\nFix these specifically:\n{failed_lines}"

    print(f"[Node 5] Score: {quality_score}/100 — {verdict}")
    print(f"[Node 5] Breakdown: hook={scores.get('hook')} evidence={scores.get('evidence')} approach={scores.get('approach')} honesty={scores.get('honesty')} closing={scores.get('closing')}")
    print(f"[Node 5] Feedback: {feedback}")

    return {
        "critic_feedback": feedback,
        "quality_score":   quality_score,
    }
