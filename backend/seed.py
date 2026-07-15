"""Seed 3 demo users on first startup and write /app/memory/test_credentials.md."""
from __future__ import annotations

import logging
from pathlib import Path

from auth.security import hash_password
from models.user import UserInDB, UserRole

logger = logging.getLogger(__name__)

SEED_USERS = [
    {
        "email": "maharaja@scindia.local",
        "password": "Maharaja@123",
        "full_name": "Maharaja Scindia",
        "role": UserRole.ADMIN,
    },
    {
        "email": "manager@scindia.local",
        "password": "Manager@123",
        "full_name": "Anjali (Head Manager)",
        "role": UserRole.MANAGER,
    },
    {
        "email": "tasker@scindia.local",
        "password": "Tasker@123",
        "full_name": "Meera (Florist)",
        "role": UserRole.TASKER,
    },
]

CREDENTIALS_PATH = Path("/app/memory/test_credentials.md")


async def seed_users(db) -> None:
    await db.users.create_index("email", unique=True)
    existing = await db.users.count_documents({})
    if existing > 0:
        # Idempotent — make sure passwords are still fresh in case dev changes them
        for u in SEED_USERS:
            await db.users.update_one(
                {"email": u["email"]},
                {"$setOnInsert": UserInDB(
                    email=u["email"],
                    full_name=u["full_name"],
                    role=u["role"],
                    hashed_password=hash_password(u["password"]),
                ).to_mongo()},
                upsert=True,
            )
        logger.info("Users collection already populated (%d docs); ensured seed users exist.", existing)
    else:
        docs = [
            UserInDB(
                email=u["email"],
                full_name=u["full_name"],
                role=u["role"],
                hashed_password=hash_password(u["password"]),
            ).to_mongo()
            for u in SEED_USERS
        ]
        await db.users.insert_many(docs)
        logger.info("Seeded %d demo users.", len(docs))


def write_test_credentials_file() -> None:
    """Write the test-agent-compatible credentials file."""
    lines = [
        "# Test Credentials (Phase 0 seed)\n",
        "These accounts are created by `backend/seed.py` on FastAPI startup.\n",
        "",
        "## Users",
        "",
        "| Role | Email | Password | Full Name |",
        "| --- | --- | --- | --- |",
    ]
    for u in SEED_USERS:
        lines.append(f"| `{u['role'].value}` | `{u['email']}` | `{u['password']}` | {u['full_name']} |")

    lines += [
        "",
        "## Endpoints",
        "",
        "- `POST /api/auth/login` — body: `{ \"email\": ..., \"password\": ... }` → `{ access_token, user }`",
        "- `GET  /api/auth/me` — requires `Authorization: Bearer <token>`",
        "- `POST /api/auth/logout` — requires bearer token, returns 204",
        "- `POST /api/ai/echo` — requires bearer token, body: `{ \"prompt\": ... }` → `{ reply }`",
        "",
        "## Obtaining a token via curl",
        "",
        "```bash",
        "TOKEN=$(curl -s -X POST \"$BACKEND_URL/api/auth/login\" \\",
        "  -H 'Content-Type: application/json' \\",
        "  -d '{\"email\":\"maharaja@scindia.local\",\"password\":\"Maharaja@123\"}' \\",
        "  | python3 -c \"import sys,json;print(json.load(sys.stdin)['access_token'])\")",
        "",
        "curl -s \"$BACKEND_URL/api/auth/me\" -H \"Authorization: Bearer $TOKEN\"",
        "```",
        "",
        "## Notes",
        "",
        "- JWT expires 7 days after issue (HS256, `JWT_SECRET` env).",
        "- Rate limit: 5 login attempts / 60s / IP (POC in-memory).",
        "- `require_role(UserRole.ADMIN, ...)` dependency is available for future admin-only routes.",
        "",
    ]
    CREDENTIALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CREDENTIALS_PATH.write_text("\n".join(lines), encoding="utf-8")
    logger.info("Wrote %s", CREDENTIALS_PATH)
