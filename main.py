from dotenv import load_dotenv
load_dotenv()

from state import PitchforgeState
from nodes.analyzer import collect_job_input, analyze_job
from nodes.retriever import retrieve_profile
from nodes.scorer import score_fit, should_continue
from nodes.generator import generate_proposal

job_text = collect_job_input()

state: PitchforgeState = {
    "job_posting": job_text,
    "job_analysis": {},
    "profile_matches": [],
    "client_info": None,
    "proposal_draft": "",
    "critic_feedback": "",
    "iteration_count": 0,
    "quality_score": 0,
    "fit_score": 0,
    "suggested_price": "",
    "clarifying_questions": [],
    "final_proposal": "",
    "human_approved": False
}

# Node 1
state.update(analyze_job(state))

# Node 2
state.update(retrieve_profile(state))

# Node 3
state.update(score_fit(state))

# Conditional edge — only continue if fit_score is above threshold
decision = should_continue(state)
if decision == "low_fit":
    print(f"\n✗ Low fit ({state['fit_score']}/100) — not recommended.")
else:
    print(f"\n✓ Good fit ({state['fit_score']}/100) — generating proposal...")

    # Node 4
    state.update(generate_proposal(state))

    print("\n--- PROPOSAL DRAFT ---\n")
    print(state["proposal_draft"])