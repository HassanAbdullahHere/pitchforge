import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from pitchforge.state import PitchforgeState

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY")
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

    # If this is a revision — include critic feedback in prompt
    # This is what makes the loop intelligent
    # First pass: generate fresh
    # Subsequent passes: fix specific weaknesses
    revision_context = ""
    if critic_feedback:
        revision_context = f"""
PREVIOUS DRAFT WAS REJECTED. Specific feedback to address:
{critic_feedback}

Fix these issues in the new draft. Don't repeat the same mistakes.
"""

    prompt = f"""
You are writing an Upwork proposal for a freelancer named Hassan.

TONE: Confident, direct, and human. Write like a senior professional reaching out —
not eager, not salesy. Short sentences. No filler. No corporate speak.
Avoid: "I am passionate about", "I would love to help", "I am the perfect fit",
"look no further", or any variation of these clichés.

JOB DETAILS:
Title: {job.get('title')}
Skills required: {', '.join(job.get('skills_required', []))}
Scope: {job.get('scope')}
Budget: {job.get('budget')}
Timeline: {job.get('timeline')}
Experience level: {job.get('experience_level')}

FREELANCER'S RELEVANT EXPERIENCE:
{profile}

SUGGESTED PRICE: {state['suggested_price']}

{revision_context}

Write a proposal with this exact structure:

1. Greeting like a human
2. Opening hook — one sentence that references something specific about THIS job
   (not generic praise, not "I saw your posting")
3. Relevant experience — 2-3 sentences of specific past work or skills that directly
   match what they need; cite real projects or technologies from the profile
4. Approach — 2-3 sentences on how you would tackle this project specifically
5. Closing — state the suggested price naturally in a sentence, then one short line
   inviting them to chat (no exclamation marks)

Keep it under 400-500 words. Every sentence must earn its place.
"""

    response = llm.invoke([HumanMessage(content=prompt)])

    proposal_draft = response.content.strip()

    print(f"[Node 4] Draft generated ({len(proposal_draft.split())} words)")

    return {
        "proposal_draft": proposal_draft,
        # Increment iteration count — critic uses this to prevent infinite loop
        "iteration_count": iteration + 1
    }