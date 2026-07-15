"""Backend tests for Review Queue + Weekly Digest (iteration 9)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@scindia.royal", "password": "Royal@2026"}
MANAGER = {"email": "manager@scindia.royal", "password": "test1234"}
TASKER = {"email": "tasker@scindia.royal", "password": "test1234"}


def _login(payload):
    r = requests.post(f"{API}/auth/login", json=payload, timeout=15)
    assert r.status_code == 200, f"login failed for {payload['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    # Ensure manager/tasker exist (idempotent seed via admin register)
    admin_tok = _login(ADMIN)
    # Try to ensure manager/tasker seeded; ignore duplicates
    for u in (
        {"email": MANAGER["email"], "password": MANAGER["password"], "name": "Manager Rao", "role": "manager"},
        {"email": TASKER["email"], "password": TASKER["password"], "name": "Tasker Krishna", "role": "tasker"},
    ):
        requests.post(f"{API}/users", json=u, headers=_hdr(admin_tok), timeout=15)
    return {
        "admin": admin_tok,
        "manager": _login(MANAGER),
        "tasker": _login(TASKER),
    }


# --- Review Queue -----------------------------------------------------------

class TestReviewQueue:
    def test_tasker_gets_empty_list(self, tokens):
        r = requests.get(f"{API}/reviews/pending", headers=_hdr(tokens["tasker"]), timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_admin_returns_list(self, tokens):
        r = requests.get(f"{API}/reviews/pending", headers=_hdr(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_manager_task_flow_end_to_end(self, tokens):
        # find tasker id
        me = requests.get(f"{API}/auth/me", headers=_hdr(tokens["tasker"]), timeout=15).json()
        tasker_id = me["id"]

        # manager creates a task, assigns to tasker
        title = f"TEST_review_{uuid.uuid4().hex[:6]}"
        create = requests.post(
            f"{API}/tasks",
            json={
                "title": title,
                "description": "review queue test",
                "priority": "medium",
                "assignee_ids": [tasker_id],
            },
            headers=_hdr(tokens["manager"]),
            timeout=15,
        )
        assert create.status_code in (200, 201), create.text
        task = create.json()
        task_id = task["id"]
        # find assignment for tasker
        assign = next(a for a in task["assignments"] if a["assignee_id"] == tasker_id)
        aid = assign["id"]

        # tasker submits
        sub = requests.post(
            f"{API}/tasks/{task_id}/assignments/{aid}/submit",
            json={"note": "done"},
            headers=_hdr(tokens["tasker"]),
            timeout=15,
        )
        assert sub.status_code in (200, 201), sub.text

        # manager sees it in pending
        pend = requests.get(f"{API}/reviews/pending", headers=_hdr(tokens["manager"]), timeout=15)
        assert pend.status_code == 200
        items = pend.json()
        match = [i for i in items if i["task_id"] == task_id and i["assignment_id"] == aid]
        assert match, f"manager should see submitted task, got {items}"
        row = match[0]
        for k in ("task_id", "task_title", "project_name", "assignment_id",
                  "assignee_name", "assignee_role", "round_index", "submitted_at", "priority"):
            assert k in row, f"missing key {k} in {row}"
        assert row["task_title"] == title
        assert row["assignee_role"] == "tasker"
        assert row["round_index"] >= 1

        # tasker sees empty
        t_pend = requests.get(f"{API}/reviews/pending", headers=_hdr(tokens["tasker"]), timeout=15)
        assert t_pend.status_code == 200
        assert t_pend.json() == []


# --- Weekly Digest ----------------------------------------------------------

class TestWeeklyDigest:
    def test_tasker_forbidden(self, tokens):
        r = requests.get(f"{API}/ai/weekly-digest", headers=_hdr(tokens["tasker"]), timeout=15)
        assert r.status_code == 403, f"tasker should be 403, got {r.status_code} {r.text}"

    def test_admin_ok(self, tokens):
        t0 = time.time()
        r = requests.get(f"{API}/ai/weekly-digest", headers=_hdr(tokens["admin"]), timeout=60)
        dur = time.time() - t0
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("summary"), str) and len(body["summary"]) > 0
        assert "period_start" in body and "period_end" in body
        stats = body.get("stats") or {}
        expected = {"tasks_created", "awaiting_review", "approved_this_week",
                    "rejections_this_week", "overdue", "top_performers", "at_risk_titles"}
        assert expected.issubset(stats.keys()), f"stats missing: {expected - set(stats.keys())}"
        assert isinstance(stats["top_performers"], list)
        assert isinstance(stats["at_risk_titles"], list)
        print(f"[digest] admin summary len={len(body['summary'])} dur={dur:.1f}s")

    def test_manager_ok(self, tokens):
        r = requests.get(f"{API}/ai/weekly-digest", headers=_hdr(tokens["manager"]), timeout=60)
        assert r.status_code == 200
        assert isinstance(r.json().get("summary"), str)
