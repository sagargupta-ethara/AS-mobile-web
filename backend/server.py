"""
Scindia Royal Household — Staff & Task Management backend (v2).
Roles: admin / manager / floor_manager.
Adds Projects, per-assignee task sub-completions, multi-round review with
star ratings, activity log, and analytics.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal, Any, Dict
import uuid
from datetime import datetime, timedelta, timezone, date, time as dtime
import json
import base64
import binascii
import re

from passlib.context import CryptContext
from jose import jwt, JWTError
from emergentintegrations.llm.chat import LlmChat, UserMessage

# ------------------------------------------------------------------
# Bootstrapping
# ------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRE_HOURS = int(os.environ.get('JWT_EXPIRE_HOURS', '720'))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

app = FastAPI(
    title="Scindia Household API v2",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)
api = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Types
# ------------------------------------------------------------------
Role = Literal["admin", "manager", "floor_manager"]
Priority = Literal["low", "medium", "high", "urgent"]
ProjectStatus = Literal["active", "closure_proposed", "closed"]
AssignmentStatus = Literal["pending", "in_progress", "submitted", "rejected", "approved"]

DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
MAX_ATTACHMENT_BYTES = int(os.environ.get("MAX_ATTACHMENT_BYTES", str(8 * 1024 * 1024)))
MAX_ATTACHMENTS_PER_ROUND = int(os.environ.get("MAX_ATTACHMENTS_PER_ROUND", "10"))
MAX_SUBMISSION_DECODED_BYTES = int(os.environ.get("MAX_SUBMISSION_DECODED_BYTES", str(8 * 1024 * 1024)))
MAX_SUBMISSION_STORED_BYTES = int(os.environ.get("MAX_SUBMISSION_STORED_BYTES", str(12 * 1024 * 1024)))
MAX_SUBMISSION_NOTE_CHARS = int(os.environ.get("MAX_SUBMISSION_NOTE_CHARS", "4000"))
SAFE_ATTACHMENT_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
}
BLOCKED_ATTACHMENT_MIMES = {
    "application/javascript",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/html",
    "text/javascript",
}
FILENAME_CLEANER = re.compile(r"[\x00-\x1f\x7f]")
TRUST_PROXY_HEADERS = os.environ.get("TRUST_PROXY_HEADERS", "").strip().lower() in {"1", "true", "yes", "on"}
RATE_LIMIT_MAX_BUCKETS = int(os.environ.get("RATE_LIMIT_MAX_BUCKETS", "10000"))
LOGIN_FAILURE_LIMIT = int(os.environ.get("LOGIN_FAILURE_LIMIT", "5"))
LOGIN_FAILURE_WINDOW_SECONDS = int(os.environ.get("LOGIN_FAILURE_WINDOW_SECONDS", "900"))
AI_RATE_LIMIT = int(os.environ.get("AI_RATE_LIMIT", "20"))
AI_RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("AI_RATE_LIMIT_WINDOW_SECONDS", "60"))
LOGIN_FAILURES: Dict[str, List[datetime]] = {}
AI_RATE_LIMITS: Dict[str, List[datetime]] = {}

# ------------------------------------------------------------------
# Pydantic Models
# ------------------------------------------------------------------
class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Role
    avatar: Optional[str] = None
    avg_rating: float = 0.0
    ratings_count: int = 0
    must_change_password: bool = False
    created_at: datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: Role = "floor_manager"
    avatar: Optional[str] = None

class LoginBody(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "sparkles"

class Category(BaseModel):
    id: str
    name: str
    icon: str
    created_at: datetime

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    manager_ids: List[str] = Field(default_factory=list)
    floor_manager_ids: List[str] = Field(default_factory=list)

class ProjectMembersBody(BaseModel):
    manager_ids: Optional[List[str]] = None
    floor_manager_ids: Optional[List[str]] = None

class ProjectCloseBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = ""

class ProjectProposeCloseBody(BaseModel):
    note: Optional[str] = ""

class UserRef(BaseModel):
    id: str
    name: str
    role: Role
    avg_rating: float = 0.0

class Project(BaseModel):
    id: str
    name: str
    description: str = ""
    status: ProjectStatus
    created_by: str
    created_by_name: Optional[str] = None
    managers: List[UserRef] = []
    floor_managers: List[UserRef] = []
    task_count: int = 0
    completed_task_count: int = 0
    final_rating: Optional[float] = None
    final_feedback: Optional[str] = None
    closure_proposed_by: Optional[str] = None
    closure_proposed_note: Optional[str] = None
    created_at: datetime
    closed_at: Optional[datetime] = None

class Attachment(BaseModel):
    id: str
    name: str
    mime: str
    size: int = 0
    data_uri: str  # data:<mime>;base64,<...>

class ReviewRound(BaseModel):
    id: str
    submitted_at: datetime
    photos: List[str] = []
    files: List[Attachment] = []
    note: str = ""
    decision: Optional[Literal["approve", "reject"]] = None
    rating: Optional[int] = None
    feedback: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None

class TaskAssignment(BaseModel):
    id: str
    assignee_id: str
    assignee_name: Optional[str] = None
    assignee_role: Optional[Role] = None
    status: AssignmentStatus = "pending"
    rounds: List[ReviewRound] = []
    final_rating: Optional[float] = None
    approved_at: Optional[datetime] = None

class Recurrence(BaseModel):
    enabled: bool = False
    interval_value: int = Field(default=1, ge=1)
    interval_unit: Literal["day", "week", "month"] = "day"
    weekdays: List[int] = []             # 0=Mon..6=Sun (for weekly)
    day_of_month: Optional[int] = Field(default=None, ge=1, le=31)
    start_date: Optional[date] = None    # inclusive
    end_date: Optional[date] = None      # inclusive; null = never


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = None
    project_id: Optional[str] = None
    assignee_ids: List[str]
    priority: Priority = "medium"
    due_date: Optional[datetime] = None
    recurrence: Optional[Recurrence] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[Priority] = None
    due_date: Optional[datetime] = None
    recurrence: Optional[Recurrence] = None

class SubmitBody(BaseModel):
    photos: List[str] = []
    files: List[Attachment] = []
    note: Optional[str] = ""

class ReviewBody(BaseModel):
    decision: Literal["approve", "reject"]
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = ""

class AssignmentStatusBody(BaseModel):
    status: Literal["in_progress", "pending"]

class Task(BaseModel):
    id: str
    title: str
    description: str = ""
    category: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    priority: Priority
    due_date: Optional[datetime] = None
    recurrence: Optional[Recurrence] = None
    parent_task_id: Optional[str] = None     # set on cloned occurrences
    occurrence_seq: int = 1                  # 1 for original, 2+ for auto-clones
    assignments: List[TaskAssignment] = []
    created_by: str
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    overall_status: str = "pending"  # derived: pending | in_progress | in_review | completed

class ActivityLog(BaseModel):
    id: str
    actor_id: str
    actor_name: str
    action: str
    entity_type: str
    entity_id: str
    meta: Dict[str, Any] = {}
    created_at: datetime

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False

def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _request_client_host(request: Request) -> str:
    client_host = request.client.host if request.client else "unknown"
    if not TRUST_PROXY_HEADERS:
        return client_host
    forwarded_for = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return forwarded_for or client_host


def _prune_rate_limit_store(store: Dict[str, List[datetime]], now: datetime, window_seconds: int) -> None:
    window_start = now - timedelta(seconds=window_seconds)
    for key in list(store.keys()):
        recent = [seen_at for seen_at in store[key] if seen_at >= window_start]
        if recent:
            store[key] = recent
        else:
            store.pop(key, None)
    if len(store) > RATE_LIMIT_MAX_BUCKETS:
        overflow = len(store) - RATE_LIMIT_MAX_BUCKETS
        for key in list(store.keys())[:overflow]:
            store.pop(key, None)


def _recent_rate_entries(
    store: Dict[str, List[datetime]],
    key: str,
    now: datetime,
    window_seconds: int,
) -> List[datetime]:
    _prune_rate_limit_store(store, now, window_seconds)
    window_start = now - timedelta(seconds=window_seconds)
    entries = [seen_at for seen_at in store.get(key, []) if seen_at >= window_start]
    store[key] = entries
    return entries


def _login_failure_key(request: Request, email: str) -> str:
    return f"{email.lower()}:{_request_client_host(request)}"


def _recent_login_failures(key: str, now: datetime) -> List[datetime]:
    return _recent_rate_entries(LOGIN_FAILURES, key, now, LOGIN_FAILURE_WINDOW_SECONDS)


def _ensure_login_allowed(request: Request, email: str) -> str:
    key = _login_failure_key(request, email)
    now = datetime.now(timezone.utc)
    if len(_recent_login_failures(key, now)) >= LOGIN_FAILURE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    return key


def _record_login_failure(key: str) -> None:
    now = datetime.now(timezone.utc)
    failures = _recent_login_failures(key, now)
    failures.append(now)
    LOGIN_FAILURES[key] = failures


def _clear_login_failures(key: str) -> None:
    LOGIN_FAILURES.pop(key, None)


def _ensure_ai_rate_allowed(request: Request, user: UserPublic, bucket: str) -> None:
    key = f"{bucket}:{user.id}:{_request_client_host(request)}"
    now = datetime.now(timezone.utc)
    entries = _recent_rate_entries(AI_RATE_LIMITS, key, now, AI_RATE_LIMIT_WINDOW_SECONDS)
    if len(entries) >= AI_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many AI requests. Try again later.")
    entries.append(now)
    AI_RATE_LIMITS[key] = entries

async def _user_avg_rating(user_id: str) -> tuple[float, int]:
    """Compute avg rating across all approved assignments for a floor_manager."""
    pipeline = [
        {"$unwind": "$assignments"},
        {"$match": {
            "assignments.assignee_id": user_id,
            "assignments.status": "approved",
            "assignments.final_rating": {"$ne": None},
        }},
        {"$group": {
            "_id": None,
            "avg": {"$avg": "$assignments.final_rating"},
            "cnt": {"$sum": 1},
        }},
    ]
    cursor = db.tasks.aggregate(pipeline)
    async for row in cursor:
        return round(row.get("avg", 0.0) or 0.0, 2), int(row.get("cnt", 0))
    return 0.0, 0

async def _to_user_public(doc: dict) -> UserPublic:
    avg, cnt = await _user_avg_rating(doc.get("id", ""))
    email = doc.get("email") or ""
    return UserPublic(
        id=doc.get("id", ""),
        name=doc.get("name") or email or "",
        email=email,
        phone=doc.get("phone"),
        role=doc.get("role", "floor_manager"),
        avatar=doc.get("avatar"),
        avg_rating=avg,
        ratings_count=cnt,
        must_change_password=bool(doc.get("must_change_password", False)),
        created_at=doc.get("created_at"),
    )

async def _user_ref(user_id: str) -> Optional[UserRef]:
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1, "role": 1})
    if not doc:
        return None
    avg, _ = await _user_avg_rating(user_id)
    return UserRef(id=doc["id"], name=doc["name"], role=doc["role"], avg_rating=avg)

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> UserPublic:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return await _to_user_public(user_doc)

def require_roles(*roles: Role):
    async def dep(user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep

require_admin = require_roles("admin")
require_manager = require_roles("admin", "manager")


class AttachmentValidationError(Exception):
    pass


def parse_cors_origins(raw: Optional[str]) -> List[str]:
    if not raw:
        return DEFAULT_CORS_ORIGINS
    origins = [origin.strip() for origin in raw.split(",") if origin.strip() and origin.strip() != "*"]
    return origins or DEFAULT_CORS_ORIGINS


def _safe_attachment_name(raw: str) -> str:
    name = FILENAME_CLEANER.sub("", (raw or "attachment").strip())
    name = name.replace("\\", "/").rsplit("/", 1)[-1]
    return (name or "attachment")[:120]


def _decode_data_uri(data_uri: str, fallback_mime: str) -> tuple[str, int]:
    header, separator, payload = data_uri.partition(",")
    if not data_uri.startswith("data:") or not separator:
        raise AttachmentValidationError("Attachment data must be a data URI")
    meta = [part.strip().lower() for part in header[5:].split(";") if part.strip()]
    media_type = meta[0] if meta and meta[0] != "base64" else ""
    mime = media_type or (fallback_mime or "application/octet-stream").lower()
    if "base64" not in meta:
        raise AttachmentValidationError("Attachment data must be base64 encoded")
    try:
        decoded = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AttachmentValidationError("Attachment data is not valid base64") from exc
    return mime, len(decoded)


def _is_safe_attachment_mime(mime: str) -> bool:
    normalized = (mime or "application/octet-stream").strip().lower()
    if normalized in BLOCKED_ATTACHMENT_MIMES:
        return False
    return normalized.startswith("image/") or normalized in SAFE_ATTACHMENT_MIMES


def _normalize_attachment(file: Attachment) -> Dict[str, Any]:
    mime, size = _decode_data_uri(file.data_uri, file.mime)
    if not _is_safe_attachment_mime(mime):
        raise AttachmentValidationError(f"Unsupported attachment type: {mime}")
    if size > MAX_ATTACHMENT_BYTES:
        raise AttachmentValidationError("Attachment exceeds the 8 MB limit")
    return Attachment(
        id=(file.id or str(uuid.uuid4()))[:80],
        name=_safe_attachment_name(file.name),
        mime=mime,
        size=size,
        data_uri=file.data_uri,
    ).model_dump()


def _normalize_photo(data_uri: str) -> tuple[str, int]:
    mime, size = _decode_data_uri(data_uri, "image/jpeg")
    if not mime.startswith("image/") or mime in BLOCKED_ATTACHMENT_MIMES:
        raise AttachmentValidationError(f"Unsupported photo type: {mime}")
    if size > MAX_ATTACHMENT_BYTES:
        raise AttachmentValidationError("Photo exceeds the 8 MB limit")
    return data_uri, size


def _stored_attachment_bytes(file: Dict[str, Any]) -> int:
    return (
        len(str(file.get("data_uri", "")).encode("utf-8"))
        + len(str(file.get("name", "")).encode("utf-8"))
        + len(str(file.get("mime", "")).encode("utf-8"))
        + 128
    )


def _check_submission_budget(
    photos: List[tuple[str, int]],
    files: List[Dict[str, Any]],
    note: str,
) -> None:
    if len(note) > MAX_SUBMISSION_NOTE_CHARS:
        raise AttachmentValidationError(f"Submission note must be {MAX_SUBMISSION_NOTE_CHARS} characters or fewer")
    decoded_total = sum(size for _, size in photos) + sum(int(file.get("size") or 0) for file in files)
    if decoded_total > MAX_SUBMISSION_DECODED_BYTES:
        raise AttachmentValidationError("Submission attachments exceed the 8 MB combined limit")
    stored_total = (
        len(note.encode("utf-8"))
        + sum(len(data_uri.encode("utf-8")) for data_uri, _ in photos)
        + sum(_stored_attachment_bytes(file) for file in files)
    )
    if stored_total > MAX_SUBMISSION_STORED_BYTES:
        raise AttachmentValidationError("Submission is too large to store safely")


def _normalize_submission_payload(body: SubmitBody) -> tuple[List[str], List[Dict[str, Any]], str]:
    photos = body.photos or []
    files = body.files or []
    note = (body.note or "").strip()
    if len(photos) + len(files) > MAX_ATTACHMENTS_PER_ROUND:
        raise AttachmentValidationError(f"Submit at most {MAX_ATTACHMENTS_PER_ROUND} attachments")
    normalized_photo_payloads = [_normalize_photo(photo) for photo in photos]
    normalized_files = [_normalize_attachment(file) for file in files]
    _check_submission_budget(normalized_photo_payloads, normalized_files, note)
    normalized_photos = [photo for photo, _ in normalized_photo_payloads]
    if not normalized_photos and not normalized_files and not note:
        raise AttachmentValidationError("Add a photo, file, or note before submitting")
    return normalized_photos, normalized_files, note


async def log_activity(actor: UserPublic, action: str, entity_type: str,
                       entity_id: str, meta: Optional[Dict[str, Any]] = None):
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "actor_id": actor.id,
        "actor_name": actor.name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "meta": meta or {},
        "created_at": datetime.now(timezone.utc),
    })

def _next_occurrence_date(rec: Dict[str, Any], from_dt: date) -> Optional[date]:
    """Compute the next occurrence date strictly AFTER `from_dt`, honoring the recurrence rule.
    Returns None if the next date would exceed rec.end_date."""
    if not rec or not rec.get("enabled"):
        return None
    interval = max(int(rec.get("interval_value") or 1), 1)
    unit = rec.get("interval_unit") or "day"
    end = rec.get("end_date")
    if isinstance(end, str):
        try: end = date.fromisoformat(end)
        except Exception: end = None
    def within_end(d: date) -> bool:
        return end is None or d <= end
    if unit == "day":
        cand = from_dt + timedelta(days=interval)
        return cand if within_end(cand) else None
    if unit == "week":
        wds = sorted({int(w) for w in (rec.get("weekdays") or []) if isinstance(w, int) and 0 <= w <= 6})
        if not wds:
            cand = from_dt + timedelta(weeks=interval)
            return cand if within_end(cand) else None
        # Search within the current week first
        for offset in range(1, 8):
            cand = from_dt + timedelta(days=offset)
            if cand.weekday() in wds:
                return cand if within_end(cand) else None
        cand = from_dt + timedelta(weeks=interval)
        return cand if within_end(cand) else None
    if unit == "month":
        dom = rec.get("day_of_month") or from_dt.day
        y, m = from_dt.year, from_dt.month + interval
        while m > 12:
            y += 1; m -= 12
        # clamp to end of month
        import calendar
        last_dom = calendar.monthrange(y, m)[1]
        cand = date(y, m, min(int(dom), last_dom))
        return cand if within_end(cand) else None
    return None


async def _maybe_generate_next_recurrence(task_doc: dict, actor: UserPublic) -> None:
    """If `task_doc` is a recurring task that just became fully approved (completed),
    generate the next occurrence with the same shape and reset assignments."""
    rec = task_doc.get("recurrence")
    if not rec or not rec.get("enabled"):
        return
    # only fire when overall status is completed
    if _compute_overall_status(task_doc.get("assignments", [])) != "completed":
        return
    # already spawned? guard by looking for a child with the same parent
    already = await db.tasks.find_one({"parent_task_id": task_doc["id"]}, {"_id": 0, "id": 1})
    if already:
        return
    prev_due = task_doc.get("due_date") or datetime.now(timezone.utc)
    prev_date = prev_due.date() if isinstance(prev_due, datetime) else prev_due
    nxt = _next_occurrence_date(rec, prev_date)
    if not nxt:
        return
    now = datetime.now(timezone.utc)
    new_id = str(uuid.uuid4())
    new_assignments = [
        {"id": str(uuid.uuid4()), "assignee_id": a["assignee_id"], "status": "pending",
         "rounds": [], "final_rating": None, "approved_at": None}
        for a in task_doc.get("assignments", [])
    ]
    new_doc = {
        "id": new_id,
        "title": task_doc["title"],
        "description": task_doc.get("description", ""),
        "category": task_doc.get("category"),
        "project_id": task_doc.get("project_id"),
        "priority": task_doc.get("priority", "medium"),
        "due_date": datetime.combine(nxt, dtime(9, 0), tzinfo=timezone.utc),
        "recurrence": rec,   # carry recurrence forward
        "parent_task_id": task_doc["id"],
        "occurrence_seq": int(task_doc.get("occurrence_seq") or 1) + 1,
        "assignments": new_assignments,
        "created_by": task_doc["created_by"],
        "created_at": now,
        "updated_at": now,
    }
    await db.tasks.insert_one(new_doc)
    await log_activity(actor, "recurring_occurrence_generated", "task", new_id,
                       {"parent_task_id": task_doc["id"], "due_date": nxt.isoformat()})


def _compute_overall_status(assignments: List[dict]) -> str:
    if not assignments:
        return "pending"
    statuses = [a.get("status", "pending") for a in assignments]
    if all(s == "approved" for s in statuses):
        return "completed"
    if any(s == "submitted" for s in statuses):
        return "in_review"
    if any(s in ("in_progress", "rejected") for s in statuses):
        return "in_progress"
    return "pending"

async def _hydrate_task(doc: dict) -> Task:
    # attach names to assignments + reviewers
    hydrated_assignments = []
    for a in doc.get("assignments", []):
        assignee = await db.users.find_one({"id": a["assignee_id"]}, {"_id": 0, "name": 1, "role": 1})
        rounds = []
        for r in a.get("rounds", []):
            reviewer_name = None
            if r.get("reviewed_by"):
                ru = await db.users.find_one({"id": r["reviewed_by"]}, {"_id": 0, "name": 1})
                reviewer_name = (ru or {}).get("name")
            rounds.append(ReviewRound(
                id=r["id"],
                submitted_at=r["submitted_at"],
                photos=r.get("photos", []),
                files=[Attachment(**f) for f in r.get("files", []) if isinstance(f, dict)],
                note=r.get("note", ""),
                decision=r.get("decision"),
                rating=r.get("rating"),
                feedback=r.get("feedback"),
                reviewed_by=r.get("reviewed_by"),
                reviewed_by_name=reviewer_name,
                reviewed_at=r.get("reviewed_at"),
            ))
        hydrated_assignments.append(TaskAssignment(
            id=a["id"],
            assignee_id=a["assignee_id"],
            assignee_name=(assignee or {}).get("name"),
            assignee_role=(assignee or {}).get("role"),
            status=a.get("status", "pending"),
            rounds=rounds,
            final_rating=a.get("final_rating"),
            approved_at=a.get("approved_at"),
        ))
    creator = await db.users.find_one({"id": doc["created_by"]}, {"_id": 0, "name": 1})
    project_name = None
    if doc.get("project_id"):
        p = await db.projects.find_one({"id": doc["project_id"]}, {"_id": 0, "name": 1})
        project_name = (p or {}).get("name")
    return Task(
        id=doc["id"],
        title=doc["title"],
        description=doc.get("description", ""),
        category=doc.get("category"),
        project_id=doc.get("project_id"),
        project_name=project_name,
        priority=doc.get("priority", "medium"),
        due_date=doc.get("due_date"),
        recurrence=doc.get("recurrence"),
        parent_task_id=doc.get("parent_task_id"),
        occurrence_seq=int(doc.get("occurrence_seq") or 1),
        assignments=hydrated_assignments,
        created_by=doc["created_by"],
        created_by_name=(creator or {}).get("name"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
        overall_status=_compute_overall_status(doc.get("assignments", [])),
    )

async def _hydrate_project(doc: dict) -> Project:
    managers: List[UserRef] = []
    for uid in doc.get("manager_ids", []):
        ref = await _user_ref(uid)
        if ref:
            managers.append(ref)
    floor_managers: List[UserRef] = []
    for uid in doc.get("floor_manager_ids", []):
        ref = await _user_ref(uid)
        if ref:
            floor_managers.append(ref)
    creator = await db.users.find_one({"id": doc["created_by"]}, {"_id": 0, "name": 1})
    task_count = await db.tasks.count_documents({"project_id": doc["id"]})
    # completed = all assignments approved
    completed = 0
    cursor = db.tasks.find({"project_id": doc["id"]}, {"_id": 0, "assignments": 1})
    async for t in cursor:
        assigns = t.get("assignments", [])
        if assigns and all(a.get("status") == "approved" for a in assigns):
            completed += 1
    return Project(
        id=doc["id"],
        name=doc["name"],
        description=doc.get("description", ""),
        status=doc.get("status", "active"),
        created_by=doc["created_by"],
        created_by_name=(creator or {}).get("name"),
        managers=managers,
        floor_managers=floor_managers,
        task_count=task_count,
        completed_task_count=completed,
        final_rating=doc.get("final_rating"),
        final_feedback=doc.get("final_feedback"),
        closure_proposed_by=doc.get("closure_proposed_by"),
        closure_proposed_note=doc.get("closure_proposed_note"),
        created_at=doc["created_at"],
        closed_at=doc.get("closed_at"),
    )

def _project_manager(project: dict, user: UserPublic) -> bool:
    """User is a listed manager on the project. Role-agnostic (admin or manager can be a project manager)."""
    return user.id in (project.get("manager_ids") or [])


def _project_creator(project: dict, user: UserPublic) -> bool:
    return user.id == project.get("created_by")


def _task_creator(doc: dict, user: UserPublic) -> bool:
    return user.id == doc.get("created_by")

def _project_visible_to(project: dict, user: UserPublic) -> bool:
    """Strict membership for ALL roles including admin."""
    return (
        _project_creator(project, user)
        or _project_manager(project, user)
        or user.id in (project.get("floor_manager_ids") or [])
    )

async def _validate_project_member_ids(manager_ids: List[str], floor_manager_ids: List[str]) -> None:
    member_ids = list(dict.fromkeys([*(manager_ids or []), *(floor_manager_ids or [])]))
    if not member_ids:
        return
    docs = await db.users.find({"id": {"$in": member_ids}}, {"_id": 0, "id": 1, "role": 1}).to_list(500)
    roles_by_id = {doc["id"]: doc["role"] for doc in docs}
    missing = [uid for uid in member_ids if uid not in roles_by_id]
    if missing:
        raise HTTPException(400, "One or more project members were not found")
    # Managers list may include admin OR manager users (cross-role allowed)
    if any(roles_by_id[uid] not in ("admin", "manager") for uid in manager_ids):
        raise HTTPException(400, "Project managers must have the admin or manager role")
    if any(roles_by_id[uid] != "floor_manager" for uid in floor_manager_ids):
        raise HTTPException(400, "Project floor managers must have the floor_manager role")


async def _managed_project_ids(user: UserPublic) -> List[str]:
    """Project ids where user is listed in manager_ids (role-agnostic; admin OR manager)."""
    return [
        project["id"]
        async for project in db.projects.find({"manager_ids": user.id}, {"_id": 0, "id": 1})
    ]


async def _task_visible_to(doc: dict, user: UserPublic) -> bool:
    """Strict for all roles: creator OR assignee OR listed manager on task's project."""
    if _task_creator(doc, user):
        return True
    if any(a.get("assignee_id") == user.id for a in doc.get("assignments", [])):
        return True
    if doc.get("project_id"):
        project = await db.projects.find_one({"id": doc["project_id"]}, {"_id": 0, "manager_ids": 1})
        return bool(project and _project_manager(project, user))
    return False


