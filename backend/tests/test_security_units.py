import base64
import importlib
import os
import sys
import types
from datetime import datetime, timezone
from pathlib import Path

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "security_unit_tests")
os.environ.setdefault("JWT_SECRET", "unit-test-secret")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

chat_module = types.ModuleType("emergentintegrations.llm.chat")
chat_module.LlmChat = object
chat_module.UserMessage = object
llm_module = types.ModuleType("emergentintegrations.llm")
emergent_module = types.ModuleType("emergentintegrations")
sys.modules.setdefault("emergentintegrations", emergent_module)
sys.modules.setdefault("emergentintegrations.llm", llm_module)
sys.modules.setdefault("emergentintegrations.llm.chat", chat_module)

server = importlib.import_module("server")
Attachment = server.Attachment
AttachmentValidationError = server.AttachmentValidationError
SubmitBody = server.SubmitBody
UserPublic = server.UserPublic
_normalize_submission_payload = server._normalize_submission_payload
_project_manager = server._project_manager
parse_cors_origins = server.parse_cors_origins


@pytest.fixture
def anyio_backend():
    return "asyncio"


class _FakeRequest:
    def __init__(self, headers=None, host="198.51.100.10"):
        self.headers = headers or {}
        self.client = types.SimpleNamespace(host=host)


class _FakeUsersCursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *_args):
        return self

    async def to_list(self, _limit):
        return self.docs


class _FakeUsersCollection:
    def __init__(self, docs):
        self.docs = docs
        self.last_query = None

    def find(self, query, _projection):
        self.last_query = query
        return _FakeUsersCursor(self.docs)


class _FakeDb:
    def __init__(self, docs):
        self.users = _FakeUsersCollection(docs)


def test_parse_cors_origins_ignores_wildcard_with_credentials():
    assert "*" not in parse_cors_origins("*")


def test_project_manager_requires_manager_role():
    user = UserPublic(
        id="user-1",
        name="Tasker",
        email="tasker@example.com",
        role="tasker",
        created_at=datetime.now(timezone.utc),
    )
    assert not _project_manager({"manager_ids": ["user-1"]}, user)


def test_submission_rejects_active_html_attachment():
    body = SubmitBody(
        photos=[],
        files=[
            Attachment(
                id="file-1",
                name="payload.html",
                mime="text/html",
                size=0,
                data_uri="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
            )
        ],
        note="",
    )
    with pytest.raises(AttachmentValidationError):
        _normalize_submission_payload(body)


def test_submission_rejects_spaced_svg_mime():
    payload = base64.b64encode(b"<svg><script>alert(1)</script></svg>").decode("ascii")
    body = SubmitBody(
        photos=[],
        files=[
            Attachment(
                id="file-1",
                name="payload.svg",
                mime="image/png",
                size=0,
                data_uri=f"data:image/svg+xml ;base64,{payload}",
            )
        ],
        note="",
    )

    with pytest.raises(AttachmentValidationError):
        _normalize_submission_payload(body)


def test_submission_rejects_aggregate_decoded_size(monkeypatch):
    monkeypatch.setattr(server, "MAX_SUBMISSION_DECODED_BYTES", 8)
    payload = base64.b64encode(b"hello").decode("ascii")
    body = SubmitBody(
        photos=[],
        files=[
            Attachment(id="file-1", name="a.txt", mime="text/plain", size=0, data_uri=f"data:text/plain;base64,{payload}"),
            Attachment(id="file-2", name="b.txt", mime="text/plain", size=0, data_uri=f"data:text/plain;base64,{payload}"),
        ],
        note="",
    )

    with pytest.raises(AttachmentValidationError):
        _normalize_submission_payload(body)


def test_submission_normalizes_attachment_size():
    payload = base64.b64encode(b"hello").decode("ascii")
    body = SubmitBody(
        photos=[],
        files=[
            Attachment(
                id="file-1",
                name="../report.pdf",
                mime="application/pdf",
                size=999,
                data_uri=f"data:application/pdf;base64,{payload}",
            )
        ],
        note="",
    )
    _, files, _ = _normalize_submission_payload(body)
    assert files[0]["name"] == "report.pdf"
    assert files[0]["size"] == 5


def test_login_failure_key_ignores_spoofed_forwarded_for_by_default(monkeypatch):
    monkeypatch.setattr(server, "TRUST_PROXY_HEADERS", False)
    request_a = _FakeRequest(headers={"x-forwarded-for": "203.0.113.1"}, host="198.51.100.25")
    request_b = _FakeRequest(headers={"x-forwarded-for": "203.0.113.2"}, host="198.51.100.25")

    assert server._login_failure_key(request_a, "User@Example.com") == server._login_failure_key(
        request_b,
        "user@example.com",
    )


