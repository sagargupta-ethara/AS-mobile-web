"""Tests for AI endpoints: /api/ai/task-parse and /api/ai/chat/*"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://team-control-29.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@scindia.royal"
ADMIN_PASSWORD = "Royal@2026"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def staff_token(admin_token):
    email = f"test_staff_ai_{uuid.uuid4().hex[:6]}@scindia.royal"
    payload = {"name": "TEST Staff AI", "email": email, "password": "Staff@2026", "role": "staff"}
    r = requests.post(
        f"{API}/users",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=30,
    )
    assert r.status_code == 201, f"create staff failed: {r.status_code} {r.text}"
    staff_id = r.json()["id"]
    login = requests.post(f"{API}/auth/login", json={"email": email, "password": "Staff@2026"}, timeout=30)
    assert login.status_code == 200
    token = login.json()["access_token"]
    yield token
    # cleanup
    requests.delete(f"{API}/users/{staff_id}", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- task-parse ----------------
class TestTaskParse:
    def test_task_parse_success(self, admin_token):
        body = {"text": "Prepare drawing room for tea with 6 guests at 4pm tomorrow, urgent"}
        r = requests.post(f"{API}/ai/task-parse", json=body, headers=_auth(admin_token), timeout=60)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        # structure
        for k in ("title", "description", "category", "priority", "due_date_iso", "is_recurring", "recurrence"):
            assert k in data
        assert isinstance(data["title"], str) and len(data["title"]) > 0
        assert data["priority"] in ("low", "medium", "high", "urgent")
        # semantic checks (best-effort)
        assert data["priority"] in ("high", "urgent"), f"expected high/urgent, got {data['priority']}"
        if data.get("category"):
            assert data["category"] in ("Guest Relations", "Housekeeping", "Culinary")
        assert data["due_date_iso"], "expected a due_date_iso"

    def test_task_parse_empty_400(self, admin_token):
        r = requests.post(f"{API}/ai/task-parse", json={"text": "   "}, headers=_auth(admin_token), timeout=30)
        assert r.status_code == 400, f"{r.status_code} {r.text}"

    def test_task_parse_staff_forbidden(self, staff_token):
        r = requests.post(
            f"{API}/ai/task-parse",
            json={"text": "Polish silver tomorrow"},
            headers=_auth(staff_token),
            timeout=30,
        )
        assert r.status_code == 403, f"{r.status_code} {r.text}"

    def test_task_parse_unauth_401(self):
        r = requests.post(f"{API}/ai/task-parse", json={"text": "anything"}, timeout=30)
        assert r.status_code == 401


# ---------------- chat ----------------
class TestChat:
    def test_chat_send_new_session(self, admin_token):
        r = requests.post(
            f"{API}/ai/chat/send",
            json={"message": "Hello, briefly introduce yourself."},
            headers=_auth(admin_token),
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        d = r.json()
        assert d.get("session_id")
        assert d["reply"]["role"] == "assistant"
        assert len(d["reply"]["content"]) > 0
        # cleanup
        requests.delete(
            f"{API}/ai/chat/history",
            params={"session_id": d["session_id"]},
            headers=_auth(admin_token),
            timeout=30,
        )

    def test_chat_context_memory(self, admin_token):
        session_id = None
        r1 = requests.post(
            f"{API}/ai/chat/send",
            json={"message": "My name is Ram. Please remember it."},
            headers=_auth(admin_token),
            timeout=60,
        )
        assert r1.status_code == 200
        session_id = r1.json()["session_id"]
        # small delay
        time.sleep(1)
        r2 = requests.post(
            f"{API}/ai/chat/send",
            json={"session_id": session_id, "message": "What is my name?"},
            headers=_auth(admin_token),
            timeout=60,
        )
        assert r2.status_code == 200
        reply = r2.json()["reply"]["content"]
        assert "Ram" in reply, f"context lost; reply: {reply}"
        # cleanup
        requests.delete(
            f"{API}/ai/chat/history",
            params={"session_id": session_id},
            headers=_auth(admin_token),
            timeout=30,
        )

    def test_chat_history_and_delete(self, admin_token):
        r1 = requests.post(
            f"{API}/ai/chat/send",
            json={"message": "Give me one polite greeting phrase."},
            headers=_auth(admin_token),
            timeout=60,
        )
        assert r1.status_code == 200
        session_id = r1.json()["session_id"]

        h = requests.get(
            f"{API}/ai/chat/history",
            params={"session_id": session_id},
            headers=_auth(admin_token),
            timeout=30,
        )
        assert h.status_code == 200
        msgs = h.json()
        assert isinstance(msgs, list) and len(msgs) >= 2
        # chronological
        for a, b in zip(msgs, msgs[1:]):
            assert a["created_at"] <= b["created_at"]
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles

        d = requests.delete(
            f"{API}/ai/chat/history",
            params={"session_id": session_id},
            headers=_auth(admin_token),
            timeout=30,
        )
        assert d.status_code == 204

        h2 = requests.get(
            f"{API}/ai/chat/history",
            params={"session_id": session_id},
            headers=_auth(admin_token),
            timeout=30,
        )
        assert h2.status_code == 200
        assert h2.json() == []

    def test_chat_unauth_401(self):
        r = requests.post(f"{API}/ai/chat/send", json={"message": "hi"}, timeout=30)
        assert r.status_code == 401
        r2 = requests.get(f"{API}/ai/chat/history", params={"session_id": "x"}, timeout=30)
        assert r2.status_code == 401
        r3 = requests.delete(f"{API}/ai/chat/history", params={"session_id": "x"}, timeout=30)
        assert r3.status_code == 401
