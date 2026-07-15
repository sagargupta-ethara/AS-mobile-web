"""V2 backend tests for Scindia Household API: projects, multi-assignee tasks, rounds, stats, logs."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@scindia.royal"
ADMIN_PASSWORD = "Royal@2026"


def _bearer(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _login_or_create(admin_token, email, password, role, name):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json()["access_token"], r.json()["user"]
    # create
    r = requests.post(f"{API}/users", json={
        "name": name, "email": email, "password": password, "role": role
    }, headers=_bearer(admin_token))
    assert r.status_code == 201, r.text
    user = r.json()
    r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r2.status_code == 200
    return r2.json()["access_token"], user


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def manager(admin_token):
    tok, user = _login_or_create(admin_token, "manager1@scindia.royal", "test1234", "manager", "Manager Rao")
    return {"token": tok, "user": user}


@pytest.fixture(scope="session")
def tasker(admin_token):
    tok, user = _login_or_create(admin_token, "tasker1@scindia.royal", "test1234", "tasker", "Tasker Krishna")
    return {"token": tok, "user": user}


@pytest.fixture(scope="session")
def tasker2(admin_token):
    suffix = uuid.uuid4().hex[:6]
    email = f"TEST_tasker2_{suffix}@scindia.royal"
    tok, user = _login_or_create(admin_token, email, "test1234", "tasker", "TEST Tasker Two")
    yield {"token": tok, "user": user}
    requests.delete(f"{API}/users/{user['id']}", headers=_bearer(admin_token))


# ============= AUTH & USERS =============
class TestAuthUsers:
    def test_admin_login_and_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_bearer(admin_token))
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_no_staff_role_exists(self, admin_token):
        r = requests.get(f"{API}/users", headers=_bearer(admin_token))
        assert r.status_code == 200
        users = r.json()
        roles = {u["role"] for u in users}
        assert "staff" not in roles, f"legacy 'staff' role still present: {roles}"
        # Each user must have avg_rating and ratings_count
        for u in users:
            assert "avg_rating" in u and isinstance(u["avg_rating"], (int, float))
            assert "ratings_count" in u and isinstance(u["ratings_count"], int)

    def test_tasker_role_exists(self, tasker):
        assert tasker["user"]["role"] == "tasker"


# ============= PROJECTS =============
class TestProjects:
    def test_admin_creates_project(self, admin_token, manager, tasker):
        r = requests.post(f"{API}/projects", json={
            "name": "TEST Project Alpha",
            "description": "test",
            "manager_ids": [manager["user"]["id"]],
            "tasker_ids": [tasker["user"]["id"]],
        }, headers=_bearer(admin_token))
        assert r.status_code == 201, r.text
        p = r.json()
        assert p["status"] == "active"
        assert len(p["managers"]) == 1
        assert len(p["taskers"]) == 1
        pytest.project_id = p["id"]

    def test_manager_cannot_create_project(self, manager):
        r = requests.post(f"{API}/projects", json={"name": "bad"}, headers=_bearer(manager["token"]))
        assert r.status_code == 403

    def test_tasker_cannot_create_project(self, tasker):
        r = requests.post(f"{API}/projects", json={"name": "bad"}, headers=_bearer(tasker["token"]))
        assert r.status_code == 403

    def test_list_projects_admin_sees_all(self, admin_token):
        r = requests.get(f"{API}/projects", headers=_bearer(admin_token))
        assert r.status_code == 200
        assert any(p["id"] == pytest.project_id for p in r.json())

    def test_list_projects_manager_scoped(self, manager):
        r = requests.get(f"{API}/projects", headers=_bearer(manager["token"]))
        assert r.status_code == 200
        assert any(p["id"] == pytest.project_id for p in r.json())

    def test_tasker_not_on_project_cannot_see(self, tasker2, admin_token):
        # create a project not involving tasker2
        r = requests.post(f"{API}/projects", json={
            "name": "TEST Isolated", "manager_ids": [], "tasker_ids": [],
        }, headers=_bearer(admin_token))
        pid = r.json()["id"]
        lst = requests.get(f"{API}/projects", headers=_bearer(tasker2["token"])).json()
        assert not any(p["id"] == pid for p in lst)

    def test_update_members_admin(self, admin_token, tasker2):
        r = requests.put(f"{API}/projects/{pytest.project_id}/members",
                         json={"tasker_ids": [tasker2["user"]["id"]]},
                         headers=_bearer(admin_token))
        assert r.status_code == 200
        assert any(t["id"] == tasker2["user"]["id"] for t in r.json()["taskers"])

    def test_manager_cannot_change_managers(self, manager, tasker2):
        r = requests.put(f"{API}/projects/{pytest.project_id}/members",
                         json={"manager_ids": [tasker2["user"]["id"]]},
                         headers=_bearer(manager["token"]))
        assert r.status_code == 403

    def test_manager_can_change_taskers(self, manager, tasker, tasker2):
        r = requests.put(f"{API}/projects/{pytest.project_id}/members",
                         json={"tasker_ids": [tasker["user"]["id"], tasker2["user"]["id"]]},
                         headers=_bearer(manager["token"]))
        assert r.status_code == 200
        ids = {t["id"] for t in r.json()["taskers"]}
        assert tasker["user"]["id"] in ids


# ============= TASKS multi-assignee =============
class TestTasks:
    def test_admin_creates_multi_assignee_task(self, admin_token, tasker, tasker2):
        r = requests.post(f"{API}/tasks", json={
            "title": "TEST Multi",
            "description": "d",
            "assignee_ids": [tasker["user"]["id"], tasker2["user"]["id"]],
            "priority": "high",
        }, headers=_bearer(admin_token))
        assert r.status_code == 201, r.text
        t = r.json()
        assert len(t["assignments"]) == 2
        pytest.task_id = t["id"]
        pytest.assignment_ids = {a["assignee_id"]: a["id"] for a in t["assignments"]}

    def test_manager_cannot_assign_to_manager(self, manager, tasker):
        r = requests.post(f"{API}/tasks", json={
            "title": "TEST Bad",
            "assignee_ids": [manager["user"]["id"], tasker["user"]["id"]],
        }, headers=_bearer(manager["token"]))
        assert r.status_code == 403

    def test_admin_can_assign_to_manager(self, admin_token, manager):
        r = requests.post(f"{API}/tasks", json={
            "title": "TEST Admin-Mgr",
            "assignee_ids": [manager["user"]["id"]],
        }, headers=_bearer(admin_token))
        assert r.status_code == 201
        requests.delete(f"{API}/tasks/{r.json()['id']}", headers=_bearer(admin_token))


# ============= ASSIGNMENT WORKFLOW =============
class TestAssignmentWorkflow:
    def test_full_workflow_reject_then_approve(self, admin_token, tasker):
        # create fresh task
        r = requests.post(f"{API}/tasks", json={
            "title": "TEST Workflow",
            "assignee_ids": [tasker["user"]["id"]],
        }, headers=_bearer(admin_token))
        assert r.status_code == 201
        t = r.json()
        tid = t["id"]
        aid = t["assignments"][0]["id"]

        # start
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/status",
                         json={"status": "in_progress"},
                         headers=_bearer(tasker["token"]))
        assert r.status_code == 200, r.text
        # submit
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/submit",
                         json={"photos": ["p1"], "note": "done"},
                         headers=_bearer(tasker["token"]))
        assert r.status_code == 200, r.text
        assign = next(a for a in r.json()["assignments"] if a["id"] == aid)
        assert assign["status"] == "submitted"
        assert len(assign["rounds"]) == 1

        # reject with rating 3
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/review",
                         json={"decision": "reject", "rating": 3, "feedback": "redo"},
                         headers=_bearer(admin_token))
        assert r.status_code == 200, r.text
        assign = next(a for a in r.json()["assignments"] if a["id"] == aid)
        assert assign["status"] == "rejected"
        assert assign["rounds"][0]["rating"] == 3
        assert assign["rounds"][0]["decision"] == "reject"

        # resubmit
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/submit",
                         json={"photos": ["p2"], "note": "again"},
                         headers=_bearer(tasker["token"]))
        assert r.status_code == 200
        assign = next(a for a in r.json()["assignments"] if a["id"] == aid)
        assert len(assign["rounds"]) == 2
        assert assign["status"] == "submitted"

        # approve with rating 5 -> avg (3+5)/2 = 4.0
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/review",
                         json={"decision": "approve", "rating": 5, "feedback": "great"},
                         headers=_bearer(admin_token))
        assert r.status_code == 200, r.text
        assign = next(a for a in r.json()["assignments"] if a["id"] == aid)
        assert assign["status"] == "approved"
        assert assign["final_rating"] == 4.0

        # cleanup
        requests.delete(f"{API}/tasks/{tid}", headers=_bearer(admin_token))

    def test_review_rating_bounds(self, admin_token, tasker):
        r = requests.post(f"{API}/tasks", json={
            "title": "TEST Bound", "assignee_ids": [tasker["user"]["id"]]
        }, headers=_bearer(admin_token))
        tid, aid = r.json()["id"], r.json()["assignments"][0]["id"]
        requests.post(f"{API}/tasks/{tid}/assignments/{aid}/submit",
                     json={"photos": [], "note": "x"}, headers=_bearer(tasker["token"]))
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/review",
                         json={"decision": "approve", "rating": 6},
                         headers=_bearer(admin_token))
        assert r.status_code == 422
        requests.delete(f"{API}/tasks/{tid}", headers=_bearer(admin_token))


# ============= PROJECT CLOSURE =============
class TestProjectClosure:
    def test_manager_propose_and_admin_close(self, admin_token, manager, tasker):
        # create dedicated project
        r = requests.post(f"{API}/projects", json={
            "name": "TEST Close Me",
            "manager_ids": [manager["user"]["id"]],
            "tasker_ids": [tasker["user"]["id"]],
        }, headers=_bearer(admin_token))
        pid = r.json()["id"]
        # manager proposes
        r = requests.post(f"{API}/projects/{pid}/propose-close",
                         json={"note": "done"}, headers=_bearer(manager["token"]))
        assert r.status_code == 200
        assert r.json()["status"] == "closure_proposed"
        # admin closes with rating
        r = requests.post(f"{API}/projects/{pid}/close",
                         json={"rating": 5, "feedback": "excellent"},
                         headers=_bearer(admin_token))
        assert r.status_code == 200
        p = r.json()
        assert p["status"] == "closed"
        assert p["final_rating"] == 5
        assert p["closed_at"] is not None


# ============= STATS =============
class TestStats:
    def test_dashboard(self, admin_token):
        r = requests.get(f"{API}/stats/dashboard", headers=_bearer(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_tasks", "active_tasks", "in_review", "completed_tasks",
                  "overdue", "total_projects", "active_projects",
                  "total_taskers", "total_managers", "top_taskers"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["top_taskers"], list)

    def test_project_stats(self, admin_token):
        r = requests.get(f"{API}/stats/projects/{pytest.project_id}", headers=_bearer(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "tasks_by_status" in d
        assert "tasks_by_priority" in d
        assert "avg_task_rating" in d
        assert "tasker_leaderboard" in d


# ============= USER PROFILE =============
class TestUserProfile:
    def test_user_profile(self, admin_token, tasker):
        r = requests.get(f"{API}/users/{tasker['user']['id']}/profile", headers=_bearer(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["user", "active_assignments", "completed_assignments",
                  "rejection_count", "recent_reviews", "logs"]:
            assert k in d


# ============= LOGS =============
class TestLogs:
    def test_admin_lists_logs(self, admin_token):
        r = requests.get(f"{API}/logs", headers=_bearer(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_entity_filter(self, admin_token):
        r = requests.get(f"{API}/logs?entity_id={pytest.project_id}", headers=_bearer(admin_token))
        assert r.status_code == 200
        for lg in r.json():
            # entity_id should match filter
            assert lg["entity_id"] == pytest.project_id

    def test_tasker_scoped_logs(self, tasker):
        r = requests.get(f"{API}/logs", headers=_bearer(tasker["token"]))
        assert r.status_code == 200
        for lg in r.json():
            assert lg["actor_id"] == tasker["user"]["id"] or lg["entity_id"] == tasker["user"]["id"]


# ============= CLEANUP =============
def teardown_module(module):
    # best-effort delete test projects/tasks left over
    try:
        tok = requests.post(f"{API}/auth/login",
                            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).json()["access_token"]
        # delete leftover TEST_ projects via listing (no DELETE endpoint on project, so leave)
        # delete any TEST tasks
        tasks = requests.get(f"{API}/tasks", headers=_bearer(tok)).json()
        for t in tasks:
            if t["title"].startswith("TEST"):
                requests.delete(f"{API}/tasks/{t['id']}", headers=_bearer(tok))
    except Exception:
        pass
