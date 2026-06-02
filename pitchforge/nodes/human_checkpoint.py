import structlog
from langgraph.types import interrupt
from pitchforge.state import PitchforgeState

log = structlog.get_logger(__name__)


def human_proposal_checkpoint(state: PitchforgeState) -> dict:
    """
    Node 6 — Human checkpoint after critic passes the proposal.

    Reads: proposal_draft, quality_score, job_analysis, iteration_count
    Writes: human_approved
    """
    quality_score = state["quality_score"]
    job = state["job_analysis"]
    iteration = state["iteration_count"]
    draft = state["proposal_draft"]

    log.info(
        "proposal_ready",
        title=job.get("title", "N/A"),
        quality_score=quality_score,
        iteration=iteration,
    )

    answer = interrupt({
        "proposal_draft": draft,
        "quality_score": quality_score,
        "prompt": "Approve? Enter 'y' to approve, or type feedback to request changes: ",
    })

    answer_str = str(answer).strip()

    if answer_str.lower() == "y":
        log.info("proposal_approved")
        return {"human_approved": True}

    log.info("revision_requested")
    return {
        "human_approved": False,
        "human_feedback": answer_str,
        "is_human_revision": True,
    }
