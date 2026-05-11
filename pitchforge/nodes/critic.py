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

AVAILABLE PROFILE EVIDENCE (what the freelancer can legitimately claim):
{profile}

PROPOSAL UNDER REVIEW:
{draft}

ITERATION: {state.get('iteration_count', 1)} of 3

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
  "feedback": "<see feedback rules below>",
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
