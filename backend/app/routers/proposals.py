from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.deps import get_current_user
from app.models import User
from app.schemas import (
    FinalizeRequest,
    GenerateRequest,
    JobInputRequest,
    RefineRequest,
)
from app.runner import (
    stream_analysis,
    stream_finalize,
    stream_generation,
    stream_revise,
)

router = APIRouter(prefix="/proposal", tags=["proposals"])

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


@router.post("/analyze")
async def analyze(
    job: JobInputRequest,
    current_user: User = Depends(get_current_user),
):
    return StreamingResponse(
        stream_analysis(job.model_dump()),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/generate")
async def generate(
    body: GenerateRequest,
    current_user: User = Depends(get_current_user),
):
    return StreamingResponse(
        stream_generation(body.thread_id, body.should_apply),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/revise")
async def revise(
    body: RefineRequest,
    current_user: User = Depends(get_current_user),
):
    return StreamingResponse(
        stream_revise(body.thread_id, body.instruction),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/finalize")
async def finalize(
    body: FinalizeRequest,
    current_user: User = Depends(get_current_user),
):
    return StreamingResponse(
        stream_finalize(body.thread_id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
