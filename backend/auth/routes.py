"""Auth routes: POST /login, GET /me, POST /logout."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from models.user import LoginRequest, LoginResponse, UserInDB, UserPublic
from .deps import get_current_user
from .rate_limit import check_and_record, reset_ip
from .security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    # Trust X-Forwarded-For first (behind ingress), fall back to socket peer
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, response: Response):
    ip = _client_ip(request)
    allowed, retry_after = check_and_record(ip)
    if not allowed:
        response.headers["Retry-After"] = str(retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {retry_after}s.",
        )

    db = request.app.state.db
    email_norm = payload.email.lower().strip()
    doc = await db.users.find_one({"email": email_norm}, {"_id": 0})
    if not doc or not verify_password(payload.password, doc.get("hashed_password", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    user = UserInDB.from_mongo(doc)
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    # Successful login — clear this IP's counter so a bad-attempt burst
    # doesn't lock out the legitimate owner right after they log in.
    reset_ip(ip)

    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(user_id=user.id, role=role_value)
    return LoginResponse(access_token=token, user=user.public())


@router.get("/me", response_model=UserPublic)
async def me(current_user: UserPublic = Depends(get_current_user)):
    return current_user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(_: UserPublic = Depends(get_current_user)):
    # Stateless JWT — client drops the token. Endpoint exists so clients
    # can hit a canonical URL and confirm the token was valid at logout.
    return Response(status_code=status.HTTP_204_NO_CONTENT)
