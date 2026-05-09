from langgraph.types import interrupt
from pitchforge.state import PitchforgeState


def human_proposal_checkpoint(state: PitchforgeState) -> dict:
    """
    Node 6 — Human checkpoint after critic passes the proposal.

    Reads: proposal_draft, quality_score, job_analysis, iteration_count
    Writes: human_approved
    """
    draft = state["proposal_draft"]
    quality_score = state["quality_score"]
    job = state["job_analysis"]
    iteration = state["iteration_count"]

    print("\n" + "=" * 60)
    print("  PROPOSAL READY FOR REVIEW")
    print("=" * 60)
    print(f"  Job        : {job.get('title', 'N/A')}")
    print(f"  Quality    : {quality_score}/100")
    print(f"  Iterations : {iteration}")
    print("=" * 60)
    print("\n--- PROPOSAL DRAFT ---\n")
    print(draft)
    print("\n" + "-" * 60)

    answer = interrupt({
        "proposal_draft": draft,
        "quality_score": quality_score,
        "prompt": "Approve? Enter 'y' to approve, or type feedback to request changes: ",
    })

    answer_str = str(answer).strip()

    if answer_str.lower() == "y":
        print("Proposal approved — compiling final output...")
        return {"human_approved": True}

    print(f"Revision requested — routing back to generator...")
    return {
        "human_approved": False,
        "human_feedback": answer_str,
        "is_human_revision": True,
    }
