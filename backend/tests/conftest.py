import os

# Must be set before any app imports — database.py and jwt_utils.py read these at module load
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://pitchforge:pitchforge_dev@localhost:5432/pitchforge_test",
)
os.environ.setdefault("JWT_SECRET_KEY", "a" * 64)
os.environ.setdefault("GEMINI_API_KEY", "fake-key")
os.environ.setdefault("GOOGLE_CLIENT_ID", "fake-client-id")

from app.jwt_utils import create_token  # noqa: E402
from app.models import User  # noqa: E402


def token_for(user: User) -> str:
    return create_token(str(user.id), user.email)


def auth(user: User) -> dict:
    return {"Authorization": f"Bearer {token_for(user)}"}
