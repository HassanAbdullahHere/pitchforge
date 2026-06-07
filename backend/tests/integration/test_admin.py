from sqlalchemy import select

from app.models import User
from tests.conftest import auth


async def test_stats_non_admin_returns_403(client, make_user):
    user = await make_user(email="nonadmin@test.com", google_id="gid-nonadmin")
    resp = await client.get("/api/admin/stats", headers=auth(user))
    assert resp.status_code == 403


async def test_stats_admin_returns_200_with_expected_shape(client, make_user):
    admin = await make_user(email="admin@test.com", google_id="gid-admin", is_admin=True)
    resp = await client.get("/api/admin/stats", headers=auth(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert "total_users" in data
    assert "total_proposals" in data
    assert "total_cost_usd" in data


async def test_ban_self_returns_400(client, make_user):
    admin = await make_user(email="admin2@test.com", google_id="gid-admin2", is_admin=True)
    resp = await client.patch(
        f"/api/admin/users/{admin.id}",
        headers=auth(admin),
        json={"is_active": False},
    )
    assert resp.status_code == 400


async def test_ban_other_user_sets_inactive(client, make_user, db):
    admin = await make_user(email="admin3@test.com", google_id="gid-admin3", is_admin=True)
    target = await make_user(email="target@test.com", google_id="gid-target")
    resp = await client.patch(
        f"/api/admin/users/{target.id}",
        headers=auth(admin),
        json={"is_active": False},
    )
    assert resp.status_code == 200
    result = await db.execute(select(User).where(User.id == target.id))
    assert result.scalar_one().is_active is False
