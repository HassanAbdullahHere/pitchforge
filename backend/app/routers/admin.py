from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_admin_user
from app.models import Proposal, UsageEvent, User
from app.schemas import AdminStatsResponse, AdminPhaseBreakdown, AdminUserItem, AdminUserPatch

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    total_users = await db.scalar(select(func.count(User.id))) or 0
    total_proposals = await db.scalar(
        select(func.count(Proposal.id)).where(Proposal.final_proposal.isnot(None))
    ) or 0
    total_cost_usd = await db.scalar(select(func.sum(UsageEvent.cost_usd))) or 0.0
    proposals_today = await db.scalar(
        select(func.count(Proposal.id)).where(Proposal.created_at >= today_start)
    ) or 0

    phase_rows = await db.execute(
        select(
            UsageEvent.phase,
            func.sum(UsageEvent.input_tokens).label("total_input"),
            func.sum(UsageEvent.output_tokens).label("total_output"),
            func.sum(UsageEvent.cost_usd).label("total_cost"),
        ).group_by(UsageEvent.phase).order_by(UsageEvent.phase)
    )
    phase_breakdown = [
        AdminPhaseBreakdown(
            phase=row.phase,
            total_input_tokens=row.total_input or 0,
            total_output_tokens=row.total_output or 0,
            total_cost_usd=row.total_cost or 0.0,
        )
        for row in phase_rows
    ]

    return AdminStatsResponse(
        total_users=total_users,
        total_proposals=total_proposals,
        total_cost_usd=total_cost_usd,
        proposals_today=proposals_today,
        phase_breakdown=phase_breakdown,
    )


@router.get("/users", response_model=list[AdminUserItem])
async def admin_list_users(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(
            User.id,
            User.email,
            User.name,
            User.is_active,
            User.is_admin,
            User.created_at,
            User.last_login_at,
            func.count(Proposal.id).label("proposal_count"),
            func.coalesce(func.sum(UsageEvent.cost_usd), 0.0).label("total_cost_usd"),
        )
        .outerjoin(Proposal, Proposal.user_id == User.id)
        .outerjoin(UsageEvent, UsageEvent.user_id == User.id)
        .group_by(
            User.id, User.email, User.name, User.is_active,
            User.is_admin, User.created_at, User.last_login_at,
        )
        .order_by(User.created_at.desc())
    )
    return [
        AdminUserItem(
            id=row.id,
            email=row.email,
            name=row.name,
            is_active=row.is_active,
            is_admin=row.is_admin,
            created_at=row.created_at,
            last_login_at=row.last_login_at,
            proposal_count=row.proposal_count,
            total_cost_usd=float(row.total_cost_usd),
        )
        for row in rows
    ]


@router.patch("/users/{user_id}", response_model=AdminUserItem)
async def admin_patch_user(
    user_id: PyUUID,
    body: AdminUserPatch,
    admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own status")

    user.is_active = body.is_active
    await db.flush()

    proposal_count = await db.scalar(
        select(func.count(Proposal.id)).where(Proposal.user_id == user.id)
    ) or 0
    total_cost_usd = await db.scalar(
        select(func.coalesce(func.sum(UsageEvent.cost_usd), 0.0)).where(UsageEvent.user_id == user.id)
    ) or 0.0

    return AdminUserItem(
        id=user.id,
        email=user.email,
        name=user.name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        proposal_count=proposal_count,
        total_cost_usd=float(total_cost_usd),
    )
