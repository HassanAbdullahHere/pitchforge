import uuid
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.models import Proposal
from tests.conftest import auth


async def test_list_proposals_returns_only_own(client, make_user, make_proposal):
    user_a = await make_user(email="list-a@test.com", google_id="gid-list-a")
    user_b = await make_user(email="list-b@test.com", google_id="gid-list-b")
    await make_proposal(user_a.id, final_proposal="done", thread_id="thread-list-a")
    await make_proposal(user_b.id, final_proposal="done", thread_id="thread-list-b")
    resp = await client.get("/api/proposals", headers=auth(user_a))
    assert resp.status_code == 200
    thread_ids = [p["thread_id"] for p in resp.json()]
    assert "thread-list-a" in thread_ids
    assert "thread-list-b" not in thread_ids


async def test_list_proposals_excludes_unfinalized(client, make_user, make_proposal):
    user = await make_user(email="list-c@test.com", google_id="gid-list-c")
    await make_proposal(user.id, thread_id="thread-unfinished")
    resp = await client.get("/api/proposals", headers=auth(user))
    assert resp.status_code == 200
    assert all(p["final_proposal"] is not None for p in resp.json())


async def test_get_own_proposal_200(client, make_user, make_proposal):
    user = await make_user(email="get-own@test.com", google_id="gid-get-own")
    p = await make_proposal(user.id, final_proposal="done")
    resp = await client.get(f"/api/proposals/{p.id}", headers=auth(user))
    assert resp.status_code == 200


async def test_get_other_users_proposal_403(client, make_user, make_proposal):
    owner = await make_user(email="get-owner@test.com", google_id="gid-get-owner")
    other = await make_user(email="get-other@test.com", google_id="gid-get-other")
    p = await make_proposal(owner.id)
    resp = await client.get(f"/api/proposals/{p.id}", headers=auth(other))
    assert resp.status_code == 403


async def test_get_nonexistent_proposal_404(client, make_user):
    user = await make_user(email="get-404@test.com", google_id="gid-get-404")
    resp = await client.get(f"/api/proposals/{uuid.uuid4()}", headers=auth(user))
    assert resp.status_code == 404


async def test_delete_own_proposal_204(client, make_user, make_proposal, db):
    user = await make_user(email="del-own@test.com", google_id="gid-del-own")
    p = await make_proposal(user.id)
    resp = await client.delete(f"/api/proposals/{p.id}", headers=auth(user))
    assert resp.status_code == 204
    result = await db.execute(select(Proposal).where(Proposal.id == p.id))
    assert result.scalar_one_or_none() is None


async def test_delete_other_users_proposal_403(client, make_user, make_proposal):
    owner = await make_user(email="del-owner@test.com", google_id="gid-del-owner")
    other = await make_user(email="del-other@test.com", google_id="gid-del-other")
    p = await make_proposal(owner.id)
    resp = await client.delete(f"/api/proposals/{p.id}", headers=auth(other))
    assert resp.status_code == 403


async def test_delete_nonexistent_proposal_404(client, make_user):
    user = await make_user(email="del-404@test.com", google_id="gid-del-404")
    resp = await client.delete(f"/api/proposals/{uuid.uuid4()}", headers=auth(user))
    assert resp.status_code == 404


async def test_revise_at_limit_returns_429(client, make_user, make_proposal):
    user = await make_user(email="rev-limit@test.com", google_id="gid-rev-limit")
    p = await make_proposal(user.id, revision_count=2)
    with patch("app.routers.proposals.check_injection", new=AsyncMock(return_value=False)):
        resp = await client.post(
            "/api/proposal/revise",
            headers=auth(user),
            json={"thread_id": p.thread_id, "instruction": "make it better please"},
        )
    assert resp.status_code == 429


async def _empty_sse():
    yield "event: done\ndata: {}\n\n"


async def test_revise_below_limit_increments_count(client, make_user, make_proposal, db):
    user = await make_user(email="rev-ok@test.com", google_id="gid-rev-ok")
    p = await make_proposal(user.id, revision_count=0)
    with patch("app.routers.proposals.check_injection", new=AsyncMock(return_value=False)), \
         patch("app.routers.proposals.stream_revise", return_value=_empty_sse()):
        resp = await client.post(
            "/api/proposal/revise",
            headers=auth(user),
            json={"thread_id": p.thread_id, "instruction": "make it better please"},
        )
    assert resp.status_code == 200
    await db.refresh(p)
    assert p.revision_count == 1
