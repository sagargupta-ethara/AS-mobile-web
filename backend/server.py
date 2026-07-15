"""FastAPI app entry point — Phase 0.

Wiring:
  - MongoDB connection stored on app.state.db
  - /api/auth/*        (login, me, logout)
  - /api/ai/echo       (GPT-4o via emergentintegrations)
  - /api/, /api/status (existing demo endpoints kept for backwards compat)
  - Startup: seed 3 demo users + write test_credentials.md
"""
from __future__ import annotations

# --- env must load before anything else touches os.environ ---
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --- stdlib / third-party ---
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

# --- local ---
from auth.routes import router as auth_router
from routes.ai import router as ai_router
from seed import seed_users, write_test_credentials_file

# --- app + middleware ---
app = FastAPI(title="AS-Task Backend (Phase 0)")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MongoDB ---
mongo_url = os.environ["MONGO_URL"]
_client = AsyncIOMotorClient(mongo_url)
_db = _client[os.environ["DB_NAME"]]
app.state.db = _db

# --- routers ---
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Hello World"}


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    obj = StatusCheck(**input.model_dump())
    doc = obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await _db.status_checks.insert_one(doc)
    return obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    checks = await _db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for c in checks:
        if isinstance(c.get("timestamp"), str):
            c["timestamp"] = datetime.fromisoformat(c["timestamp"])
    return checks


api_router.include_router(auth_router)
api_router.include_router(ai_router)
app.include_router(api_router)


# --- logging ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# --- lifecycle ---
@app.on_event("startup")
async def _on_startup():
    try:
        await seed_users(_db)
        write_test_credentials_file()
    except Exception:
        logger.exception("Startup seed failed — continuing without seed data")


@app.on_event("shutdown")
async def _on_shutdown():
    _client.close()
