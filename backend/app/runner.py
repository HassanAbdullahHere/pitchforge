import json
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

log = structlog.get_logger(__name__)

from pitchforge.guardrail import check_injection
from pitchforge.state import PitchforgeState

# Set during app lifespan in main.py once the PostgreSQL checkpointer is ready.
pitchforge_graph = None
from langgraph.types import Command
from app.models import Proposal


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


async def stream_analysis(job_input: dict, db: AsyncSession, user_id: uuid.UUID) -> AsyncGenerator[str, None]:
    thread_id = create_thread_id()
    config = _config(thread_id)

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(thread_id=thread_id, user_id=str(user_id))

    job_posting = (
        f"Job Title: {job_input.get('title', '')}\n"
        f"Description: {job_input.get('description', '')}\n"
        f"Budget: {job_input.get('budget', 'not mentioned')}\n"
        f"Timeline: {job_input.get('timeline', 'not mentioned')}\n"
        f"Experience Level: {job_input.get('level', 'not mentioned')}\n"
        f"Platform: {job_input.get('platform', 'not mentioned')}\n"
    )

    yield _sse("status", {"message": "Verifying request…"})
    if await check_injection(job_posting):
        yield _sse("error", {"message": "Request blocked."})
        return

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
        "user_id": str(user_id),
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
        log.exception("stream_analysis_failed", error=str(e))
        yield _sse("error", {"message": "Analysis failed. Please try again."})
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

    proposal = Proposal(
        thread_id=thread_id,
        user_id=user_id,
        job_title=job_input.get("title", ""),
        job_description=job_input.get("description", ""),
        platform=job_input.get("platform") or None,
        budget=job_input.get("budget") or None,
        timeline=job_input.get("timeline") or None,
        fit_score=fit_data["fit_score"],
        suggested_price=fit_data["suggested_price"],
        matched_skills=fit_data["matched_skills"],
        missing_skills=fit_data["missing_skills"],
        recommendation=fit_data["recommendation"],
    )
    db.add(proposal)
    await db.flush()

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
                node = event.get("metadata", {}).get("langgraph_node")
                if node == "generator":
                    chunk = event["data"].get("chunk")
                    if chunk and chunk.content:
                        content = chunk.content
                        if isinstance(content, str):
                            yield _sse("token", {"token": content})
                        elif isinstance(content, list):
                            for part in content:
                                if isinstance(part, dict) and part.get("type") == "text":
                                    yield _sse("token", {"token": part["text"]})

    except Exception as e:
        log.exception("stream_generation_failed", error=str(e))
        yield _sse("error", {"message": "Generation failed. Please try again."})
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


MAX_HUMAN_REVISIONS = 2


async def stream_revise(thread_id: str, feedback: str, db: AsyncSession) -> AsyncGenerator[str, None]:
    config = _config(thread_id)
    # human_checkpoint is the node being resumed FROM — suppress its completion
    # so the frontend doesn't show it as ticked at the start of a revision pass
    skip_first_human_complete = True

    try:
        async for event in pitchforge_graph.astream_events(
            Command(resume=feedback), config=config, version="v2"
        ):
            kind = event["event"]
            name = event.get("name", "")

            if kind == "on_chain_start" and name in GRAPH_NODES:
                yield _sse("node_start", {"node": name, "label": NODE_LABELS.get(name, name)})
            elif kind == "on_chain_end" and name in GRAPH_NODES:
                if name == "human_checkpoint" and skip_first_human_complete:
                    skip_first_human_complete = False
                    continue
                yield _sse("node_complete", {"node": name})
            elif kind == "on_chat_model_stream":
                node = event.get("metadata", {}).get("langgraph_node")
                if node == "generator":
                    chunk = event["data"].get("chunk")
                    if chunk and chunk.content:
                        content = chunk.content
                        if isinstance(content, str):
                            yield _sse("token", {"token": content})
                        elif isinstance(content, list):
                            for part in content:
                                if isinstance(part, dict) and part.get("type") == "text":
                                    yield _sse("token", {"token": part["text"]})

    except Exception as e:
        log.exception("stream_revise_failed", error=str(e))
        yield _sse("error", {"message": "Revision failed. Please try again."})
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


async def stream_finalize(thread_id: str, db: AsyncSession) -> AsyncGenerator[str, None]:
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
        log.exception("stream_finalize_failed", error=str(e))
        yield _sse("error", {"message": "Finalization failed. Please try again."})
        return

    snapshot = await pitchforge_graph.aget_state(config)
    values = snapshot.values

    final_proposal_text = values.get("final_proposal") or values.get("proposal_draft", "")

    result = await db.execute(select(Proposal).where(Proposal.thread_id == thread_id))
    proposal = result.scalar_one_or_none()
    if proposal is not None:
        proposal.final_proposal = final_proposal_text
        proposal.quality_score = values.get("quality_score", 0)
        proposal.iteration_count = values.get("iteration_count", 0)
        proposal.updated_at = datetime.now(timezone.utc)
        await db.flush()

    yield _sse("done", {"final_proposal": final_proposal_text})
