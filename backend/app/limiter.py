from slowapi import Limiter


def _get_client_ip(request) -> str:
    # Cloudflare (if ever added in front of nginx)
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()
    # nginx sets this to $remote_addr (the real client IP)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    # Generic proxy fallback — first entry is the original client
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    # Local dev — no proxy in front
    return request.client.host if request.client else "unknown"


def _get_user_id(request) -> str:
    token = request.headers.get("Authorization", "")
    if token.startswith("Bearer "):
        token = token[7:].strip()
        if token:
            try:
                from app.jwt_utils import verify_token
                payload = verify_token(token)
                if payload and payload.get("sub"):
                    return f"user:{payload['sub']}"
            except Exception:
                pass
    return _get_client_ip(request)


limiter = Limiter(key_func=_get_client_ip)
