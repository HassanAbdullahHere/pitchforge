import os
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
    max_output_tokens=700,
    streaming=True,
).with_retry(
    retry_if_exception_type=(ServerError,),
    stop_after_attempt=3,
    wait_exponential_jitter=True,
)

SYSTEM_PROMPT = """You write freelance proposals that win contracts. You have one rule above all others: every single claim in the proposal must be traceable to something real in the freelancer's profile. You do not invent past projects. You do not imply experience that isn't there. You do not pad with filler.

You know what clients on Upwork hate: proposals that sound like every other proposal. The ones that open with "I am passionate about", list technologies like a resume, and close with "I look forward to hearing from you." You never write those.

You write short, specific, human. You sound like a senior developer who read the job carefully and has something real to say about it — not a chatbot who processed it."""


def generate_proposal(state: PitchforgeState) -> dict:
    """
    Node 4 — Generate proposal draft.

    Reads:  job_analysis, profile_matches, fit_score, suggested_price,
            matched_skills, missing_skills, critic_feedback, human_feedback, iteration_count
    Writes: proposal_draft, iteration_count
    """
    iteration      = state["iteration_count"]
    log.info("generation_start", iteration=iteration + 1)

    job             = state["job_analysis"]
    profile         = "\n".join(state["profile_matches"])
    matched         = state.get("matched_skills", [])
    missing         = state.get("missing_skills", [])
    critic_feedback = state.get("critic_feedback", "")
    human_feedback  = state.get("human_feedback", "")

    matched_str = ", ".join(matched) if matched else "see profile below"
    missing_str = ", ".join(missing) if missing else "none"

    revision_context = ""
    if human_feedback:
        revision_context = f"""
━━━ HUMAN REVISION REQUEST — HIGHEST PRIORITY ━━━
The human reviewer has requested specific changes. Apply every point exactly. Their instructions override all other rules:
{human_feedback}
"""
    elif critic_feedback:
        revision_context = f"""
━━━ CRITIC FEEDBACK — REQUIRED FIXES ━━━
The previous draft was rejected. Fix every issue listed below. Do not repeat the same mistakes:
{critic_feedback}
"""

    prompt = f"""Write a freelance proposal for the job below. Every rule is mandatory.

━━━ JOB ━━━
Title:            {job.get('title', 'Not specified')}
Skills required:  {', '.join(job.get('skills_required', []))}
Scope:            {job.get('scope', 'Not specified')}
Budget:           {job.get('budget', 'Not mentioned')}
Timeline:         {job.get('timeline', 'Not specified')}
Experience level: {job.get('experience_level', 'Not specified')}

━━━ FREELANCER PROFILE (the only source of truth) ━━━
{profile}

━━━ SKILL MATCH ANALYSIS ━━━
Confirmed matches — claim these confidently: {matched_str}
Genuine gaps — handle per rules below:          {missing_str}

━━━ BID PRICE ━━━
{state['suggested_price']}

{revision_context}
━━━ RULE 1 — PROFILE FIDELITY (most important rule) ━━━
The profile section above is the ONLY source of facts you may use.
Every claim, every technology reference, every project mention must point to something explicitly written in the profile.

If it is not in the profile — do not say it.

This means:
- Do not say "I've worked with similar systems in past projects" unless a specific project in the profile shows it
- Do not say "I have experience with queuing/databases" unless the profile explicitly shows it
- Do not imply breadth of experience beyond what the profile demonstrates
- One real, specific fact beats three vague claims every time

━━━ RULE 2 — GAP HANDLING ━━━
Genuine gaps: {missing_str}

For each gap, you must choose ONE of two options:

OPTION A — OMIT:
Use this when the gap is one of several requirements and omitting it won't feel dishonest.
Simply do not mention the skill. Do not draw attention to what's missing.

OPTION B — BRIDGE (one sentence only):
Use this ONLY when the skill is so central to the scope that omitting it would be dishonest.
Lead with the solution, not an admission. Use this exact formula:
  "For [gap skill], I'll use [specific tool or library] — [specific adjacent thing from the profile] means I can [concrete action] within the timeline."
The adjacent thing MUST exist in the profile above. Never open with "X is new to me" — the client needs to know it's handled, not that it's unfamiliar.
If you cannot find a specific line in the profile that supports the bridge, use OPTION A instead.

Never say "I've worked with similar systems in past projects" — this is vague and implies experience that isn't in the profile.

━━━ RULE 3 — ZERO AI SLOP ━━━
These phrases are banned. Any of them in the output = automatic rewrite:

Banned words/phrases:
"robust", "seamlessly", "actionable insights", "smooth delivery",
"scalable solution", "cutting-edge", "leverage" (as a verb),
"best practices", "state-of-the-art", "I am passionate about",
"I would love to", "I am confident that", "I am the perfect fit",
"proven track record", "deliver high quality", "I have extensive experience",
"look no further", "Thank you for your consideration",
"I look forward to hearing from you", "excited to work on",
"I specialize in" (unless followed by something extremely specific),
"directly applicable", "I bring", "a great fit", "strong background"

If you catch yourself about to write any of these — stop and replace with a specific fact from the profile.

━━━ RULE 4 — WRITING STANDARDS ━━━
- First person throughout: "I", "my", "I've" — never "the freelancer"
- First sentence must NOT start with "I"
- Never restate the job back to the client — they wrote it
- No paragraph longer than 3 sentences
- No exclamation marks, ever
- No bullet points or headers in the proposal itself
- Price stated once at the end — never justified, never apologised for
- Every sentence must do one of two things: build trust or advance the close
  If it does neither — delete it

━━━ STRUCTURE (five sections, no headers, plain paragraphs) ━━━

[HOOK — 1–2 sentences]
Identify the hardest or most overlooked part of what the client is trying to do.
Not the obvious thing — the thing that separates a freelancer who read carefully from one who skimmed.
Do not start with "I". Do not restate the job description.

[PROOF — 2–3 sentences]
Name one real project or experience from the profile that maps to the job scope.
Cite the actual technology and what it did. Be specific — name the project, name the tech, name the outcome.
Do not use vague language. If the evidence is thin, be brief rather than padded.

[APPROACH — 2–3 sentences]
How you would build this specific thing.
Reference their actual stack. Include one non-obvious technical detail that shows you've thought about it.
Only use confirmed matched skills here. If a gap skill is critical to mention, apply the BRIDGE formula — one sentence, real profile evidence only.

[QUESTION — 1 sentence]
One intelligent, specific question that reveals you read the job carefully and thought about the execution.
It must be answerable only by someone who has thought about their specific situation.
Not "Do you have any questions?" Not "What does success look like?"

[CLOSING — 2 sentences max]
State price and timeline directly. One concrete next step — suggest a call or ask if they want to move forward.
Nothing else. No filler. No sign-off phrases.

━━━ LENGTH ━━━
200–300 words. Do not pad to hit a word count.
A 200-word proposal with four specific facts beats a 320-word proposal with three vague ones."""

    response = llm.invoke([SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)])
    if hasattr(response, 'usage_metadata') and response.usage_metadata:
        log.debug("tokens", input=response.usage_metadata.get('input_tokens'), output=response.usage_metadata.get('output_tokens'))

    proposal_draft = response.content
    if isinstance(proposal_draft, list):
        proposal_draft = "".join(
            p.get("text", "") if isinstance(p, dict) else str(p)
            for p in proposal_draft
        )
    proposal_draft = proposal_draft.strip()

    log.info("generation_done", word_count=len(proposal_draft.split()))

    return {
        "proposal_draft":  proposal_draft,
        "iteration_count": iteration + 1,
    }
