import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pitchforge.state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    thinking_budget=0,
    max_output_tokens=800,
    generation_config={"response_mime_type": "application/json"},
)

def critique_proposal(state: PitchforgeState) -> dict:
    """
    Node 5 — Critic Agent.

    Reads: proposal_draft, job_analysis, iteration_count
    Writes: critic_feedback, quality_score
    """

    iteration = state["iteration_count"]
    print(f"\n[Node 5] Critiquing proposal draft (iteration {iteration})...")

    job = state["job_analysis"]
    draft = state["proposal_draft"]

    prompt = f"""
You are a senior Upwork consultant who has reviewed thousands of proposals.
Your job is to evaluate this proposal ruthlessly against one standard:
would a busy client reading 30 proposals stop and respond to this one?

JOB REQUIREMENTS:
Title: {job.get('title')}
Skills required: {', '.join(job.get('skills_required', []))}
Scope: {job.get('scope')}
Budget: {job.get('budget')}
Timeline: {job.get('timeline')}
Experience level: {job.get('experience_level')}

PROPOSAL UNDER REVIEW:
{draft}

ITERATION: {state.get('iteration_count', 1)} of 3

CRITICAL: Your entire response must be valid JSON under 750 tokens.
Keep all string values concise. The feedback field must be under 150 words.
Never use newlines inside JSON string values — use spaces instead.

Evaluate against these criteria and return ONLY valid JSON.
No explanation. No markdown. No code fences.

{{
  "quality_score": <integer 0-100>,
  "verdict": "PASS or FAIL",
  "scores": {{
    "hook": <0-20>,
    "evidence": <0-20>,
    "approach": <0-20>,
    "tone": <0-20>,
    "closing": <0-20>
  }},
  "feedback": "<specific issues — maximum 150 words total, no more>",
  "passed_elements": ["<list what actually works — be specific>"],
  "failed_elements": ["<list exact phrases or sentences that are weak — quote them>"]
}}

Scoring criteria:

HOOK (0-20):
- 20: Opens with client's problem, immediately specific, does not start with "I"
- 10-19: Decent opening but generic or starts with "I"
- 0-9: Restates the job, starts with "I am", or uses a cliché opener

EVIDENCE (0-20):
- 20: Cites specific technologies, real project outcomes from the profile
- 10-19: References skills but vaguely, no specific proof points
- 0-9: Generic claims with no evidence, or claims skills not in the profile

APPROACH (0-20):
- 20: Specific to this job's stack, shows technical thinking, mentions one non-obvious detail
- 10-19: Reasonable approach but generic, could apply to any similar job
- 0-9: No approach mentioned, or approach is a generic process list

TONE (0-20):
- 20: Confident, direct, human — reads like a senior professional
- 10-19: Mostly clean but has filler phrases or corporate speak
- 0-9: Sycophantic, eager, salesy, or uses any banned phrases

CLOSING (0-20):
- 20: Price stated once confidently, smart specific question, low-friction CTA
- 10-19: Price present but awkward, question generic or missing
- 0-9: Price missing, justifies or apologizes for price, ends with "look forward to hearing from you"

Banned phrases — any of these present = automatic -5 each:
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

Factual accuracy rules — critical:
- Only penalize missing information if it is genuinely absent from the proposal
- Never penalize for omitting information that was not stated in the job posting
- If the job posting says timeline is "not mentioned" — do not penalize for not referencing a timeline
- If budget is "not mentioned" — do not penalize for not addressing budget
- Only reference what is explicitly in the job details above

Feedback rules:
- Quote the exact weak phrase in quotation marks
- Say specifically what is wrong with it
- Say specifically what to do instead
- If iteration is 2 or 3 — focus feedback only on what is still broken, acknowledge what was fixed
- Maximum 4 feedback points — prioritize the highest impact issues only
- If PASS — still give 1-2 improvement suggestions, never just say "looks good"

PASS threshold: quality_score >= 70
FAIL threshold: quality_score < 70
On iteration 3: if score >= 55, return PASS regardless — avoid infinite loop on marginal proposals
"""

    response = llm.invoke([HumanMessage(content=prompt)])
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
        print(f"[Node 5] JSON parse failed: {e} — raw: {response.content!r:.200}")
        result = {"quality_score": 60, "feedback": "Could not parse critic response.", "verdict": "PASS", "scores": {}}

    quality_score = int(result.get("quality_score", 60))
    feedback = result.get("feedback", "")
    verdict = result.get("verdict", "PASS" if quality_score >= 70 else "FAIL")
    scores = result.get("scores", {})

    print(f"[Node 5] Score: {quality_score}/100 — {verdict}")
    print(f"[Node 5] Breakdown: {scores}")
    print(f"[Node 5] Feedback: {feedback}")

    return {
        "critic_feedback": feedback,
        "quality_score": quality_score,
    }
