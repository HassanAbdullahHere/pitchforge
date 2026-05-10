from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from backend.app.schemas import (
    JobInputRequest,
    GenerateRequest,
    RefineRequest,
    FinalizeRequest,
)
from backend.app.runner import (
    stream_analysis,
    stream_generation,
    stream_revise,
    stream_finalize,
)

router = APIRouter(prefix="/proposal", tags=["proposals"])

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.post("/analyze")
async def analyze(job: JobInputRequest):
    return StreamingResponse(
        stream_analysis(job.model_dump()),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/generate")
async def generate(body: GenerateRequest):
    return StreamingResponse(
        stream_generation(body.thread_id, body.should_apply),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/revise")
async def revise(body: RefineRequest):
    return StreamingResponse(
        stream_revise(body.thread_id, body.instruction),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/finalize")
async def finalize(body: FinalizeRequest):
    return StreamingResponse(
        stream_finalize(body.thread_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
