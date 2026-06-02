import structlog
from langgraph.types import interrupt
from pitchforge.state import PitchforgeState

log = structlog.get_logger(__name__)


def human_fit_checkpoint(state: PitchforgeState) -> dict:
    """
    Node 3.5 — Human-in-the-loop checkpoint after fit scoring.

    Reads:  state["fit_score"], state["suggested_price"], state["job_analysis"]
    Writes: state["should_apply"]
    """
    fit_score = state["fit_score"]
    job = state["job_analysis"]

    if fit_score >= 80:
        recommendation = "Strong match — definitely apply"
    elif fit_score >= 60:
        recommendation = "Good match — worth applying"
    elif fit_score >= 40:
        recommendation = "Partial match — apply carefully"
    else:
        recommendation = "Poor match — not recommended"

    log.info(
        "fit_report",
        title=job.get("title", "N/A"),
        fit_score=fit_score,
        recommendation=recommendation,
        suggested_price=state["suggested_price"],
    )

    if fit_score < 40:
        log.info("fit_cancelled", fit_score=fit_score)
        return {"should_apply": False}

    answer = interrupt({
        "fit_score": fit_score,
        "recommendation": recommendation,
        "suggested_price": state["suggested_price"],
        "prompt": "Generate proposal? [y/N]: ",
    })

    should_apply = str(answer).strip().lower() == "y"

    if should_apply:
        log.info("fit_approved")
    else:
        log.info("fit_declined")

    return {"should_apply": should_apply}
