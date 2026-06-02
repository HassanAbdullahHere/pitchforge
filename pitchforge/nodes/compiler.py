import structlog
from pitchforge.state import PitchforgeState

log = structlog.get_logger(__name__)


def compile_final(state: PitchforgeState) -> dict:
    """
    Node 7 — Final compiler.

    Reads: proposal_draft, job_analysis, suggested_price
    Writes: final_proposal
    """
    log.info("compile_start")
    draft = state["proposal_draft"]
    log.info("compile_done")
    return {"final_proposal": draft}