async def _can_review_task(doc: dict, user: UserPublic) -> bool:
    """Strict for all roles: task creator OR listed manager on task's project."""
    if _task_creator(doc, user):
        return True
    if doc.get("project_id"):
        project = await db.projects.find_one({"id": doc["project_id"]}, {"_id": 0, "manager_ids": 1})
        return bool(project and _project_manager(project, user))
    return False


async def _task_scope_for(user: UserPublic) -> Dict[str, Any]:
    """Strict scope for all roles: created OR assigned OR project.manager_ids includes user."""
    project_ids = await _managed_project_ids(user)
    return {
        "$or": [
            {"created_by": user.id},
            {"assignments.assignee_id": user.id},
            {"project_id": {"$in": project_ids}},
        ],
    }


def _combine_query(*parts: Dict[str, Any]) -> Dict[str, Any]:
    active = [part for part in parts if part]
    if not active:
        return {}
    if len(active) == 1:
        return active[0]
    return {"$and": active}


def _task_for_user(task: Task, user: UserPublic) -> Task:
    """Floor managers only see their own assignment rounds; managers/admin see everything within scope."""
    if user.role != "floor_manager":
        return task
    assignments = [
        assignment
        if assignment.assignee_id == user.id
        else assignment.model_copy(update={"rounds": [], "final_rating": None, "approved_at": None})
        for assignment in task.assignments
    ]
    return task.model_copy(update={"assignments": assignments})

