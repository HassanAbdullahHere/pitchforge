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
        "prompt": "Approve this proposal? [y/N]: ",
    })

    human_approved = str(answer).strip().lower() == "y"

    if human_approved:
        print("Proposal approved — compiling final output...")
    else:
        print("Proposal rejected — ending pipeline.")

    return {"human_approved": human_approved}
