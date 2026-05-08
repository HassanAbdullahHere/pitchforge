from dotenv import load_dotenv
load_dotenv()

from state import PitchforgeState
from nodes.analyzer import collect_job_input, analyze_job
from nodes.retriever import retrieve_profile
from nodes.scorer import score_fit
from nodes.fit_checkpoint import human_fit_checkpoint
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
    "should_apply": False,
    "human_approved": False
}

# Node 1
state.update(analyze_job(state))

# Node 2
state.update(retrieve_profile(state))

# Node 3
state.update(score_fit(state))

# Node 3.5 — Human checkpoint
state.update(human_fit_checkpoint(state))

if not state["should_apply"]:
    exit(0)

# Node 4
state.update(generate_proposal(state))

print("\n--- PROPOSAL DRAFT ---\n")
print(state["proposal_draft"])