# ------------------------------------------------------------------
# Startup: migrate + seed
# ------------------------------------------------------------------
DEFAULT_CATEGORIES = [
    ("Housekeeping", "sparkles"),
    ("Culinary", "chef-hat"),
    ("Chauffeur", "car"),
    ("Grounds & Estate", "trees"),
    ("Security", "shield"),
    ("Family Office", "briefcase"),
    ("Guest Relations", "users"),
    ("Wardrobe", "shirt"),
]

@app.on_event("startup")
async def bootstrap():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tasks.create_index("id", unique=True)
    await db.tasks.create_index("project_id")
    await db.tasks.create_index("assignments.assignee_id")
    await db.categories.create_index("id", unique=True)
    await db.projects.create_index("id", unique=True)
    await db.activity_logs.create_index("entity_id")
    await db.activity_logs.create_index("actor_id")
    await db.activity_logs.create_index("created_at")

    # Role migration: legacy "tasker" -> "floor_manager"
    migrated_role = await db.users.update_many(
        {"role": "tasker"}, {"$set": {"role": "floor_manager"}}
    )
    if migrated_role.modified_count:
        logger.info(f"Migrated {migrated_role.modified_count} user(s) role tasker->floor_manager")

    # Legacy field migration: projects.tasker_ids -> projects.floor_manager_ids
    migrated_fld = await db.projects.update_many(
        {"tasker_ids": {"$exists": True}},
        [{"$set": {"floor_manager_ids": "$tasker_ids"}},
         {"$unset": "tasker_ids"}],
    )
    if migrated_fld.modified_count:
        logger.info(f"Migrated {migrated_fld.modified_count} project(s) tasker_ids->floor_manager_ids")

    # Older still: "staff" -> "floor_manager" (defensive; no-op after prior migration)
    migrated_staff = await db.users.update_many({"role": "staff"}, {"$set": {"role": "floor_manager"}})
    if migrated_staff.modified_count:
        logger.info(f"Migrated {migrated_staff.modified_count} user(s) role staff->floor_manager")

    # Legacy task recurrence: is_recurring(bool) + recurrence("daily"/"weekly"/"monthly") -> Recurrence object
    async for t in db.tasks.find({"is_recurring": True, "recurrence": {"$type": "string"}}, {"_id": 0, "id": 1, "recurrence": 1, "due_date": 1}):
        legacy = t.get("recurrence")
        unit = {"daily": "day", "weekly": "week", "monthly": "month"}.get(legacy)
        if not unit:
            continue
        start = t.get("due_date")
        start_iso = (start.date() if isinstance(start, datetime) else datetime.now(timezone.utc).date()).isoformat()
        await db.tasks.update_one({"id": t["id"]}, {
            "$set": {"recurrence": {"enabled": True, "interval_value": 1, "interval_unit": unit,
                                    "weekdays": [], "day_of_month": None, "start_date": start_iso, "end_date": None}},
            "$unset": {"is_recurring": ""},
        })
    # Also unset lingering is_recurring on non-recurring tasks
    await db.tasks.update_many({"is_recurring": {"$exists": True}}, {"$unset": {"is_recurring": ""}})

    # Backfill: any user doc missing `name` gets email copied in (safe, idempotent)
    backfilled = await db.users.update_many(
        {"name": {"$exists": False}},
        [{"$set": {"name": "$email"}}],
    )
    if backfilled.modified_count:
        logger.info(f"Backfilled name from email on {backfilled.modified_count} user(s)")

    # Drop legacy task docs (old schema had assignee_id / proofs — not compatible)
    legacy = await db.tasks.count_documents({"assignments": {"$exists": False}})
    if legacy:
        await db.tasks.delete_many({"assignments": {"$exists": False}})
        logger.info(f"Dropped {legacy} legacy task doc(s)")

    # Seed admin (idempotent). Admin never needs to change password.
    admin_email = os.environ.get("ADMIN_EMAIL")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    admin_name = os.environ.get("ADMIN_NAME", "Administrator")
    if admin_email and admin_password:
        existing = await db.users.find_one({"email": admin_email}, {"_id": 0})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "name": admin_name,
                "email": admin_email,
                "phone": None,
                "hashed_password": hash_password(admin_password),
                "role": "admin",
                "avatar": None,
                "must_change_password": False,
                "created_at": datetime.now(timezone.utc),
                "created_by": None,
            })
            logger.info(f"Seeded admin: {admin_email}")

    # ---- Fresh-slate wipe + reseed of 10 new users. Gated on absence of tanya. ----
    NEW_ROSTER = [
        ("manager",       "Her Highness",   "her-highness@scindia.royal"),
        ("manager",       "Mayank",         "mayank@scindia.royal"),
        ("manager",       "Yuvraj Maharaj", "yuvraj-maharaj@scindia.royal"),
        ("floor_manager", "Tanya",          "tanya@scindia.royal"),
        ("floor_manager", "Desh",           "desh@scindia.royal"),
        ("floor_manager", "Priyanka",       "priyanka@scindia.royal"),
        ("floor_manager", "Satish",         "satish@scindia.royal"),
        ("floor_manager", "Brajhari",       "brajhari@scindia.royal"),
        ("floor_manager", "Rajinder",       "rajinder@scindia.royal"),
        ("floor_manager", "Bhushan",        "bhushan@scindia.royal"),
    ]
    NEW_USER_DEFAULT_PW = "password123"

    tanya_exists = await db.users.find_one({"email": "tanya@scindia.royal"}, {"_id": 0, "id": 1})
    if not tanya_exists:
        # First run of this seed. Wipe non-admin users and all household data.
        wiped_users = await db.users.delete_many({"role": {"$ne": "admin"}})
        wiped_projects = await db.projects.delete_many({})
        wiped_tasks = await db.tasks.delete_many({})
        wiped_logs = await db.activity_logs.delete_many({})
        wiped_chat = await db.chat_messages.delete_many({})
        logger.info(
            "Fresh-slate seed wipe: "
            f"users={wiped_users.deleted_count}, projects={wiped_projects.deleted_count}, "
            f"tasks={wiped_tasks.deleted_count}, logs={wiped_logs.deleted_count}, chat={wiped_chat.deleted_count}"
        )

    for role, name, email in NEW_ROSTER:
        if await db.users.find_one({"email": email}, {"_id": 0, "id": 1}):
            continue  # idempotent: never reset an existing user's password
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "name": name,
            "email": email,
            "phone": None,
            "hashed_password": hash_password(NEW_USER_DEFAULT_PW),
            "role": role,
            "avatar": None,
            "is_active": True,
            "must_change_password": False,
            "created_at": datetime.now(timezone.utc),
            "created_by": None,
        })
        logger.info(f"Seeded {role}: {email}")

    # Backfill `must_change_password=False` on any admin lacking the field (idempotent)
    await db.users.update_many(
        {"role": "admin", "must_change_password": {"$exists": False}},
        {"$set": {"must_change_password": False}},
    )

    # Seed categories
    if await db.categories.count_documents({}) == 0:
        for name, icon in DEFAULT_CATEGORIES:
            await db.categories.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "icon": icon,
                "created_at": datetime.now(timezone.utc),
            })

