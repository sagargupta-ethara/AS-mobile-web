"""
Scindia Royal Household — Staff & Task Management backend (v2).
Roles: admin / manager / tasker.
Adds Projects, per-assignee task sub-completions, multi-round review with
star ratings, activity log, and analytics.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
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
from datetime import datetime, timedelta, timezone
import json

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

app = FastAPI(title="Scindia Household API v2")
api = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Types
# ------------------------------------------------------------------
Role = Literal["admin", "manager", "tasker"]
Priority = Literal["low", "medium", "high", "urgent"]
ProjectStatus = Literal["active", "closure_proposed", "closed"]
AssignmentStatus = Literal["pending", "in_progress", "submitted", "rejected", "approved"]

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
    created_at: datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: Role = "tasker"
    avatar: Optional[str] = None

class LoginBody(BaseModel):
    email: EmailStr
    password: str

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
    tasker_ids: List[str] = Field(default_factory=list)

class ProjectMembersBody(BaseModel):
    manager_ids: Optional[List[str]] = None
    tasker_ids: Optional[List[str]] = None

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
    taskers: List[UserRef] = []
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

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = None
    project_id: Optional[str] = None
    assignee_ids: List[str]
    priority: Priority = "medium"
    due_date: Optional[datetime] = None
    is_recurring: bool = False
    recurrence: Optional[Literal["daily", "weekly", "monthly"]] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[Priority] = None
    due_date: Optional[datetime] = None
    is_recurring: Optional[bool] = None
    recurrence: Optional[Literal["daily", "weekly", "monthly"]] = None

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
    is_recurring: bool = False
    recurrence: Optional[str] = None
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

async def _user_avg_rating(user_id: str) -> tuple[float, int]:
    """Compute avg rating across all approved assignments for a tasker."""
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
    avg, cnt = await _user_avg_rating(doc["id"])
    return UserPublic(
        id=doc["id"],
        name=doc["name"],
        email=doc["email"],
        phone=doc.get("phone"),
        role=doc["role"],
        avatar=doc.get("avatar"),
        avg_rating=avg,
        ratings_count=cnt,
        created_at=doc["created_at"],
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
        is_recurring=doc.get("is_recurring", False),
        recurrence=doc.get("recurrence"),
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
    taskers: List[UserRef] = []
    for uid in doc.get("tasker_ids", []):
        ref = await _user_ref(uid)
        if ref:
            taskers.append(ref)
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
        taskers=taskers,
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
    return user.id in (project.get("manager_ids") or [])

def _project_visible_to(project: dict, user: UserPublic) -> bool:
    if user.role == "admin":
        return True
    if user.id == project.get("created_by"):
        return True
    return (
        user.id in (project.get("manager_ids") or [])
        or user.id in (project.get("tasker_ids") or [])
    )

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

    # Role migration: "staff" -> "tasker"
    migrated = await db.users.update_many({"role": "staff"}, {"$set": {"role": "tasker"}})
    if migrated.modified_count:
        logger.info(f"Migrated {migrated.modified_count} user(s) role staff->tasker")

    # Drop legacy task docs (old schema had assignee_id / proofs — not compatible)
    legacy = await db.tasks.count_documents({"assignments": {"$exists": False}})
    if legacy:
        await db.tasks.delete_many({"assignments": {"$exists": False}})
        logger.info(f"Dropped {legacy} legacy task doc(s)")

    # Seed admin
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
                "created_at": datetime.now(timezone.utc),
                "created_by": None,
            })
            logger.info(f"Seeded admin: {admin_email}")

    # Seed demo manager + tasker so quick-login chips work out-of-the-box
    demo_users = [
        {"name": "Manager Rao", "email": "manager@scindia.royal", "role": "manager"},
        {"name": "Tasker Krishna", "email": "tasker@scindia.royal", "role": "tasker"},
    ]
    for du in demo_users:
        if not await db.users.find_one({"email": du["email"]}, {"_id": 0}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "name": du["name"],
                "email": du["email"],
                "phone": None,
                "hashed_password": hash_password("test1234"),
                "role": du["role"],
                "avatar": None,
                "created_at": datetime.now(timezone.utc),
                "created_by": None,
            })
            logger.info(f"Seeded demo {du['role']}: {du['email']}")

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
async def login(body: LoginBody):
    doc = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not doc or not verify_password(body.password, doc["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    token = create_access_token(doc["id"], doc["role"])
    return Token(access_token=token, user=await _to_user_public(doc))

@api.get("/auth/me", response_model=UserPublic)
async def me(user: UserPublic = Depends(get_current_user)):
    return user

# ------------------------------------------------------------------
# Users / Team
# ------------------------------------------------------------------
@api.get("/users", response_model=List[UserPublic])
async def list_users(role: Optional[Role] = None, user: UserPublic = Depends(get_current_user)):
    # Taskers can only list themselves? Actually allow all authenticated to see team.
    q = {}
    if role:
        q["role"] = role
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
    if user.role == "admin":
        docs = await db.projects.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    else:
        docs = await db.projects.find(
            {"$or": [
                {"manager_ids": user.id},
                {"tasker_ids": user.id},
                {"created_by": user.id},
            ]},
            {"_id": 0},
        ).sort("created_at", -1).to_list(500)
    return [await _hydrate_project(d) for d in docs]

@api.post("/projects", response_model=Project, status_code=201)
async def create_project(body: ProjectCreate, actor: UserPublic = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "description": (body.description or "").strip(),
        "status": "active",
        "created_by": actor.id,
        "manager_ids": list(dict.fromkeys(body.manager_ids or [])),
        "tasker_ids": list(dict.fromkeys(body.tasker_ids or [])),
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
    if user.role != "admin" and not _project_manager(doc, user):
        raise HTTPException(403, "Only admin or project managers can update")
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
    is_admin = user.role == "admin"
    is_manager = _project_manager(doc, user)
    if not (is_admin or is_manager):
        raise HTTPException(403, "Forbidden")
    updates: Dict[str, Any] = {}
    if body.manager_ids is not None:
        if not is_admin:
            raise HTTPException(403, "Only admin can change managers")
        updates["manager_ids"] = list(dict.fromkeys(body.manager_ids))
    if body.tasker_ids is not None:
        updates["tasker_ids"] = list(dict.fromkeys(body.tasker_ids))
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
    if user.role == "manager" and not _project_manager(doc, user):
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
    if user.role == "admin" or _project_manager(doc, user):
        pass
    else:
        raise HTTPException(403, "Only admin or project managers can close")
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
    q: Dict[str, Any] = {}
    if project_id:
        q["project_id"] = project_id
    if user.role == "tasker" or mine:
        q["assignments.assignee_id"] = user.id
    elif assignee_id:
        q["assignments.assignee_id"] = assignee_id
    docs = await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [await _hydrate_task(d) for d in docs]

@api.post("/tasks", response_model=Task, status_code=201)
async def create_task(body: TaskCreate, actor: UserPublic = Depends(require_manager)):
    if not body.assignee_ids:
        raise HTTPException(400, "At least one assignee is required")
    # Fetch assignees + role check
    assignees = await db.users.find({"id": {"$in": body.assignee_ids}}, {"_id": 0}).to_list(200)
    if len(assignees) != len(set(body.assignee_ids)):
        raise HTTPException(400, "One or more assignees not found")
    if actor.role == "manager":
        for a in assignees:
            if a["role"] != "tasker":
                raise HTTPException(403, "Managers can only assign to taskers")
    # Project validation
    project = None
    if body.project_id:
        project = await db.projects.find_one({"id": body.project_id}, {"_id": 0})
        if not project:
            raise HTTPException(400, "Project not found")
        if project.get("status") == "closed":
            raise HTTPException(400, "Cannot add tasks to a closed project")
        if actor.role != "admin" and not _project_manager(project, actor):
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
        "is_recurring": body.is_recurring,
        "recurrence": body.recurrence if body.is_recurring else None,
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
    return await _hydrate_task(doc)

@api.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str, user: UserPublic = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if user.role == "tasker":
        if not any(a["assignee_id"] == user.id for a in doc.get("assignments", [])):
            raise HTTPException(403, "Forbidden")
    return await _hydrate_task(doc)

@api.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, body: TaskUpdate,
                      user: UserPublic = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if user.role == "tasker":
        raise HTTPException(403, "Taskers cannot edit task details")
    if user.role == "manager" and doc["created_by"] != user.id:
        raise HTTPException(403, "Only the creator or admin can edit")
    payload = body.dict(exclude_unset=True)
    updates = {k: v for k, v in payload.items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db.tasks.update_one({"id": task_id}, {"$set": updates})
        await log_activity(user, "task_updated", "task", task_id, updates)
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return await _hydrate_task(doc)

@api.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, actor: UserPublic = Depends(require_manager)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if actor.role == "manager" and doc["created_by"] != actor.id:
        raise HTTPException(403, "Only creator or admin can delete")
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
    if a["assignee_id"] != user.id and user.role != "admin":
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
    return await _hydrate_task(doc)

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
    now = datetime.now(timezone.utc)
    round_doc = {
        "id": str(uuid.uuid4()),
        "submitted_at": now,
        "photos": body.photos or [],
        "files": [f.model_dump() for f in (body.files or [])],
        "note": (body.note or "").strip(),
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
    return await _hydrate_task(doc)

@api.post("/tasks/{task_id}/assignments/{assignment_id}/review", response_model=Task)
async def assignment_review(task_id: str, assignment_id: str, body: ReviewBody,
                            user: UserPublic = Depends(get_current_user)):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    # Only creator or admin can review
    if user.role != "admin" and doc["created_by"] != user.id:
        raise HTTPException(403, "Only creator or admin can review")
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
    total_taskers: int
    total_managers: int
    top_taskers: List[Dict[str, Any]] = []

@api.get("/stats/dashboard", response_model=DashboardStats)
async def dashboard_stats(user: UserPublic = Depends(get_current_user)):
    scope: Dict[str, Any] = {}
    if user.role == "tasker":
        scope["assignments.assignee_id"] = user.id
    elif user.role == "manager":
        scope["$or"] = [
            {"created_by": user.id},
            {"assignments.assignee_id": user.id},
        ]
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
            if t.get("due_date") and t["due_date"] < now:
                overdue += 1
    total_projects = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": {"$ne": "closed"}})
    total_taskers = await db.users.count_documents({"role": "tasker"})
    total_managers = await db.users.count_documents({"role": "manager"})

    # top taskers by avg rating
    top: List[Dict[str, Any]] = []
    if user.role == "admin":
        pipeline = [
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
        total_taskers=total_taskers,
        total_managers=total_managers,
        top_taskers=top,
    )

class ProjectStats(BaseModel):
    project: Project
    tasks_by_status: Dict[str, int]
    tasks_by_priority: Dict[str, int]
    avg_task_rating: float
    tasker_leaderboard: List[Dict[str, Any]]

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
    tasker_agg: Dict[str, Dict[str, Any]] = {}
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
                tasker_agg.setdefault(key, {"total": 0.0, "count": 0})
                tasker_agg[key]["total"] += a["final_rating"]
                tasker_agg[key]["count"] += 1
    leaderboard = []
    for uid, v in tasker_agg.items():
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
        tasker_leaderboard=leaderboard[:10],
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
    if user.role == "tasker":
        # taskers can only see logs relating to themselves (as actor or entity)
        q = {**q, "$or": [{"actor_id": user.id}, {"entity_id": user.id}]}
    docs = await db.activity_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 200))
    return [ActivityLog(**d) for d in docs]

# ------------------------------------------------------------------
# AI  (unchanged from v1)
# ------------------------------------------------------------------
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
AI_MODEL = ("openai", "gpt-4o")

CONCIERGE_SYSTEM_PROMPT = (
    "You are the Estate Concierge for the Scindia Royal Household — a dignified, "
    "warm, and highly organised assistant to the Maharaja, household managers, and "
    "taskers. You help draft memos, plan events, suggest checklists (state dinners, "
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
async def ai_task_parse(body: TaskParseBody, user: UserPublic = Depends(require_manager)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI is not configured")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Please describe the task")
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
async def ai_chat_send(body: ChatSendBody, user: UserPublic = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI is not configured")
    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(400, "Message is empty")
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
    if user.role == "tasker":
        return []
    q: Dict[str, Any] = {"assignments.status": "submitted"}
    if user.role == "manager":
        q["created_by"] = user.id
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
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
