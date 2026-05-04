from typing import TypedDict, Optional

class PitchforgeState(TypedDict):
    # Input
    job_posting: str              # raw job text or scraped from URL
    job_analysis: dict            # structured breakdown after analysis

    # RAG
    profile_matches: list         # relevant experience retrieved from ChromaDB

    # Research
    client_info: Optional[str]    # only if client is identifiable

    # Generation loop
    proposal_draft: str           # current proposal draft
    critic_feedback: str          # feedback from critic node
    iteration_count: int          # tracks how many times we've looped
    quality_score: int            # critic scores the draft 0-100

    # Output
    fit_score: int                # how well job matches your profile
    suggested_price: str          # pricing recommendation
    clarifying_questions: list    # questions to ask the client
    final_proposal: str           # approved final proposal

    # Control
    human_approved: bool          # has human approved the draft