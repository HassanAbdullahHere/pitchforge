from state import PitchforgeState

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

    print("\n" + "=" * 50)
    print("  FIT SCORE REPORT")
    print("=" * 50)
    print(f"  Job      : {job.get('title', 'N/A')}")
    print(f"  Score    : {fit_score}/100")
    print(f"  Verdict  : {recommendation}")
    print(f"  Price    : {state['suggested_price']}")
    print("=" * 50)

    if fit_score < 40:
        print("Score too low — cancelling.")
        should_apply = False
    else:
        try:
            answer = input("\nGenerate proposal? [y/N]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = "n"

        should_apply = answer == "y"

        if should_apply:
            print("Proceeding to proposal generation...")
        else:
            print("Cancelled.")

    return {"should_apply": should_apply}