# ------------------------------------------------------------------
# Auth routes
# ------------------------------------------------------------------
@api.post("/auth/login", response_model=Token)
async def login(body: LoginBody, request: Request):
    email = body.email.lower()
    failure_key = _ensure_login_allowed(request, email)
    doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not doc or not verify_password(body.password, doc["hashed_password"]):
        _record_login_failure(failure_key)
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    _clear_login_failures(failure_key)
    token = create_access_token(doc["id"], doc["role"])
    return Token(access_token=token, user=await _to_user_public(doc))

@api.get("/auth/me", response_model=UserPublic)
async def me(user: UserPublic = Depends(get_current_user)):
    return user

@api.post("/auth/refresh", response_model=Token)
async def refresh_token(user: UserPublic = Depends(get_current_user)):
    """Issue a fresh JWT for the currently authenticated user. Requires a valid (non-expired) Bearer."""
    token = create_access_token(user.id, user.role)
    return Token(access_token=token, user=user)

@api.post("/auth/change-password", response_model=UserPublic)
async def change_password(body: ChangePasswordBody, user: UserPublic = Depends(get_current_user)):
    doc = await db.users.find_one({"id": user.id}, {"_id": 0})
    if not doc or not verify_password(body.current_password, doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "hashed_password": hash_password(body.new_password),
            "must_change_password": False,
        }},
    )
    await log_activity(user, "password_changed", "user", user.id, {})
    fresh = await db.users.find_one({"id": user.id}, {"_id": 0})
    return await _to_user_public(fresh)

