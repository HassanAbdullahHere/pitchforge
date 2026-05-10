from pitchforge.state import PitchforgeState


def compile_final(state: PitchforgeState) -> dict:
    """
    Node 7 — Final compiler.

    Reads: proposal_draft, job_analysis, suggested_price
    Writes: final_proposal
    """
    print("\n[Node 7] Compiling final proposal...")

    job = state["job_analysis"]
    draft = state["proposal_draft"]
    price = state.get("suggested_price", "")

    header = (
        f"=== PROPOSAL ===\n"
        f"Job: {job.get('title', 'N/A')}\n"
        f"Suggested Price: {price}\n"
        f"{'=' * 24}\n\n"
    )

    final_proposal = header + draft

    print("[Node 7] Final proposal compiled.")

    return {"final_proposal": final_proposal}
