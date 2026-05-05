from dotenv import load_dotenv
load_dotenv()

from state import PitchforgeState
from nodes.analyzer import analyze_job

# Test Node 1 in isolation
test_state: PitchforgeState = {
    "job_posting": """
    Looking for a Python developer to build an AI chatbot for our e-commerce store.
    The bot should answer customer questions, track orders, and handle returns.
    Budget: $500-800. Timeline: 2 weeks. Need someone with FastAPI and LLM experience.
    """,
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

result = analyze_job(test_state)
import json
print(json.dumps(result["job_analysis"], indent=2))