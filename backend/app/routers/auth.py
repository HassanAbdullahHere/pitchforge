from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.jwt_utils import create_token
from app.models import User
from app.schemas import GoogleAuthRequest, TokenResponse, UserResponse

GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    request: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Verify a Google ID token from the frontend, upsert the user, return our JWT.

    Flow:
      1. Frontend (React) → Google OAuth → gets id_token
      2. Frontend POSTs id_token here
      3. We verify with Google's public keys (cached after first call)
      4. Upsert user row, return signed JWT
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            request.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {exc}",
        )

    google_id  = idinfo["sub"]
    email      = idinfo["email"]
    name       = idinfo.get("name", email)
    avatar_url = idinfo.get("picture")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if user:
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
    )
