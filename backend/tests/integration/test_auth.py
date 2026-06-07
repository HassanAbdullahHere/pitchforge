from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import auth


async def test_google_auth_valid_token_returns_jwt(client):
    mock_resp = MagicMock(status_code=200)
    mock_resp.json.return_value = {"sub": "gid-new", "email": "new@test.com", "name": "New User"}
    with patch("app.routers.auth.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_resp))
        )
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)
        resp = await client.post("/api/auth/google", json={"access_token": "fake-token"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_google_auth_invalid_token_returns_401(client):
    mock_resp = MagicMock(status_code=401)
    with patch("app.routers.auth.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_resp))
        )
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)
        resp = await client.post("/api/auth/google", json={"access_token": "bad"})
    assert resp.status_code == 401


async def test_google_auth_banned_user_returns_403(client, make_user):
    user = await make_user(google_id="gid-banned", email="banned@test.com", is_active=False)
    mock_resp = MagicMock(status_code=200)
    mock_resp.json.return_value = {"sub": "gid-banned", "email": user.email, "name": user.name}
    with patch("app.routers.auth.httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__ = AsyncMock(
            return_value=MagicMock(get=AsyncMock(return_value=mock_resp))
        )
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)
        resp = await client.post("/api/auth/google", json={"access_token": "token"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "account_blocked"


async def test_get_me_returns_user(client, make_user):
    user = await make_user(email="me@test.com", google_id="gid-me")
    resp = await client.get("/api/auth/me", headers=auth(user))
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@test.com"
    assert "id" in data and "name" in data


async def test_get_me_invalid_token_returns_401(client):
    resp = await client.get("/api/auth/me", headers={"Authorization": "Bearer bad.token.here"})
    assert resp.status_code == 401
