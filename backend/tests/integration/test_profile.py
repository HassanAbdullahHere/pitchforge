from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models import UserProfile
from tests.conftest import auth

_VALID_PAYLOAD = {
    "title": "Backend Developer",
    "bio": "I build scalable APIs and backend systems.",
    "skills": ["Python", "FastAPI"],
    "rates": {"hourly_min": 0, "hourly_max": 0, "fixed_min": 0},
}


def _fake_user_profile(user_id, title="Backend Developer"):
    now = datetime.now(timezone.utc)
    return UserProfile(
        user_id=user_id,
        title=title,
        bio="I build scalable APIs and backend systems.",
        skills=["Python", "FastAPI"],
        projects=[],
        experience=[],
        niches=[],
        rates={"hourly_min": 0, "hourly_max": 0, "fixed_min": 0},
        created_at=now,
        updated_at=now,
    )


# ── GET /api/profile ──────────────────────────────────────────────────────────

async def test_get_profile_404_when_no_profile(client, make_user):
    user = await make_user(email="prof-404@test.com", google_id="gid-prof-404")
    resp = await client.get("/api/profile", headers=auth(user))
    assert resp.status_code == 404


async def test_get_profile_unauthenticated_returns_401(client):
    resp = await client.get("/api/profile")
    assert resp.status_code == 401


async def test_get_profile_returns_200_with_data(client, make_user, db):
    user = await make_user(email="prof-ok@test.com", google_id="gid-prof-ok")
    now = datetime.now(timezone.utc)
    db.add(UserProfile(
        user_id=user.id,
        title="Dev",
        bio="I write code.",
        skills=["Python"],
        projects=[],
        experience=[],
        niches=[],
        rates={"hourly_min": 0, "hourly_max": 0, "fixed_min": 0},
        created_at=now,
        updated_at=now,
    ))
    await db.flush()

    resp = await client.get("/api/profile", headers=auth(user))
    assert resp.status_code == 200
    assert resp.json()["title"] == "Dev"
    assert "Python" in resp.json()["skills"]


# ── POST /api/profile ─────────────────────────────────────────────────────────

async def test_save_profile_returns_200(client, make_user):
    user = await make_user(email="prof-save@test.com", google_id="gid-prof-save")
    mock_profile = _fake_user_profile(user.id)
    with patch("app.routers.profile.profile_runner.save_profile", new=AsyncMock(return_value=mock_profile)):
        resp = await client.post("/api/profile", headers=auth(user), json=_VALID_PAYLOAD)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Backend Developer"


async def test_save_profile_runner_error_returns_500(client, make_user):
    user = await make_user(email="prof-err@test.com", google_id="gid-prof-err")
    with patch(
        "app.routers.profile.profile_runner.save_profile",
        new=AsyncMock(side_effect=RuntimeError("embedding failed")),
    ):
        resp = await client.post("/api/profile", headers=auth(user), json=_VALID_PAYLOAD)
    assert resp.status_code == 500


async def test_save_profile_unauthenticated_returns_401(client):
    resp = await client.post("/api/profile", json=_VALID_PAYLOAD)
    assert resp.status_code == 401


# ── POST /api/profile/parse-resume ────────────────────────────────────────────

async def test_parse_resume_unsupported_type_returns_400(client, make_user):
    user = await make_user(email="resume-type@test.com", google_id="gid-resume-type")
    resp = await client.post(
        "/api/profile/parse-resume",
        headers=auth(user),
        files={"file": ("resume.txt", b"plain text content", "text/plain")},
    )
    assert resp.status_code == 400


async def test_parse_resume_too_large_returns_400(client, make_user):
    user = await make_user(email="resume-large@test.com", google_id="gid-resume-large")
    big = b"x" * (5 * 1024 * 1024 + 1)
    resp = await client.post(
        "/api/profile/parse-resume",
        headers=auth(user),
        files={"file": ("resume.pdf", big, "application/pdf")},
    )
    assert resp.status_code == 400


async def test_parse_resume_returns_parsed_dict(client, make_user):
    user = await make_user(email="resume-ok@test.com", google_id="gid-resume-ok")
    parsed_data = {"title": "Dev", "bio": "I build things.", "skills": ["Python"]}
    with patch(
        "app.routers.profile.profile_runner.parse_resume",
        new=AsyncMock(return_value=parsed_data),
    ):
        resp = await client.post(
            "/api/profile/parse-resume",
            headers=auth(user),
            files={"file": ("resume.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
    assert resp.status_code == 200
    assert resp.json()["parsed"]["title"] == "Dev"


async def test_parse_resume_value_error_returns_422(client, make_user):
    user = await make_user(email="resume-val@test.com", google_id="gid-resume-val")
    with patch(
        "app.routers.profile.profile_runner.parse_resume",
        new=AsyncMock(side_effect=ValueError("Could not extract text")),
    ):
        resp = await client.post(
            "/api/profile/parse-resume",
            headers=auth(user),
            files={"file": ("resume.pdf", b"fake bytes", "application/pdf")},
        )
    assert resp.status_code == 422
