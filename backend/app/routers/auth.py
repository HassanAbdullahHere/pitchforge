from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.jwt_utils import create_token
from app.limiter import limiter
from app.models import User
from app.schemas import GoogleAuthRequest, TokenResponse, UserResponse

GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/hour")
async def google_auth(
    request: Request,
    body: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Verify a Google OAuth2 access_token, upsert the user, return our JWT.

    Flow:
      1. Frontend gets access_token from useGoogleLogin() hook
      2. Frontend POSTs access_token here
      3. We call Google's userinfo endpoint to verify + get user details
      4. Upsert user row, return our signed JWT
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {body.access_token}"},
            )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Google authentication service timed out",
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google access token",
        )

    idinfo = resp.json()

    google_id  = idinfo["sub"]
    email      = idinfo["email"]
    name       = idinfo.get("name", email)
    avatar_url = idinfo.get("picture")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if user:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="account_blocked",
            )
        user.last_login_at = now
    else:
        user = User(
            google_id=google_id,
            email=email,
            name=name,
            avatar_url=avatar_url,
            last_login_at=now,
        )
        db.add(user)

    await db.flush()  # assigns user.id before we read it
    token = create_token(str(user.id), user.email)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """
    Returns the authenticated user's profile.
    Frontend calls this on page load to restore session from localStorage token.
    """
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        is_admin=current_user.is_admin,
    )
