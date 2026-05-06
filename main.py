from dotenv import load_dotenv
load_dotenv()

from state import PitchforgeState
from nodes.analyzer import collect_job_input, analyze_job
import json

# Collect input from CLI
job_text = collect_job_input()

# Build initial state
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

# Run Node 1
result = analyze_job(state)
print("\n--- JOB ANALYSIS ---")
print(json.dumps(result["job_analysis"], indent=2))