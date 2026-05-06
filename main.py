from dotenv import load_dotenv
load_dotenv()

from state import PitchforgeState
from nodes.analyzer import collect_job_input, analyze_job
from nodes.retriever import retrieve_profile
import json

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

print("\n--- PROFILE MATCHES ---")
for i, match in enumerate(state["profile_matches"]):
    print(f"\n{i+1}. {match}")