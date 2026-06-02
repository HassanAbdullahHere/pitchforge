import logging

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.limiter import limiter, _get_user_id
from app.models import User, UserProfile
from app.schemas import ProfileInput, ProfileResponse
from app import profile_runner

logger = logging.getLogger(__name__)

router = APIRouter(tags=["profile"])

_MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/profile", response_model=ProfileResponse)
@limiter.limit("8/day")
@limiter.limit("4/day", key_func=_get_user_id)
async def save_profile(
    request: Request,
    data: ProfileInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    try:
        profile = await profile_runner.save_profile(current_user.id, data, db)
    except Exception as e:
        logger.exception("save_profile failed for user %s: %s", current_user.id, e)
        raise HTTPException(status_code=500, detail="Failed to save profile. Please try again.")
    return profile


@router.post("/profile/parse-resume")
@limiter.limit("4/day")
@limiter.limit("2/day", key_func=_get_user_id)
async def parse_resume_upload(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    filename = file.filename or ""
    if not (filename.lower().endswith(".pdf") or filename.lower().endswith(".docx")):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    content = await file.read()
    if len(content) > _MAX_RESUME_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5 MB.")

    try:
        parsed = await profile_runner.parse_resume(content, filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("parse_resume failed for user %s: %s", current_user.id, e)
        raise HTTPException(status_code=500, detail="Resume parsing failed. Please try again.")

    return {"parsed": parsed}
