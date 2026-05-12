from pitchforge.state import PitchforgeState


def compile_final(state: PitchforgeState) -> dict:
    """
    Node 7 — Final compiler.

    Reads: proposal_draft, job_analysis, suggested_price
    Writes: final_proposal
    """
    print("\n[Node 7] Compiling final proposal...")

    draft = state["proposal_draft"]

    print("[Node 7] Final proposal compiled.")

    return {"final_proposal": draft}