# ------------------------------------------------------------------
# Users / Team
# ------------------------------------------------------------------
@api.get("/users", response_model=List[UserPublic])
async def list_users(role: Optional[Role] = None, user: UserPublic = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if role:
        q["role"] = role
    if user.role != "admin":
        # Restrict to users the caller shares at least one project with (as any member),
        # plus themselves. Applies to both manager and floor_manager.
        shared_user_ids: set = {user.id}
        projects = db.projects.find(
            {"$or": [
                {"manager_ids": user.id},
                {"floor_manager_ids": user.id},
                {"created_by": user.id},
            ]},
            {"_id": 0, "manager_ids": 1, "floor_manager_ids": 1, "created_by": 1},
        )
        async for p in projects:
            for uid in (p.get("manager_ids") or []): shared_user_ids.add(uid)
            for uid in (p.get("floor_manager_ids") or []): shared_user_ids.add(uid)
            if p.get("created_by"): shared_user_ids.add(p["created_by"])
        q = _combine_query(q, {"id": {"$in": list(shared_user_ids)}})
    docs = await db.users.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [await _to_user_public(d) for d in docs]

@api.post("/users", response_model=UserPublic, status_code=201)
async def create_user(body: UserCreate, actor: UserPublic = Depends(require_manager)):
    if body.role in ("manager", "admin") and actor.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create managers/admins")
    email = body.email.lower()
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(status_code=400, detail="Email already registered")
    new_doc = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "email": email,
        "phone": body.phone,
        "hashed_password": hash_password(body.password),
        "role": body.role,
        "avatar": body.avatar,
        "created_at": datetime.now(timezone.utc),
        "created_by": actor.id,
    }
    await db.users.insert_one(new_doc)
    await log_activity(actor, "member_added", "user", new_doc["id"],
                       {"name": body.name, "role": body.role})
    return await _to_user_public(new_doc)

@api.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: str, actor: UserPublic = Depends(require_manager)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target["role"] == "admin":
        raise HTTPException(status_code=403, detail="Cannot delete admin")
    if target["role"] == "manager" and actor.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete managers")
    if target["id"] == actor.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": user_id})
    await log_activity(actor, "member_removed", "user", user_id,
                       {"name": target["name"], "role": target["role"]})

class UserProfile(BaseModel):
    user: UserPublic
    active_assignments: int
    completed_assignments: int
    rejection_count: int
    recent_reviews: List[Dict[str, Any]]
    logs: List[ActivityLog]