def test_project_creator_visibility_requires_current_manager_role():
    user = UserPublic(
        id="creator-1",
        name="Downgraded Creator",
        email="creator@example.com",
        role="tasker",
        created_at=datetime.now(timezone.utc),
    )

    assert not server._project_visible_to({"created_by": "creator-1", "manager_ids": [], "tasker_ids": []}, user)


@pytest.mark.anyio
async def test_task_creator_visibility_requires_current_manager_role():
    user = UserPublic(
        id="creator-1",
        name="Downgraded Creator",
        email="creator@example.com",
        role="tasker",
        created_at=datetime.now(timezone.utc),
    )

    assert not await server._task_visible_to({"created_by": "creator-1", "assignments": []}, user)


@pytest.mark.anyio
async def test_task_creator_review_requires_current_manager_role():
    user = UserPublic(
        id="creator-1",
        name="Downgraded Creator",
        email="creator@example.com",
        role="tasker",
        created_at=datetime.now(timezone.utc),
    )

    assert not await server._can_review_task({"created_by": "creator-1"}, user)


def test_tasker_task_response_redacts_other_assignments():
    now = datetime.now(timezone.utc)
    tasker = UserPublic(
        id="tasker-1",
        name="Tasker One",
        email="tasker1@example.com",
        role="tasker",
        created_at=now,
    )
    task = server.Task(
        id="task-1",
        title="Shared task",
        priority="medium",
        assignments=[
            server.TaskAssignment(
                id="assignment-1",
                assignee_id="tasker-1",
                assignee_name="Tasker One",
                status="submitted",
                rounds=[server.ReviewRound(id="round-own", submitted_at=now, photos=["data:image/png;base64,aA=="], note="own")],
                final_rating=4.0,
            ),
            server.TaskAssignment(
                id="assignment-2",
                assignee_id="tasker-2",
                assignee_name="Tasker Two",
                status="approved",
                rounds=[
                    server.ReviewRound(
                        id="round-other",
                        submitted_at=now,
                        photos=["data:image/png;base64,aA=="],
                        files=[
                            Attachment(
                                id="file-1",
                                name="private.txt",
                                mime="text/plain",
                                size=5,
                                data_uri="data:text/plain;base64,aGVsbG8=",
                            )
                        ],
                        note="private",
                        decision="approve",
                        rating=5,
                        feedback="private feedback",
                    )
                ],
                final_rating=5.0,
                approved_at=now,
            ),
        ],
        created_by="manager-1",
        created_at=now,
        updated_at=now,
    )

    redacted = server._task_for_user(task, tasker)

    assert redacted.assignments[0].rounds[0].note == "own"
    assert redacted.assignments[1].rounds == []
    assert redacted.assignments[1].final_rating is None
    assert redacted.assignments[1].approved_at is None


def test_ai_rate_limit_blocks_repeated_calls(monkeypatch):
    monkeypatch.setattr(server, "AI_RATE_LIMIT", 1)
    monkeypatch.setattr(server, "AI_RATE_LIMITS", {})
    user = UserPublic(
        id="user-1",
        name="User",
        email="user@example.com",
        role="tasker",
        created_at=datetime.now(timezone.utc),
    )
    request = _FakeRequest(host="198.51.100.30")

    server._ensure_ai_rate_allowed(request, user, "chat")
    with pytest.raises(server.HTTPException) as exc_info:
        server._ensure_ai_rate_allowed(request, user, "chat")

    assert exc_info.value.status_code == 429


@pytest.mark.anyio
async def test_manager_user_list_excludes_admins(monkeypatch):
    manager = UserPublic(
        id="manager-1",
        name="Manager",
        email="manager@example.com",
        role="manager",
        created_at=datetime.now(timezone.utc),
    )
    fake_db = _FakeDb([])
    monkeypatch.setattr(server, "db", fake_db)

    await server.list_users(user=manager)

    assert fake_db.users.last_query == {"role": {"$ne": "admin"}}


@pytest.mark.anyio
async def test_manager_cannot_request_admin_user_list():
    manager = UserPublic(
        id="manager-1",
        name="Manager",
        email="manager@example.com",
        role="manager",
        created_at=datetime.now(timezone.utc),
    )

    with pytest.raises(server.HTTPException) as exc_info:
        await server.list_users(role="admin", user=manager)

    assert exc_info.value.status_code == 403
