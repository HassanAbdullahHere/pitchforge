from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Proposal, User
from app.schemas import (
    FinalizeRequest,
    GenerateRequest,
    JobInputRequest,
    ProposalHistoryItem,
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


@router.get("s", response_model=list[ProposalHistoryItem])
async def list_proposals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal)
        .where(Proposal.user_id == current_user.id)
        .order_by(Proposal.created_at.desc())
    )
    return result.scalars().all()


@router.post("/analyze")
async def analyze(
    job: JobInputRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return StreamingResponse(
        stream_analysis(job.model_dump(), db, current_user.id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/generate")
async def generate(
    body: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal).where(
            Proposal.thread_id == body.thread_id,
            Proposal.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Thread not found or access denied",
        )
    return StreamingResponse(
        stream_generation(body.thread_id, body.should_apply),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/revise")
async def revise(
    body: RefineRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal).where(
            Proposal.thread_id == body.thread_id,
            Proposal.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Thread not found or access denied",
        )
    return StreamingResponse(
        stream_revise(body.thread_id, body.instruction),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@router.post("/finalize")
async def finalize(
    body: FinalizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Proposal).where(
            Proposal.thread_id == body.thread_id,
            Proposal.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Thread not found or access denied",
        )
    return StreamingResponse(
        stream_finalize(body.thread_id, db),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )
