import uuid

from pitchforge.graph import pitchforge_graph
from pitchforge.state import PitchforgeState
from langgraph.types import Command


def create_thread_id() -> str:
    return str(uuid.uuid4())


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _recommendation(fit_score: int) -> str:
    if fit_score >= 70:
        return "Strong Apply"
    if fit_score >= 40:
        return "Apply Carefully"
    return "Not Recommended"


def run_analysis(job_input: dict) -> dict:
    """
    Starts a new thread, invokes the graph from the beginning, and runs
    until the fit_checkpoint interrupt fires.

    Returns fit report data extracted from state.
    """
    thread_id = create_thread_id()
    config = _config(thread_id)

    job_posting = (
        f"Job Title: {job_input.get('title', '')}\n"
        f"Description: {job_input.get('description', '')}\n"
        f"Budget: {job_input.get('budget', 'not mentioned')}\n"
        f"Timeline: {job_input.get('timeline', 'not mentioned')}\n"
        f"Experience Level: {job_input.get('level', 'not mentioned')}\n"
        f"Platform: {job_input.get('platform', 'not mentioned')}\n"
    )

    initial_state: PitchforgeState = {
        "job_posting": job_posting,
        "job_analysis": {},
        "profile_matches": [],
        "client_info": None,
        "proposal_draft": "",
        "critic_feedback": "",
        "iteration_count": 0,
        "quality_score": 0,
        "fit_score": 0,
        "suggested_price": "",
        "matched_skills": [],
        "missing_skills": [],
        "clarifying_questions": [],
        "final_proposal": "",
        "should_apply": False,
        "human_approved": False,
    }

    pitchforge_graph.invoke(initial_state, config=config)

    snapshot = pitchforge_graph.get_state(config)
    values = snapshot.values

    fit_score = values.get("fit_score", 0)

    return {
        "thread_id": thread_id,
        "fit_score": fit_score,
        "suggested_price": values.get("suggested_price", ""),
        "matched_skills": values.get("matched_skills", []),
        "missing_skills": values.get("missing_skills", []),
        "recommendation": _recommendation(fit_score),
    }


def run_generation(thread_id: str, should_apply: bool) -> dict:
    """
    Resumes from the fit_checkpoint interrupt with the user's apply decision.
    Runs until the human_checkpoint interrupt (or END if should_apply is False).

    Returns the proposal state ready for human review.
    """
    config = _config(thread_id)
    answer = "y" if should_apply else "n"

    pitchforge_graph.invoke(Command(resume=answer), config=config)

    snapshot = pitchforge_graph.get_state(config)
    values = snapshot.values

    return {
        "proposal_draft": values.get("proposal_draft", ""),
        "quality_score": values.get("quality_score", 0),
        "critic_feedback": values.get("critic_feedback") or None,
        "iteration_count": values.get("iteration_count", 0),
    }


def run_finalize(thread_id: str) -> dict:
    """
    Resumes from the human_checkpoint interrupt with approval.
    Runs to END.

    Returns the final compiled proposal.
    """
    config = _config(thread_id)

    pitchforge_graph.invoke(Command(resume="y"), config=config)

    snapshot = pitchforge_graph.get_state(config)
    values = snapshot.values

    return {
        "final_proposal": values.get("final_proposal", values.get("proposal_draft", "")),
    }
