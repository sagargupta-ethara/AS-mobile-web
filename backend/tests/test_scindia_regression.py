"""
Regression tests for Scindia Household web bugs:
- Bug A: Tasker task submit (web) must succeed via POST /api/tasks/{id}/assignments/{aid}/submit
- Bug B: modals centering is UI-only (verified in playwright separately)
- Also verify: /api/auth/refresh (happy + 401), dashboard KPI consistency, manager review perms.
"""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://cross-platform-tasks-6.preview.emergentagent.com"
API = f"{BASE}/api"

CREDS = {
    "admin": ("admin@scindia.royal", "Royal@2026"),
    "manager": ("manager@scindia.royal", "test1234"),
    "tasker": ("tasker@scindia.royal", "test1234"),
}


def _login(role):
    email, pw = CREDS[role]
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login {role} -> {r.status_code}: {r.text}"
    j = r.json()
    assert "access_token" in j and j["user"]["role"] == role
    return j["access_token"], j["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {r: _login(r) for r in CREDS}


# ---------- auth/refresh ----------
class TestAuthRefresh:
    def test_refresh_happy(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.post(f"{API}/auth/refresh", headers=_h(tok), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("access_token") and isinstance(j["access_token"], str)
        assert j["user"]["role"] == "admin"

    def test_refresh_bad_token(self):
        r = requests.post(f"{API}/auth/refresh", headers={"Authorization": "Bearer not-a-real-jwt"}, timeout=15)
        assert r.status_code == 401

    def test_refresh_no_token(self):
        r = requests.post(f"{API}/auth/refresh", timeout=15)
        assert r.status_code in (401, 403)


# ---------- dashboard KPI consistency ----------
class TestDashboardKPI:
    @pytest.mark.parametrize("role", ["admin", "manager", "tasker"])
    def test_active_projects_matches_projects_count(self, tokens, role):
        tok, _ = tokens[role]
        stats = requests.get(f"{API}/stats/dashboard", headers=_h(tok), timeout=15)
        assert stats.status_code == 200, stats.text
        projects = requests.get(f"{API}/projects", headers=_h(tok), timeout=15)
        assert projects.status_code == 200
        # active_projects should reflect visible/active projects for role
        # We assert the same rule: count of projects with status == 'active' visible to role
        visible = projects.json()
        active_visible = [p for p in visible if (p.get("status") or "active") == "active"]
        assert stats.json().get("active_projects") == len(active_visible), (
            f"role={role} stats.active_projects={stats.json().get('active_projects')} vs projects active={len(active_visible)}"
        )


# ---------- submit flow (Bug A) ----------
class TestSubmitFlow:
    def _find_or_create_task_for_tasker(self, admin_tok, tasker_user):
        # Find a pending assignment for tasker
        r = requests.get(f"{API}/tasks", headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200
        for t in r.json():
            for a in t.get("assignments", []):
                if a.get("assignee_id") == tasker_user["id"] and a.get("status") in ("pending", "in_progress", "rejected"):
                    return t, a
        # else create one
        # pick a project
        pj = requests.get(f"{API}/projects", headers=_h(admin_tok), timeout=15).json()
        project_id = pj[0]["id"] if pj else None
        payload = {
            "title": "TEST regression submit task",
            "description": "auto-created by regression test",
            "priority": "medium",
            "assignee_ids": [tasker_user["id"]],
            "project_id": project_id,
        }
        r = requests.post(f"{API}/tasks", headers=_h(admin_tok), json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        t = r.json()
        a = t["assignments"][0]
        return t, a

    def test_tasker_submits_note_only(self, tokens):
        admin_tok, _ = tokens["admin"]
        tasker_tok, tasker_user = tokens["tasker"]
        task, assignment = self._find_or_create_task_for_tasker(admin_tok, tasker_user)
        # Submit with note only
        r = requests.post(
            f"{API}/tasks/{task['id']}/assignments/{assignment['id']}/submit",
            headers=_h(tasker_tok),
            json={"photos": [], "files": [], "note": "TEST regression note-only submission"},
            timeout=20,
        )
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        updated = r.json()
        a = next((x for x in updated["assignments"] if x["id"] == assignment["id"]), None)
        assert a is not None
        assert a["status"] == "submitted", f"assignment status={a['status']}"

    def test_submit_requires_auth(self, tokens):
        admin_tok, _ = tokens["admin"]
        # random ids -> should 401 without auth (not 404)
        r = requests.post(f"{API}/tasks/nope/assignments/nope/submit", json={"photos": [], "files": [], "note": "x"}, timeout=15)
        assert r.status_code in (401, 403)


# ---------- manager review permission (project manager path) ----------
class TestManagerReviewPerm:
    def test_manager_pending_reviews_includes_projects_they_manage(self, tokens):
        # Ensure manager is a project manager somewhere & has a submitted assignment
        admin_tok, _ = tokens["admin"]
        mgr_tok, mgr_user = tokens["manager"]
        tasker_tok, tasker_user = tokens["tasker"]

        # Find or create a project managed by manager
        pj_list = requests.get(f"{API}/projects", headers=_h(admin_tok), timeout=15).json()
        managed = next((p for p in pj_list if mgr_user["id"] in (p.get("manager_ids") or [])), None)
        if not managed:
            # create one
            body = {"name": "TEST managed proj", "description": "regression", "manager_ids": [mgr_user["id"]]}
            r = requests.post(f"{API}/projects", headers=_h(admin_tok), json=body, timeout=15)
            assert r.status_code in (200, 201), r.text
            managed = r.json()

        # Create a task in that project assigned to tasker, created by admin (NOT manager)
        r = requests.post(
            f"{API}/tasks",
            headers=_h(admin_tok),
            json={
                "title": "TEST manager-review-perm task",
                "priority": "medium",
                "assignee_ids": [tasker_user["id"]],
                "project_id": managed["id"],
            },
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        task = r.json()
        aid = task["assignments"][0]["id"]

        # Tasker submits
        r = requests.post(
            f"{API}/tasks/{task['id']}/assignments/{aid}/submit",
            headers=_h(tasker_tok),
            json={"photos": [], "files": [], "note": "for manager review"},
            timeout=15,
        )
        assert r.status_code == 200, r.text

        # Manager: /reviews/pending should include this task
        r = requests.get(f"{API}/reviews/pending", headers=_h(mgr_tok), timeout=15)
        assert r.status_code == 200, r.text
        pending = r.json()
        task_ids = [p.get("task_id") or p.get("id") or (p.get("task") or {}).get("id") for p in pending]
        assert task["id"] in task_ids, f"manager pending reviews missing task; ids={task_ids}"

        # Manager can review
        r = requests.post(
            f"{API}/tasks/{task['id']}/assignments/{aid}/review",
            headers=_h(mgr_tok),
            json={"decision": "approve", "rating": 5, "feedback": "TEST manager approves"},
            timeout=15,
        )
        assert r.status_code == 200, f"manager review -> {r.status_code}: {r.text}"

        # Tasker cannot review someone (403)
        # create another submitted task
        r2 = requests.post(
            f"{API}/tasks",
            headers=_h(admin_tok),
            json={"title": "TEST tasker-cant-review", "priority": "low", "assignee_ids": [tasker_user["id"]], "project_id": managed["id"]},
            timeout=15,
        )
        assert r2.status_code in (200, 201)
        t2 = r2.json()
        aid2 = t2["assignments"][0]["id"]
        requests.post(
            f"{API}/tasks/{t2['id']}/assignments/{aid2}/submit",
            headers=_h(tasker_tok),
            json={"photos": [], "files": [], "note": "x"},
            timeout=15,
        )
        r3 = requests.post(
            f"{API}/tasks/{t2['id']}/assignments/{aid2}/review",
            headers=_h(tasker_tok),
            json={"decision": "approve", "rating": 5, "feedback": "should fail"},
            timeout=15,
        )
        assert r3.status_code == 403, f"expected 403 for tasker review, got {r3.status_code}"


# ---------- basic health of major listing endpoints (regression sweep) ----------
class TestSmoke:
    @pytest.mark.parametrize("path", [
        "/auth/me", "/users", "/projects", "/tasks", "/reviews/pending",
        "/stats/dashboard", "/categories", "/logs",
    ])
    def test_admin_get(self, tokens, path):
        tok, _ = tokens["admin"]
        r = requests.get(f"{API}{path}", headers=_h(tok), timeout=15)
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:200]}"
