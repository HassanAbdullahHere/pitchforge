import json
import uuid
from typing import AsyncGenerator

from pitchforge.graph import pitchforge_graph
from pitchforge.state import PitchforgeState
from langgraph.types import Command


GRAPH_NODES = {
    "analyzer", "retriever", "scorer", "fit_checkpoint",
    "generator", "critic", "human_checkpoint", "compiler",
}

NODE_LABELS = {
    "analyzer": "Analyzing job posting",
    "retriever": "Retrieving profile matches",
    "scorer": "Scoring job fit",
    "fit_checkpoint": "Fit checkpoint",
    "generator": "Generating proposal",
    "critic": "Critiquing draft",
    "human_checkpoint": "Human checkpoint",
    "compiler": "Compiling final proposal",
}


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


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def stream_analysis(job_input: dict) -> AsyncGenerator[str, None]:
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
        "human_feedback": "",
        "is_human_revision": False,
    }

    try:
        async for event in pitchforge_graph.astream_events(
            initial_state, config=config, version="v2"
        ):
            kind = event["event"]
            name = event.get("name", "")

            if kind == "on_chain_start" and name in GRAPH_NODES:
                yield _sse("node_start", {"node": name, "label": NODE_LABELS.get(name, name)})
            elif kind == "on_chain_end" and name in GRAPH_NODES:
                yield _sse("node_complete", {"node": name})

    except Exception as e:
        yield _sse("error", {"message": str(e)})
        return

    snapshot = await pitchforge_graph.aget_state(config)
    values = snapshot.values
    fit_score = values.get("fit_score", 0)
    fit_data = {
        "thread_id": thread_id,
        "fit_score": fit_score,
        "suggested_price": values.get("suggested_price", ""),
        "matched_skills": values.get("matched_skills", []),
        "missing_skills": values.get("missing_skills", []),
        "recommendation": _recommendation(fit_score),
    }

    yield _sse("interrupt", {"type": "fit_checkpoint", **fit_data})
    yield _sse("done", fit_data)


async def stream_generation(thread_id: str, should_apply: bool) -> AsyncGenerator[str, None]:
    config = _config(thread_id)
    answer = "y" if should_apply else "n"

    try:
        async for event in pitchforge_graph.astream_events(
            Command(resume=answer), config=config, version="v2"
        ):
            kind = event["event"]
            name = event.get("name", "")

            if kind == "on_chain_start" and name in GRAPH_NODES:
                yield _sse("node_start", {"node": name, "label": NODE_LABELS.get(name, name)})
            elif kind == "on_chain_end" and name in GRAPH_NODES:
                yield _sse("node_complete", {"node": name})
            elif kind == "on_chat_model_stream":
                chunk = event["data"].get("chunk")
                if chunk and chunk.content:
                    yield _sse("token", {"token": chunk.content})

    except Exception as e:
        yield _sse("error", {"message": str(e)})
        return

    if not should_apply:
        yield _sse("done", {"proposal_draft": "", "quality_score": 0,
                            "critic_feedback": None, "iteration_count": 0})
        return

    snapshot = await pitchforge_graph.aget_state(config)
    values = snapshot.values
    proposal_data = {
        "proposal_draft": values.get("proposal_draft", ""),
        "quality_score": values.get("quality_score", 0),
        "critic_feedback": values.get("critic_feedback") or None,
        "iteration_count": values.get("iteration_count", 0),
    }

    yield _sse("interrupt", {"type": "human_checkpoint"})
    yield _sse("done", proposal_data)


async def stream_revise(thread_id: str, feedback: str) -> AsyncGenerator[str, None]:
    config = _config(thread_id)

    try:
        async for event in pitchforge_graph.astream_events(
            Command(resume=feedback), config=config, version="v2"
        ):
            kind = event["event"]
            name = event.get("name", "")

            if kind == "on_chain_start" and name in GRAPH_NODES:
                yield _sse("node_start", {"node": name, "label": NODE_LABELS.get(name, name)})
            elif kind == "on_chain_end" and name in GRAPH_NODES:
                yield _sse("node_complete", {"node": name})
            elif kind == "on_chat_model_stream":
                chunk = event["data"].get("chunk")
                if chunk and chunk.content:
                    yield _sse("token", {"token": chunk.content})

    except Exception as e:
        yield _sse("error", {"message": str(e)})
        return

    snapshot = await pitchforge_graph.aget_state(config)
    values = snapshot.values
    proposal_data = {
        "proposal_draft": values.get("proposal_draft", ""),
        "quality_score": values.get("quality_score", 0),
        "critic_feedback": values.get("critic_feedback") or None,
        "iteration_count": values.get("iteration_count", 0),
    }

    yield _sse("interrupt", {"type": "human_checkpoint"})
    yield _sse("done", proposal_data)


async def stream_finalize(thread_id: str) -> AsyncGenerator[str, None]:
    config = _config(thread_id)

    try:
        async for event in pitchforge_graph.astream_events(
            Command(resume="y"), config=config, version="v2"
        ):
            kind = event["event"]
            name = event.get("name", "")

            if kind == "on_chain_start" and name in GRAPH_NODES:
                yield _sse("node_start", {"node": name, "label": NODE_LABELS.get(name, name)})
            elif kind == "on_chain_end" and name in GRAPH_NODES:
                yield _sse("node_complete", {"node": name})

    except Exception as e:
        yield _sse("error", {"message": str(e)})
        return

    snapshot = await pitchforge_graph.aget_state(config)
    values = snapshot.values

    yield _sse("done", {
        "final_proposal": values.get("final_proposal") or values.get("proposal_draft", ""),
    })
