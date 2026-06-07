from unittest.mock import MagicMock

from app.jwt_utils import create_token
from app.limiter import _get_client_ip, _get_user_id


def _req(headers: dict, host: str = "127.0.0.1") -> MagicMock:
    r = MagicMock()
    r.headers = headers
    r.client.host = host
    return r


def test_cf_ip_wins():
    assert _get_client_ip(_req({"CF-Connecting-IP": "1.2.3.4", "X-Real-IP": "9.9.9.9"})) == "1.2.3.4"


def test_real_ip_fallback():
    assert _get_client_ip(_req({"X-Real-IP": "5.6.7.8"})) == "5.6.7.8"


def test_forwarded_for_first_entry():
    assert _get_client_ip(_req({"X-Forwarded-For": "10.0.0.1, 10.0.0.2"})) == "10.0.0.1"


def test_client_host_fallback():
    assert _get_client_ip(_req({}, host="192.168.1.1")) == "192.168.1.1"


def test_user_id_extracted_from_valid_jwt():
    token = create_token("user-xyz", "a@b.com")
    req = _req({"Authorization": f"Bearer {token}"})
    assert _get_user_id(req) == "user:user-xyz"