@api.get("/users/{user_id}/profile", response_model=UserProfile)
async def user_profile(user_id: str, actor: UserPublic = Depends(get_current_user)):
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    # Self, or admin, or a user we share a project with.
    if actor.id != user_id and actor.role != "admin":
        shared = await db.projects.find_one({
            "$and": [
                {"$or": [
                    {"manager_ids": actor.id},
                    {"floor_manager_ids": actor.id},
                    {"created_by": actor.id},
                ]},
                {"$or": [
                    {"manager_ids": user_id},
                    {"floor_manager_ids": user_id},
                    {"created_by": user_id},
                ]},
            ]
        }, {"_id": 0, "id": 1})
        if not shared:
            raise HTTPException(403, "Forbidden")
    # active = tasks where assignment for this user is not approved
    active = 0
    completed = 0
    rejections = 0
    reviews: List[Dict[str, Any]] = []
    cursor = db.tasks.find({"assignments.assignee_id": user_id}, {"_id": 0})
    async for t in cursor:
        for a in t.get("assignments", []):
            if a["assignee_id"] != user_id:
                continue
            if a.get("status") == "approved":
                completed += 1
            else:
                active += 1
            for r in a.get("rounds", []):
                if r.get("decision") == "reject":
                    rejections += 1
                if r.get("decision") in ("approve", "reject") and r.get("rating") is not None:
                    reviews.append({
                        "task_id": t["id"],
                        "task_title": t["title"],
                        "decision": r["decision"],
                        "rating": r["rating"],
                        "feedback": r.get("feedback"),
                        "reviewed_at": r.get("reviewed_at"),
                    })
    reviews.sort(key=lambda r: r.get("reviewed_at") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    logs_docs = await db.activity_logs.find(
        {"$or": [{"actor_id": user_id}, {"entity_id": user_id, "entity_type": "user"}]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(30)
    logs = [ActivityLog(**l) for l in logs_docs]
    return UserProfile(
        user=await _to_user_public(doc),
        active_assignments=active,
        completed_assignments=completed,
        rejection_count=rejections,
        recent_reviews=reviews[:20],
        logs=logs,
    )

# ------------------------------------------------------------------
# Categories
# ------------------------------------------------------------------
@api.get("/categories", response_model=List[Category])
async def list_categories(user: UserPublic = Depends(get_current_user)):
    docs = await db.categories.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [Category(**d) for d in docs]

# ------------------------------------------------------------------
# Projects
# ------------------------------------------------------------------
@api.get("/projects", response_model=List[Project])
async def list_projects(user: UserPublic = Depends(get_current_user)):
    docs = await db.projects.find(
        {"$or": [
            {"manager_ids": user.id},
            {"floor_manager_ids": user.id},
            {"created_by": user.id},
        ]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return [await _hydrate_project(d) for d in docs]

@api.post("/projects", response_model=Project, status_code=201)
async def create_project(body: ProjectCreate, actor: UserPublic = Depends(require_manager)):
    manager_ids = list(dict.fromkeys(body.manager_ids or []))
    floor_manager_ids = list(dict.fromkeys(body.floor_manager_ids or []))
    # Auto-add the creator to manager_ids so they can see & close their own project.
    if actor.id not in manager_ids:
        manager_ids.insert(0, actor.id)
    await _validate_project_member_ids(manager_ids, floor_manager_ids)
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "description": (body.description or "").strip(),
        "status": "active",
        "created_by": actor.id,
        "manager_ids": manager_ids,
        "floor_manager_ids": floor_manager_ids,
        "final_rating": None,
        "final_feedback": None,
        "closure_proposed_by": None,
        "closure_proposed_note": None,
        "created_at": datetime.now(timezone.utc),
        "closed_at": None,
    }
    await db.projects.insert_one(doc)
    await log_activity(actor, "project_created", "project", doc["id"], {"name": doc["name"]})
    return await _hydrate_project(doc)

@api.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, user: UserPublic = Depends(get_current_user)):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if not _project_visible_to(doc, user):
        raise HTTPException(403, "Forbidden")
    return await _hydrate_project(doc)

@api.patch("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, body: Dict[str, Any],
                         user: UserPublic = Depends(get_current_user)):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if not (_project_creator(doc, user) or _project_manager(doc, user)):
        raise HTTPException(403, "Only project members with manager privileges can update")
    updates = {}
    for f in ("name", "description"):
        if f in body and body[f] is not None:
            updates[f] = body[f]
    if updates:
        await db.projects.update_one({"id": project_id}, {"$set": updates})
        await log_activity(user, "project_updated", "project", project_id, updates)
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return await _hydrate_project(doc)

@api.put("/projects/{project_id}/members", response_model=Project)
async def set_project_members(project_id: str, body: ProjectMembersBody,
                              user: UserPublic = Depends(get_current_user)):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.get("status") == "closed":
        raise HTTPException(400, "Project is closed")
    is_project_manager = _project_manager(doc, user)
    is_creator = _project_creator(doc, user)
    if not (is_project_manager or is_creator):
        raise HTTPException(403, "Forbidden")
    updates: Dict[str, Any] = {}
    if body.manager_ids is not None:
        # Only admin OR the project creator may change the manager roster
        if not (user.role == "admin" or is_creator):
            raise HTTPException(403, "Only admin or the project creator can change managers")
        updates["manager_ids"] = list(dict.fromkeys(body.manager_ids))
    if body.floor_manager_ids is not None:
        updates["floor_manager_ids"] = list(dict.fromkeys(body.floor_manager_ids))
    await _validate_project_member_ids(
        updates.get("manager_ids", doc.get("manager_ids") or []),
        updates.get("floor_manager_ids", doc.get("floor_manager_ids") or []),
    )
    if updates:
        await db.projects.update_one({"id": project_id}, {"$set": updates})
        await log_activity(user, "project_members_updated", "project", project_id, updates)
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return await _hydrate_project(doc)

@api.post("/projects/{project_id}/propose-close", response_model=Project)
async def propose_close(project_id: str, body: ProjectProposeCloseBody,
                        user: UserPublic = Depends(require_manager)):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.get("status") == "closed":
        raise HTTPException(400, "Already closed")
    if not _project_manager(doc, user):
        raise HTTPException(403, "Only project managers can propose closure")
    await db.projects.update_one({"id": project_id}, {"$set": {
        "status": "closure_proposed",
        "closure_proposed_by": user.id,
        "closure_proposed_note": body.note or "",
    }})
    await log_activity(user, "project_close_proposed", "project", project_id,
                       {"note": body.note or ""})
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return await _hydrate_project(doc)

@api.post("/projects/{project_id}/close", response_model=Project)
async def close_project(project_id: str, body: ProjectCloseBody,
                        user: UserPublic = Depends(get_current_user)):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.get("status") == "closed":
        raise HTTPException(400, "Already closed")
    # Final closure requires the caller to be an admin AND a member of the project
    # (as creator or listed manager). Strict membership even for admin.
    if not (user.role == "admin" and (_project_creator(doc, user) or _project_manager(doc, user))):
        raise HTTPException(403, "Only an admin who is a project member can finalize closure")
    await db.projects.update_one({"id": project_id}, {"$set": {
        "status": "closed",
        "final_rating": body.rating,
        "final_feedback": body.feedback or "",
        "closed_at": datetime.now(timezone.utc),
    }})
    await log_activity(user, "project_closed", "project", project_id,
                       {"rating": body.rating, "feedback": body.feedback or ""})
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return await _hydrate_project(doc)

# ------------------------------------------------------------------
# Tasks
# ------------------------------------------------------------------
@api.get("/tasks", response_model=List[Task])
async def list_tasks(
    project_id: Optional[str] = None,
    assignee_id: Optional[str] = None,
    mine: bool = False,
    user: UserPublic = Depends(get_current_user),
):
    filters: List[Dict[str, Any]] = [await _task_scope_for(user)]
    if project_id:
        filters.append({"project_id": project_id})
    if mine:
        filters.append({"assignments.assignee_id": user.id})
    elif assignee_id:
        filters.append({"assignments.assignee_id": assignee_id})
    q = _combine_query(*filters)
    docs = await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    tasks = [await _hydrate_task(d) for d in docs]
    return [_task_for_user(task, user) for task in tasks]

@api.post("/tasks", response_model=Task, status_code=201)
async def create_task(body: TaskCreate, actor: UserPublic = Depends(require_manager)):
    if not body.assignee_ids:
        raise HTTPException(400, "At least one assignee is required")
    # Fetch assignees + role check
    assignees = await db.users.find({"id": {"$in": body.assignee_ids}}, {"_id": 0}).to_list(200)
    if len(assignees) != len(set(body.assignee_ids)):
        raise HTTPException(400, "One or more assignees not found")
    # Cross-role assignments are allowed: assignees may be admin, manager, or floor_manager.
    # Project validation
    project = None
    if body.project_id:
        project = await db.projects.find_one({"id": body.project_id}, {"_id": 0})
        if not project:
            raise HTTPException(400, "Project not found")
        if project.get("status") == "closed":
            raise HTTPException(400, "Cannot add tasks to a closed project")
        if not (_project_manager(project, actor) or _project_creator(project, actor)):
            raise HTTPException(403, "You are not a manager of this project")
    now = datetime.now(timezone.utc)
    task_id = str(uuid.uuid4())
    assignments = [
        {
            "id": str(uuid.uuid4()),
            "assignee_id": a["id"],
            "status": "pending",
            "rounds": [],
            "final_rating": None,
            "approved_at": None,
        }
        for a in assignees
    ]
    doc = {
        "id": task_id,
        "title": body.title.strip(),
        "description": (body.description or "").strip(),
        "category": body.category,
        "project_id": body.project_id,
        "priority": body.priority,
        "due_date": body.due_date,
        "recurrence": body.recurrence.model_dump(mode="json") if (body.recurrence and body.recurrence.enabled) else None,
        "parent_task_id": None,
        "occurrence_seq": 1,
        "assignments": assignments,
        "created_by": actor.id,
        "created_at": now,
        "updated_at": now,
    }
    await db.tasks.insert_one(doc)
    await log_activity(actor, "task_created", "task", task_id, {
        "title": body.title,
        "assignee_ids": body.assignee_ids,
        "project_id": body.project_id,
    })
    return _task_for_user(await _hydrate_task(doc), actor)

@api.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str, user: UserPublic = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if not await _task_visible_to(doc, user):
        raise HTTPException(403, "Forbidden")
    return _task_for_user(await _hydrate_task(doc), user)

@api.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdate,
                      user: UserPublic = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if not _task_creator(doc, user):
        raise HTTPException(403, "Only the task creator can edit")
    payload = body.dict(exclude_unset=True)
    updates = {k: v for k, v in payload.items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.tasks.update_one({"id": task_id}, {"$set": updates})
        await log_activity(user, "task_updated", "task", task_id, updates)
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return _task_for_user(await _hydrate_task(doc), user)

@api.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, actor: UserPublic = Depends(require_manager)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if not _task_creator(doc, actor):
        raise HTTPException(403, "Only the task creator can delete")
    await db.tasks.delete_one({"id": task_id})
    await log_activity(actor, "task_deleted", "task", task_id, {"title": doc["title"]})

# ---- assignment sub-actions ----
def _find_assignment(doc: dict, assignment_id: str) -> Optional[dict]:
    for a in doc.get("assignments", []):
        if a["id"] == assignment_id:
            return a
    return None

@api.post("/tasks/{task_id}/assignments/{assignment_id}/status", response_model=Task)
async def assignment_status(task_id: str, assignment_id: str, body: AssignmentStatusBody,
                            user: UserPublic = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    a = _find_assignment(doc, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    if a["assignee_id"] != user.id:
        raise HTTPException(403, "Not your assignment")
    if a.get("status") in ("submitted", "approved"):
        raise HTTPException(400, "Cannot change status in current state")
    await db.tasks.update_one(
        {"id": task_id, "assignments.id": assignment_id},
        {"$set": {"assignments.$.status": body.status,
                  "updated_at": datetime.now(timezone.utc)}},
    )
    await log_activity(user, f"assignment_{body.status}", "task", task_id,
                       {"assignment_id": assignment_id})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return _task_for_user(await _hydrate_task(doc), user)

@api.post("/tasks/{task_id}/assignments/{assignment_id}/submit", response_model=Task)
async def assignment_submit(task_id: str, assignment_id: str, body: SubmitBody,
                            user: UserPublic = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    a = _find_assignment(doc, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    if a["assignee_id"] != user.id:
        raise HTTPException(403, "Not your assignment")
    if a.get("status") == "approved":
        raise HTTPException(400, "Already approved")
    try:
        photos, files, note = _normalize_submission_payload(body)
    except AttachmentValidationError as exc:
        raise HTTPException(400, str(exc)) from exc
    now = datetime.now(timezone.utc)
    round_doc = {
        "id": str(uuid.uuid4()),
        "submitted_at": now,
        "photos": photos,
        "files": files,
        "note": note,
        "decision": None,
        "rating": None,
        "feedback": None,
        "reviewed_by": None,
        "reviewed_at": None,
    }
    await db.tasks.update_one(
        {"id": task_id, "assignments.id": assignment_id},
        {"$set": {"assignments.$.status": "submitted", "updated_at": now},
         "$push": {"assignments.$.rounds": round_doc}},
    )
    await log_activity(user, "assignment_submitted", "task", task_id,
                       {"assignment_id": assignment_id, "round_id": round_doc["id"]})
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return _task_for_user(await _hydrate_task(doc), user)

@api.post("/tasks/{task_id}/assignments/{assignment_id}/review", response_model=Task)
async def assignment_review(task_id: str, assignment_id: str, body: ReviewBody,
                            user: UserPublic = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if not await _can_review_task(doc, user):
        raise HTTPException(403, "Only creator, admin, or project manager can review")
    a = _find_assignment(doc, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    if a.get("status") != "submitted":
        raise HTTPException(400, "Assignment is not awaiting review")
    rounds = a.get("rounds", [])
    if not rounds:
        raise HTTPException(400, "No submission to review")
    last = rounds[-1]
    if last.get("decision") is not None:
        raise HTTPException(400, "This submission has already been reviewed")

    now = datetime.now(timezone.utc)
    new_status: AssignmentStatus = "approved" if body.decision == "approve" else "rejected"

    # Update the last round
    round_updates = {
        f"assignments.$.rounds.{len(rounds)-1}.decision": body.decision,
        f"assignments.$.rounds.{len(rounds)-1}.rating": body.rating,
        f"assignments.$.rounds.{len(rounds)-1}.feedback": body.feedback or "",
        f"assignments.$.rounds.{len(rounds)-1}.reviewed_by": user.id,
        f"assignments.$.rounds.{len(rounds)-1}.reviewed_at": now,
        "assignments.$.status": new_status,
        "updated_at": now,
    }
    if body.decision == "approve":
        # compute average of ALL round ratings (including this one)
        ratings = [r.get("rating") for r in rounds[:-1] if r.get("rating") is not None]
        ratings.append(body.rating)
        avg = round(sum(ratings) / len(ratings), 2) if ratings else float(body.rating)
        round_updates["assignments.$.final_rating"] = avg
        round_updates["assignments.$.approved_at"] = now
    await db.tasks.update_one(
        {"id": task_id, "assignments.id": assignment_id},
        {"$set": round_updates},
    )
    await log_activity(user, f"assignment_{body.decision}", "task", task_id, {
        "assignment_id": assignment_id,
        "rating": body.rating,
        "feedback": body.feedback or "",
    })
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    # If this approval completes a recurring task, spawn the next occurrence.
    if body.decision == "approve":
        await _maybe_generate_next_recurrence(doc, user)
    return await _hydrate_task(doc)

# ------------------------------------------------------------------
# Analytics
# ------------------------------------------------------------------
class DashboardStats(BaseModel):
    total_tasks: int
    active_tasks: int
    in_review: int
    completed_tasks: int
    overdue: int
    total_projects: int
    active_projects: int
    total_floor_managers: int
    total_managers: int
    top_floor_managers: List[Dict[str, Any]] = []

@api.get("/stats/dashboard", response_model=DashboardStats)
async def dashboard_stats(user: UserPublic = Depends(get_current_user)):
    scope = await _task_scope_for(user)
    now = datetime.now(timezone.utc)
    total = await db.tasks.count_documents(scope)
    # completed = every assignment approved
    completed = 0
    active = 0
    in_review = 0
    overdue = 0
    cursor = db.tasks.find(scope, {"_id": 0, "assignments": 1, "due_date": 1})
    async for t in cursor:
        assigns = t.get("assignments", [])
        if assigns and all(a.get("status") == "approved" for a in assigns):
            completed += 1
        else:
            active += 1
            if any(a.get("status") == "submitted" for a in assigns):
                in_review += 1
            due = t.get("due_date")
            if due:
                # Legacy docs may be offset-naive; treat as UTC
                if due.tzinfo is None:
                    due = due.replace(tzinfo=timezone.utc)
                if due < now:
                    overdue += 1
    total_projects = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": {"$ne": "closed"}})
    # Scope project counts for ALL roles (strict membership).
    project_scope = {"$or": [
        {"manager_ids": user.id},
        {"floor_manager_ids": user.id},
        {"created_by": user.id},
    ]}
    total_projects = await db.projects.count_documents(project_scope)
    active_projects = await db.projects.count_documents(
        {"$and": [project_scope, {"status": {"$ne": "closed"}}]}
    )
    total_floor_managers = await db.users.count_documents({"role": "floor_manager"})
    total_managers = await db.users.count_documents({"role": "manager"})

    # top floor managers by avg rating — only shown when caller has scope to see them
    top: List[Dict[str, Any]] = []
    if user.role in ("admin", "manager"):
        visible_task_ids = [t["id"] async for t in db.tasks.find(scope, {"_id": 0, "id": 1})]
        pipeline = [
            {"$match": {"id": {"$in": visible_task_ids}}},
            {"$unwind": "$assignments"},
            {"$match": {"assignments.status": "approved",
                        "assignments.final_rating": {"$ne": None}}},
            {"$group": {
                "_id": "$assignments.assignee_id",
                "avg_rating": {"$avg": "$assignments.final_rating"},
                "completed": {"$sum": 1},
            }},
            {"$sort": {"avg_rating": -1, "completed": -1}},
            {"$limit": 5},
        ]
        async for row in db.tasks.aggregate(pipeline):
            u = await db.users.find_one({"id": row["_id"]}, {"_id": 0, "name": 1, "role": 1})
            if u:
                top.append({
                    "id": row["_id"],
                    "name": u["name"],
                    "role": u["role"],
                    "avg_rating": round(row["avg_rating"] or 0.0, 2),
                    "completed": row["completed"],
                })

    return DashboardStats(
        total_tasks=total,
        active_tasks=active,
        in_review=in_review,
        completed_tasks=completed,
        overdue=overdue,
        total_projects=total_projects,
        active_projects=active_projects,
        total_floor_managers=total_floor_managers,
        total_managers=total_managers,
        top_floor_managers=top,
    )

class ProjectStats(BaseModel):
    project: Project
    tasks_by_status: Dict[str, int]
    tasks_by_priority: Dict[str, int]
    avg_task_rating: float
    floor_manager_leaderboard: List[Dict[str, Any]]

@api.get("/stats/projects/{project_id}", response_model=ProjectStats)
async def project_stats(project_id: str, user: UserPublic = Depends(get_current_user)):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if not _project_visible_to(doc, user):
        raise HTTPException(403, "Forbidden")
    tasks_by_status = {"pending": 0, "in_progress": 0, "in_review": 0, "completed": 0}
    tasks_by_priority = {"low": 0, "medium": 0, "high": 0, "urgent": 0}
    ratings: List[float] = []
    floor_manager_agg: Dict[str, Dict[str, Any]] = {}
    cursor = db.tasks.find({"project_id": project_id}, {"_id": 0})
    async for t in cursor:
        st = _compute_overall_status(t.get("assignments", []))
        tasks_by_status[st] = tasks_by_status.get(st, 0) + 1
        p = t.get("priority", "medium")
        tasks_by_priority[p] = tasks_by_priority.get(p, 0) + 1
        for a in t.get("assignments", []):
            if a.get("status") == "approved" and a.get("final_rating") is not None:
                ratings.append(a["final_rating"])
                key = a["assignee_id"]
                floor_manager_agg.setdefault(key, {"total": 0.0, "count": 0})
                floor_manager_agg[key]["total"] += a["final_rating"]
                floor_manager_agg[key]["count"] += 1
    leaderboard = []
    for uid, v in floor_manager_agg.items():
        u = await db.users.find_one({"id": uid}, {"_id": 0, "name": 1})
        leaderboard.append({
            "id": uid,
            "name": (u or {}).get("name", "—"),
            "avg_rating": round(v["total"] / v["count"], 2) if v["count"] else 0,
            "completed": v["count"],
        })
    leaderboard.sort(key=lambda x: (-x["avg_rating"], -x["completed"]))
    avg = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
    return ProjectStats(
        project=await _hydrate_project(doc),
        tasks_by_status=tasks_by_status,
        tasks_by_priority=tasks_by_priority,
        avg_task_rating=avg,
        floor_manager_leaderboard=leaderboard[:10],
    )

# ------------------------------------------------------------------
# Activity Logs
# ------------------------------------------------------------------
@api.get("/logs", response_model=List[ActivityLog])
async def list_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    limit: int = 50,
    user: UserPublic = Depends(get_current_user),
):
    q: Dict[str, Any] = {}
    if entity_type:
        q["entity_type"] = entity_type
    if entity_id:
        q["entity_id"] = entity_id
    if actor_id:
        q["actor_id"] = actor_id
    if user.role == "floor_manager":
        q = _combine_query(q, {"$or": [{"actor_id": user.id}, {"entity_id": user.id}]})
    else:
        # admin + manager both scoped to their visible tasks and managed projects (strict).
        project_ids = await _managed_project_ids(user)
        visible_tasks = await db.tasks.find(
            await _task_scope_for(user),
            {"_id": 0, "id": 1},
        ).to_list(1000)
        task_ids = [task["id"] for task in visible_tasks]
        q = _combine_query(q, {"$or": [
            {"actor_id": user.id},
            {"entity_type": "project", "entity_id": {"$in": project_ids}},
            {"entity_type": "task", "entity_id": {"$in": task_ids}},
            {"entity_type": "user", "entity_id": user.id},
        ]})
    safe_limit = min(max(limit, 1), 200)
    docs = await db.activity_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(safe_limit)
    return [ActivityLog(**d) for d in docs]

# ------------------------------------------------------------------
# AI  (unchanged from v1)
# ------------------------------------------------------------------
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
AI_MODEL = ("openai", "gpt-4o")

CONCIERGE_SYSTEM_PROMPT = (
    "You are the Estate Concierge for the Scindia Royal Household — a dignified, "
    "warm, and highly organised assistant to the Maharaja, household managers, and "
    "floor managers. You help draft memos, plan events, suggest checklists (state dinners, "
    "guest arrivals, seasonal wardrobe changes), summarise task backlogs, and "
    "answer household operations questions with concise, elegant British-Indian "
    "prose. Keep replies short (under 180 words) unless the user asks for detail. "
    "Never invent specific staff names, dates, or numbers you were not given."
)

TASK_PARSER_SYSTEM_PROMPT = (
    "You extract structured task fields from a natural-language household instruction "
    "for the Scindia Royal Household app. Reply with a single JSON object (no markdown, "
    "no prose, no code fences) containing ONLY these keys: title, description, "
    'category (one of ["Housekeeping","Culinary","Chauffeur","Grounds & Estate",'
    '"Security","Family Office","Guest Relations","Wardrobe"] or null), '
    'priority ("low"|"medium"|"high"|"urgent"), due_date_iso (UTC ISO 8601 or null), '
    'is_recurring (bool), recurrence ("daily"|"weekly"|"monthly" or null). '
    "Current UTC time: {now_iso}. Interpret relative phrases against this time."
)

class TaskParseBody(BaseModel):
    text: str

class ParsedTask(BaseModel):
    title: str
    description: str = ""
    category: Optional[str] = None
    priority: Priority = "medium"
    due_date_iso: Optional[str] = None
    is_recurring: bool = False
    recurrence: Optional[Literal["daily", "weekly", "monthly"]] = None

@api.post("/ai/task-parse", response_model=ParsedTask)
async def ai_task_parse(body: TaskParseBody, request: Request, user: UserPublic = Depends(require_manager)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI is not configured")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Please describe the task")
    _ensure_ai_rate_allowed(request, user, "task-parse")
    now_iso = datetime.now(timezone.utc).isoformat()
    system_prompt = TASK_PARSER_SYSTEM_PROMPT.replace("{now_iso}", now_iso)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"task-parse-{user.id}-{uuid.uuid4()}",
        system_message=system_prompt,
    ).with_model(*AI_MODEL)
    try:
        reply = await chat.send_message(UserMessage(text=text))
    except Exception as e:
        logger.warning(f"AI task-parse failed: {e}")
        raise HTTPException(502, "AI service unavailable")
    raw = (reply or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        data = json.loads(raw)
    except Exception:
        raise HTTPException(502, "AI returned an unreadable response")
    allowed_cats = {"Housekeeping", "Culinary", "Chauffeur", "Grounds & Estate",
                    "Security", "Family Office", "Guest Relations", "Wardrobe"}
    cat = data.get("category")
    if cat and cat not in allowed_cats:
        cat = None
    prio = data.get("priority") or "medium"
    if prio not in ("low", "medium", "high", "urgent"):
        prio = "medium"
    rec = data.get("recurrence")
    if rec not in ("daily", "weekly", "monthly", None):
        rec = None
    return ParsedTask(
        title=str(data.get("title") or text)[:80],
        description=str(data.get("description") or ""),
        category=cat,
        priority=prio,
        due_date_iso=data.get("due_date_iso") or None,
        is_recurring=bool(data.get("is_recurring") or False),
        recurrence=rec,
    )

class ChatSendBody(BaseModel):
    session_id: Optional[str] = None
    message: str

class ChatMessage(BaseModel):
    id: str
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime

class ChatSendResponse(BaseModel):
    session_id: str
    reply: ChatMessage

@api.post("/ai/chat/send", response_model=ChatSendResponse)
async def ai_chat_send(body: ChatSendBody, request: Request, user: UserPublic = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI is not configured")
    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(400, "Message is empty")
    _ensure_ai_rate_allowed(request, user, "chat")
    session_id = body.session_id or f"concierge-{user.id}-{uuid.uuid4()}"
    history = await db.chat_messages.find(
        {"user_id": user.id, "session_id": session_id},
        {"_id": 0},
    ).sort("created_at", 1).to_list(200)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=CONCIERGE_SYSTEM_PROMPT,
    ).with_model(*AI_MODEL)
    now = datetime.now(timezone.utc)
    user_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "session_id": session_id,
        "role": "user",
        "content": msg,
        "created_at": now,
    }
    await db.chat_messages.insert_one(user_doc)
    prior_text = ""
    if history:
        parts = [f"{m.get('role','user').upper()}: {m.get('content','')}" for m in history[-16:]]
        prior_text = "PRIOR CONVERSATION (for context only):\n" + "\n".join(parts) + "\n\nNEW USER MESSAGE:\n"
    try:
        reply_text = await chat.send_message(UserMessage(text=prior_text + msg))
    except Exception as e:
        logger.warning(f"AI concierge failed: {e}")
        raise HTTPException(502, "AI service unavailable")
    reply_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "session_id": session_id,
        "role": "assistant",
        "content": (reply_text or "").strip(),
        "created_at": datetime.now(timezone.utc),
    }
    await db.chat_messages.insert_one(reply_doc)
    return ChatSendResponse(
        session_id=session_id,
        reply=ChatMessage(**{k: reply_doc[k] for k in ("id","session_id","role","content","created_at")}),
    )

@api.get("/ai/chat/history", response_model=List[ChatMessage])
async def ai_chat_history(session_id: str, user: UserPublic = Depends(get_current_user)):
    docs = await db.chat_messages.find(
        {"user_id": user.id, "session_id": session_id}, {"_id": 0},
    ).sort("created_at", 1).to_list(500)
    return [ChatMessage(**{k: d[k] for k in ("id","session_id","role","content","created_at")}) for d in docs]

@api.delete("/ai/chat/history", status_code=204)
async def ai_chat_history_clear(session_id: str, user: UserPublic = Depends(get_current_user)):
    await db.chat_messages.delete_many({"user_id": user.id, "session_id": session_id})

@api.get("/")
async def root():
    return {"service": "Scindia Household API", "ok": True, "version": "2.1"}

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    return response

# ------------------------------------------------------------------
# Review queue + Weekly digest
# ------------------------------------------------------------------
class PendingReview(BaseModel):
    task_id: str
    task_title: str
    project_name: Optional[str] = None
    assignment_id: str
    assignee_name: str
    assignee_role: Optional[Role] = None
    round_index: int
    submitted_at: datetime
    priority: Priority

@api.get("/reviews/pending", response_model=List[PendingReview])
async def pending_reviews(user: UserPublic = Depends(get_current_user)):
    if user.role == "floor_manager":
        return []
    project_ids = await _managed_project_ids(user)
    q: Dict[str, Any] = {
        "assignments.status": "submitted",
        "$or": [
            {"created_by": user.id},
            {"project_id": {"$in": project_ids}},
        ],
    }
    docs = await db.tasks.find(q, {"_id": 0}).sort("updated_at", -1).to_list(500)
    out: List[PendingReview] = []
    for t in docs:
        proj = None
        if t.get("project_id"):
            p = await db.projects.find_one({"id": t["project_id"]}, {"_id": 0, "name": 1})
            proj = (p or {}).get("name")
        for a in t.get("assignments", []):
            if a.get("status") != "submitted":
                continue
            u = await db.users.find_one({"id": a["assignee_id"]}, {"_id": 0, "name": 1, "role": 1})
            rounds = a.get("rounds", [])
            last = rounds[-1] if rounds else None
            out.append(PendingReview(
                task_id=t["id"],
                task_title=t["title"],
                project_name=proj,
                assignment_id=a["id"],
                assignee_name=(u or {}).get("name", "—"),
                assignee_role=(u or {}).get("role"),
                round_index=len(rounds),
                submitted_at=(last or {}).get("submitted_at") or t["updated_at"],
                priority=t.get("priority", "medium"),
            ))
    out.sort(key=lambda r: r.submitted_at, reverse=True)
    return out

# ------------------------------------------------------------------
# Wire up
# ------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=parse_cors_origins(os.environ.get("CORS_ORIGINS") or os.environ.get("FRONTEND_URL")),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
