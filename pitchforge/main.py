from dotenv import load_dotenv
load_dotenv()

from pitchforge.nodes.analyzer import collect_job_input
from pitchforge.graph import pitchforge_graph
from langgraph.types import Command


def main():
    job_posting = collect_job_input()

    initial_state = {
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
        "human_feedback": "",
        "is_human_revision": False,
    }

    config = {"configurable": {"thread_id": "pitchforge-1"}}

    pitchforge_graph.invoke(initial_state, config=config)

    while True:
        graph_state = pitchforge_graph.get_state(config)
        if not graph_state.next:
            break

        answer = "n"
        for task in graph_state.tasks:
            if task.interrupts:
                prompt = task.interrupts[0].value.get("prompt", "Continue? [y/N]: ")
                try:
                    answer = input(f"\n{prompt}").strip().lower()
                except (EOFError, KeyboardInterrupt):
                    answer = "n"
                break

        pitchforge_graph.invoke(Command(resume=answer), config=config)


if __name__ == "__main__":
    main()
