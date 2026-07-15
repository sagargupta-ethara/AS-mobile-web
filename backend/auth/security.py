"""Password hashing (bcrypt) and JWT encode/decode (pyjwt).

Env:
  JWT_SECRET  — HS256 signing secret. If missing, a strong random default is
                generated at import time and a warning is logged (POC only —
                tokens invalidate on server restart in that case).
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7


def _load_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        secret = secrets.token_hex(32)
        logger.warning(
            "JWT_SECRET not set in env — generated an ephemeral secret. "
            "Tokens will be invalidated on server restart. "
            "Set JWT_SECRET in backend/.env for stable sessions."
        )
    return secret


JWT_SECRET = _load_jwt_secret()


# --- password hashing ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# --- JWT ---
def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=JWT_EXPIRY_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """Raises jwt.ExpiredSignatureError / jwt.InvalidTokenError on failure."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
