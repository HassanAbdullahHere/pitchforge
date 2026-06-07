from unittest.mock import AsyncMock, patch

from sqlalchemy.exc import OperationalError


async def test_health_returns_200_when_db_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["db_connected"] is True
    assert data["status"] == "ok"


async def test_health_returns_503_when_db_down(client):
    with patch("app.main.AsyncSessionLocal") as mock_session_cls:
        mock_session_cls.return_value.__aenter__ = AsyncMock(
            side_effect=OperationalError("connection refused", {}, None)
        )
        resp = await client.get("/health")
    assert resp.status_code == 503
    assert resp.json()["db_connected"] is False
