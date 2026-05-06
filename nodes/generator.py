import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from state import PitchforgeState

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
You are writing an Upwork proposal for a freelancer.
Write in first person, professional but conversational tone.
Sound like a real human — not a template.

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

Write a proposal with this structure:
1. Opening hook — reference something specific about the job (not generic)
2. Why I'm the right fit — use specific experience from the profile above as evidence
3. My approach — briefly how I would tackle this project
4. Relevant experience — mention specific projects or skills that match
5. Closing — include suggested price, invite them to discuss

Keep it under 300 words. Be specific. Avoid clichés like 
"I am passionate about" or "I would love to help".
"""

    response = llm.invoke([HumanMessage(content=prompt)])

    proposal_draft = response.content.strip()

    print(f"[Node 4] Draft generated ({len(proposal_draft.split())} words)")

    return {
        "proposal_draft": proposal_draft,
        # Increment iteration count — critic uses this to prevent infinite loop
        "iteration_count": iteration + 1
    }