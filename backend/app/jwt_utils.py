from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt

SECRET_KEY = os.environ["JWT_SECRET_KEY"]
ALGORITHM = "HS256"
EXPIRE_DAYS = 7


def create_token(user_id: str, email: str) -> str:
    """Create a signed JWT valid for EXPIRE_DAYS days."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(days=EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    """
    Decode and verify a JWT. Raises jwt.ExpiredSignatureError or
    jwt.InvalidTokenError on failure — callers must handle these.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
