"""FastAPI dependencies for auth: current-user extraction + role gating."""
from __future__ import annotations

from typing import Iterable

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from models.user import UserInDB, UserPublic, UserRole
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def _db_from_request(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserPublic:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    db = _db_from_request(request)
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not doc.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    return UserInDB.from_mongo(doc).public()


def require_role(*allowed: UserRole | str):
    """Dependency factory. Usage: `Depends(require_role(UserRole.ADMIN))`."""
    allowed_values = {r.value if isinstance(r, UserRole) else str(r) for r in allowed}

    async def _checker(user: UserPublic = Depends(get_current_user)) -> UserPublic:
        role_value = user.role.value if isinstance(user.role, UserRole) else str(user.role)
        if role_value not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {sorted(allowed_values)}",
            )
        return user

    return _checker
