import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pitchforge.state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    streaming=True,
)

def generate_proposal(state: PitchforgeState) -> dict:
    """
    Node 4 — Generate proposal draft.

    Reads: job_analysis, profile_matches, fit_score, 
           suggested_price, critic_feedback, iteration_count
    Writes: proposal_draft, iteration_count
    """

    iteration = state["iteration_count"]
    print(f"\n[Node 4] Generating proposal draft (iteration {iteration + 1})...")

    job = state["job_analysis"]
    profile = "\n".join(state["profile_matches"])
    critic_feedback = state["critic_feedback"]
    human_feedback = state.get("human_feedback", "")

    revision_context = ""
    if human_feedback:
        revision_context = f"""
HUMAN REVIEWER REQUESTED CHANGES — apply these precisely:
{human_feedback}
"""
    elif critic_feedback:
        revision_context = f"""
PREVIOUS DRAFT WAS REJECTED. Specific feedback to address:
{critic_feedback}

Fix these issues in the new draft. Don't repeat the same mistakes.
"""

    prompt = f"""
You are a world-class freelance proposal writer. Your job is to write a proposal 
that wins the contract — not one that lists credentials.

Write entirely in first person — use "I", "my", "I've".
Never refer to yourself by name or in third person.
Never use phrases like "the freelancer" or any third-person reference.

THE CARDINAL RULES:
- The first sentence must not start with "I"
- Never restate the job back to the client — they wrote it, they know it
- Every claim must be backed by specific evidence from the profile
- No paragraph longer than 3 sentences
- No exclamation marks anywhere
- Never apologize for or justify the price — state it once, confidently
- The proposal must feel written for THIS specific job, not templated

JOB DETAILS:
Title: {job.get('title')}
Skills required: {', '.join(job.get('skills_required', []))}
Scope: {job.get('scope')}
Budget: {job.get('budget')}
Timeline: {job.get('timeline')}
Experience level: {job.get('experience_level')}

Freelancer's RELEVANT EXPERIENCE:
{profile}

SUGGESTED PRICE: {state['suggested_price']}

{revision_context}

PROPOSAL STRUCTURE — follow this exactly:

[HOOK — 1-2 sentences]
Open with the client's core problem or goal, not your introduction.
Make them feel you immediately understand what they actually need.
Example approach: "Getting a FastAPI app production-ready on EC2 
involves more than just running uvicorn — the Nginx config, 
process management, and SSL setup are where most deployments 
break down."
Do not copy this example. Write one specific to this job.

[PROOF — 2-3 sentences]
One specific, concrete piece of evidence from freelancer's experience 
that directly matches the job scope.
Name real technologies, real outcomes. No vague claims.
Bad: "I have extensive experience with AWS"
Good: "I've deployed and managed Nginx + PM2 on EC2 for Node.js 
and FastAPI apps, including setting up reverse proxy configs 
and systemd service files for auto-restart"

[APPROACH — 2-3 sentences]
How you would tackle THIS specific project.
Reference the actual stack they mentioned.
Show you've thought about their situation — not a generic process.
Include one specific technical detail that signals competence.

[QUESTION — 1 sentence]
One focused, intelligent question about something genuinely unclear 
in the job that would affect how you approach it.
This shows you read carefully and think ahead.
Bad: "Do you have any questions for me?"
Good: "Is the app currently running with gunicorn or uvicorn, 
and do you have a preference for the process manager?"

[CLOSING — 2-3 sentences]
State the price and timeline once, directly.
End with a low-friction call to action — suggest a brief call 
or ask if they want to move forward.
No "I look forward to hearing from you."
No "Thank you for your consideration."

TARGET LENGTH: 250-320 words maximum.
Shorter than this is better than longer.
Every sentence must either build credibility or move them toward hiring.
If a sentence does neither — cut it.
"""

    response = llm.invoke([HumanMessage(content=prompt)])

    proposal_draft = response.content.strip()

    print(f"[Node 4] Draft generated ({len(proposal_draft.split())} words)")

    return {
        "proposal_draft": proposal_draft,
        # Increment iteration count — critic uses this to prevent infinite loop
        "iteration_count": iteration + 1
    }