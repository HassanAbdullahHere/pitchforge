from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_admin_user
from app.models import Proposal, UsageEvent, User
from app.schemas import (
    AdminStatsResponse, AdminPhaseBreakdown,
    AdminDailyCount, AdminDailyCost, AdminBucket,
    AdminPlatformBreakdown, AdminRecommendationBreakdown,
    AdminUserItem, AdminUserPatch,
)

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

    # --- Aggregate metrics ---
    avg_fit_raw = await db.scalar(select(func.avg(Proposal.fit_score)).where(Proposal.fit_score.isnot(None)))
    avg_quality_raw = await db.scalar(select(func.avg(Proposal.quality_score)).where(Proposal.quality_score.isnot(None)))
    avg_iter_raw = await db.scalar(select(func.avg(Proposal.iteration_count)).where(Proposal.iteration_count.isnot(None)))
    total_all = await db.scalar(select(func.count(Proposal.id))) or 0
    finalization_rate = (total_proposals / total_all) if total_all > 0 else 0.0
    total_revisions = await db.scalar(
        select(func.coalesce(func.sum(Proposal.revision_count), 0))
    ) or 0

    # --- Daily time-series (last 14 days, sparse — frontend zero-fills) ---
    daily_prop_rows = await db.execute(text("""
        SELECT DATE(created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS cnt
        FROM proposals
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day
    """))
    daily_proposals = [AdminDailyCount(date=str(r.day), count=r.cnt) for r in daily_prop_rows]

    daily_cost_rows = await db.execute(text("""
        SELECT DATE(created_at AT TIME ZONE 'UTC') AS day,
               ROUND(SUM(cost_usd)::numeric, 6) AS total
        FROM usage_events
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day
    """))
    daily_cost = [AdminDailyCost(date=str(r.day), cost_usd=float(r.total)) for r in daily_cost_rows]

    daily_signup_rows = await db.execute(text("""
        SELECT DATE(created_at AT TIME ZONE 'UTC') AS day, COUNT(*)::int AS cnt
        FROM users
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day
    """))
    daily_signups = [AdminDailyCount(date=str(r.day), count=r.cnt) for r in daily_signup_rows]

    # --- Distribution charts ---
    fit_rows = await db.execute(text("""
        SELECT
            CASE
                WHEN fit_score < 20 THEN '0-19'
                WHEN fit_score < 40 THEN '20-39'
                WHEN fit_score < 60 THEN '40-59'
                WHEN fit_score < 80 THEN '60-79'
                ELSE '80-100'
            END AS bucket,
            COUNT(*)::int AS cnt
        FROM proposals
        WHERE fit_score IS NOT NULL
        GROUP BY bucket
        ORDER BY MIN(fit_score)
    """))
    fit_score_dist = [AdminBucket(label=r.bucket, count=r.cnt) for r in fit_rows]

    rec_rows = await db.execute(
        select(Proposal.recommendation, func.count(Proposal.id).label("count"))
        .where(Proposal.final_proposal.isnot(None))
        .where(Proposal.recommendation.isnot(None))
        .group_by(Proposal.recommendation)
        .order_by(func.count(Proposal.id).desc())
    )
    recommendation_breakdown = [
        AdminRecommendationBreakdown(recommendation=r.recommendation, count=r.count)
        for r in rec_rows
    ]

    platform_rows = await db.execute(text("""
        SELECT COALESCE(platform, 'Unknown') AS platform, COUNT(*)::int AS count
        FROM proposals
        GROUP BY COALESCE(platform, 'Unknown')
        ORDER BY count DESC
    """))
    platform_breakdown = [
        AdminPlatformBreakdown(platform=r.platform, count=r.count)
        for r in platform_rows
    ]

    iter_rows = await db.execute(text("""
        SELECT
            CASE WHEN iteration_count >= 3 THEN '3+' ELSE iteration_count::text END AS bucket,
            COUNT(*)::int AS cnt
        FROM proposals
        WHERE iteration_count IS NOT NULL
        GROUP BY bucket
        ORDER BY MIN(iteration_count)
    """))
    iteration_dist = [AdminBucket(label=r.bucket, count=r.cnt) for r in iter_rows]

    return AdminStatsResponse(
        total_users=total_users,
        total_proposals=total_proposals,
        total_cost_usd=total_cost_usd,
        proposals_today=proposals_today,
        phase_breakdown=phase_breakdown,
        avg_fit_score=float(avg_fit_raw) if avg_fit_raw is not None else None,
        avg_quality_score=float(avg_quality_raw) if avg_quality_raw is not None else None,
        avg_iterations=float(avg_iter_raw) if avg_iter_raw is not None else None,
        finalization_rate=finalization_rate,
        total_revisions=total_revisions,
        daily_proposals=daily_proposals,
        daily_cost=daily_cost,
        daily_signups=daily_signups,
        fit_score_dist=fit_score_dist,
        recommendation_breakdown=recommendation_breakdown,
        platform_breakdown=platform_breakdown,
        iteration_dist=iteration_dist,
    )


@router.get("/users", response_model=list[AdminUserItem])
async def admin_list_users(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    proposal_count_sq = (
        select(func.count(Proposal.id))
        .where(Proposal.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    total_cost_sq = (
        select(func.coalesce(func.sum(UsageEvent.cost_usd), 0.0))
        .where(UsageEvent.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    rows = await db.execute(
        select(
            User.id,
            User.email,
            User.name,
            User.is_active,
            User.is_admin,
            User.created_at,
            User.last_login_at,
            proposal_count_sq.label("proposal_count"),
            total_cost_sq.label("total_cost_usd"),
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
