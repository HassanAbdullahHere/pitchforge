from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.jwt_utils import ALGORITHM, SECRET_KEY, create_token, verify_token


def test_create_and_verify_roundtrip():
    token = create_token("user-123", "a@b.com")
    payload = verify_token(token)
    assert payload["sub"] == "user-123"
    assert payload["email"] == "a@b.com"


def test_token_contains_expected_claims():
    token = create_token("abc", "x@y.com")
    payload = verify_token(token)
    assert "exp" in payload and "iat" in payload


def test_expired_token_raises():
    payload = {"sub": "x", "exp": datetime.now(timezone.utc) - timedelta(seconds=1)}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    with pytest.raises(jwt.ExpiredSignatureError):
        verify_token(token)


def test_tampered_token_raises():
    token = create_token("user-123", "a@b.com") + "tampered"
    with pytest.raises(jwt.InvalidTokenError):
        verify_token(token)
