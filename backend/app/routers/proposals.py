from datetime import date, datetime, timezone
from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models import Proposal, User
from app.schemas import (
    FinalizeRequest,
    GenerateRequest,
    JobInputRequest,
    ProposalDetailResponse,
    ProposalHistoryItem,
    RefineRequest,
    UsageResponse,
)
from app.runner import (
    MAX_HUMAN_REVISIONS,
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
        .where(Proposal.user_id == current_user.id, Proposal.final_proposal.isnot(None))
        .order_by(Proposal.created_at.desc())
    )
    return result.scalars().all()


@router.get("/usage", response_model=UsageResponse)
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    count = await db.scalar(
        select(func.count(Proposal.id)).where(
            Proposal.user_id == current_user.id,
            Proposal.created_at >= today_start,
        )
    )
    return UsageResponse(used=count or 0, limit=7)


@router.get("s/{proposal_id}", response_model=ProposalDetailResponse)
async def get_proposal(
    proposal_id: PyUUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return proposal


@router.post("/analyze")
@limiter.limit("14/day")
async def analyze(
    request: Request,
    job: JobInputRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    count = await db.scalar(
        select(func.count(Proposal.id)).where(
            Proposal.user_id == current_user.id,
            Proposal.created_at >= today_start,
        )
    )
    if count >= 7:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily analysis limit reached. Please try again tomorrow.",
        )
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
    proposal = result.scalar_one_or_none()
    if proposal is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Thread not found or access denied",
        )
    # Atomic increment — prevents concurrent requests from bypassing the revision cap.
    # Uses a WHERE clause on the count so only one concurrent request can succeed per slot.
    updated = await db.execute(
        sql_update(Proposal)
        .where(Proposal.id == proposal.id, Proposal.revision_count < MAX_HUMAN_REVISIONS)
        .values(
            revision_count=Proposal.revision_count + 1,
            updated_at=datetime.now(timezone.utc),
        )
        .returning(Proposal.id)
    )
    if updated.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Revision limit reached ({MAX_HUMAN_REVISIONS} revisions per proposal)",
        )
    await db.flush()
    return StreamingResponse(
        stream_revise(body.thread_id, body.instruction, db),
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
