"""Iteration 10 tests: History (weekly digest removal) + file attachments on task submit."""
import os
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@scindia.royal", "Royal@2026")
TASKER = ("tasker1@scindia.royal", "test1234")
MANAGER = ("manager1@scindia.royal", "test1234")


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="session")
def admin_tok():
    tok, _ = _login(*ADMIN)
    return tok


@pytest.fixture(scope="session")
def tasker():
    tok, user = _login(*TASKER)
    return {"token": tok, "user": user}


@pytest.fixture(scope="session")
def manager():
    tok, user = _login(*MANAGER)
    return {"token": tok, "user": user}


# ============ 1. Weekly digest removed ============
class TestWeeklyDigestRemoved:
    def test_admin_hits_404(self, admin_tok):
        r = requests.get(f"{API}/ai/weekly-digest", headers=_bearer(admin_tok))
        assert r.status_code in (404, 405), f"expected 404/405, got {r.status_code}: {r.text}"

    def test_manager_hits_404(self, manager):
        r = requests.get(f"{API}/ai/weekly-digest", headers=_bearer(manager["token"]))
        assert r.status_code in (404, 405)

    def test_tasker_hits_404(self, tasker):
        r = requests.get(f"{API}/ai/weekly-digest", headers=_bearer(tasker["token"]))
        assert r.status_code in (404, 405)


# ============ 2. Submit with files ============
# tiny valid base64-like payload (not a real PDF, but exercises payload plumbing)
PDF_DATA_URI = (
    "data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwKL0xlbmd0aCAzIDAgUgo+PgpzdHJlYW0K"
)
PHOTO_DATA_URI = "data:image/png;base64,iVBORw0KGgo="


@pytest.fixture(scope="session")
def workflow_task(admin_tok, tasker):
    """Create a task assigned to tasker for submit-with-files test."""
    r = requests.post(f"{API}/tasks", json={
        "title": "TEST_iter10_files",
        "description": "attachment plumbing check",
        "assignee_ids": [tasker["user"]["id"]],
        "priority": "medium",
    }, headers=_bearer(admin_tok))
    assert r.status_code == 201, r.text
    t = r.json()
    yield {"task_id": t["id"], "assignment_id": t["assignments"][0]["id"]}
    requests.delete(f"{API}/tasks/{t['id']}", headers=_bearer(admin_tok))


class TestSubmitWithFiles:
    def test_start_and_submit_with_file(self, workflow_task, tasker, admin_tok):
        tid = workflow_task["task_id"]
        aid = workflow_task["assignment_id"]

        # mark in progress
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/status",
                          json={"status": "in_progress"},
                          headers=_bearer(tasker["token"]))
        assert r.status_code == 200, r.text

        # submit with a PDF file attachment
        file_obj = {
            "id": str(uuid.uuid4()),
            "name": "report.pdf",
            "mime": "application/pdf",
            "size": 1024,
            "data_uri": PDF_DATA_URI,
        }
        submit_payload = {"photos": [], "files": [file_obj], "note": "done with file"}
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/submit",
                          json=submit_payload,
                          headers=_bearer(tasker["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assign = next(a for a in body["assignments"] if a["id"] == aid)
        assert assign["status"] == "submitted"
        assert len(assign["rounds"]) == 1
        last_round = assign["rounds"][-1]

        # The core check: 'files' must be present on the returned round
        assert "files" in last_round, (
            f"'files' MISSING from round in submit response. "
            f"Keys returned: {list(last_round.keys())}. This means _hydrate_task drops files."
        )
        assert isinstance(last_round["files"], list)
        assert len(last_round["files"]) == 1, f"expected 1 file, got: {last_round['files']}"
        f0 = last_round["files"][0]
        for k in ("id", "name", "mime", "size", "data_uri"):
            assert k in f0, f"file missing key {k}"
        assert f0["id"] == file_obj["id"]
        assert f0["name"] == "report.pdf"
        assert f0["mime"] == "application/pdf"
        assert f0["size"] == len(base64.b64decode(PDF_DATA_URI.split(",", 1)[1]))
        assert f0["data_uri"] == PDF_DATA_URI
        assert last_round["note"] == "done with file"

        # GET the task and re-verify persistence (from admin's perspective)
        r = requests.get(f"{API}/tasks/{tid}", headers=_bearer(admin_tok))
        assert r.status_code == 200, r.text
        t = r.json()
        assign = next(a for a in t["assignments"] if a["id"] == aid)
        rnd = assign["rounds"][-1]
        assert "files" in rnd and len(rnd["files"]) == 1, (
            f"'files' MISSING or empty in GET /tasks/{{id}} round. Keys: {list(rnd.keys())}"
        )
        assert rnd["files"][0]["data_uri"] == PDF_DATA_URI

    def test_submit_photos_only_still_works(self, admin_tok, tasker):
        # create another task to avoid state collision
        r = requests.post(f"{API}/tasks", json={
            "title": "TEST_iter10_photosonly",
            "assignee_ids": [tasker["user"]["id"]],
        }, headers=_bearer(admin_tok))
        assert r.status_code == 201
        tid = r.json()["id"]
        aid = r.json()["assignments"][0]["id"]

        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/submit",
                          json={"photos": [PHOTO_DATA_URI], "note": "photo only"},
                          headers=_bearer(tasker["token"]))
        assert r.status_code == 200, r.text
        assign = next(a for a in r.json()["assignments"] if a["id"] == aid)
        assert assign["status"] == "submitted"
        rnd = assign["rounds"][-1]
        # backward compat: files field should default to []
        assert rnd.get("files", []) == []
        assert rnd["photos"] == [PHOTO_DATA_URI]

        requests.delete(f"{API}/tasks/{tid}", headers=_bearer(admin_tok))

    def test_submit_files_only_no_photos(self, admin_tok, tasker):
        r = requests.post(f"{API}/tasks", json={
            "title": "TEST_iter10_filesonly",
            "assignee_ids": [tasker["user"]["id"]],
        }, headers=_bearer(admin_tok))
        assert r.status_code == 201
        tid = r.json()["id"]
        aid = r.json()["assignments"][0]["id"]

        file_obj = {
            "id": str(uuid.uuid4()),
            "name": "note.txt",
            "mime": "text/plain",
            "size": 12,
            "data_uri": "data:text/plain;base64,aGVsbG8gd29ybGQ=",
        }
        r = requests.post(f"{API}/tasks/{tid}/assignments/{aid}/submit",
                          json={"photos": [], "files": [file_obj], "note": ""},
                          headers=_bearer(tasker["token"]))
        assert r.status_code == 200, r.text
        assign = next(a for a in r.json()["assignments"] if a["id"] == aid)
        assert assign["status"] == "submitted"
        rnd = assign["rounds"][-1]
        assert len(rnd.get("files", [])) == 1
        assert rnd["files"][0]["name"] == "note.txt"

        requests.delete(f"{API}/tasks/{tid}", headers=_bearer(admin_tok))


# ============ 3. Regression: reviews/pending + dashboard + tasks list still work ============
class TestRegression:
    def test_reviews_pending_admin(self, admin_tok):
        r = requests.get(f"{API}/reviews/pending", headers=_bearer(admin_tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_reviews_pending_tasker_returns_empty(self, tasker):
        r = requests.get(f"{API}/reviews/pending", headers=_bearer(tasker["token"]))
        assert r.status_code == 200
        assert r.json() == []

    def test_dashboard_admin(self, admin_tok):
        r = requests.get(f"{API}/stats/dashboard", headers=_bearer(admin_tok))
        assert r.status_code == 200
        d = r.json()
        for k in ("total_tasks", "in_review", "completed_tasks", "top_taskers"):
            assert k in d

    def test_tasks_list_admin(self, admin_tok):
        r = requests.get(f"{API}/tasks", headers=_bearer(admin_tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_projects_list_admin(self, admin_tok):
        r = requests.get(f"{API}/projects", headers=_bearer(admin_tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_auth_me(self, admin_tok):
        r = requests.get(f"{API}/auth/me", headers=_bearer(admin_tok))
        assert r.status_code == 200
        assert r.json()["role"] == "admin"


def teardown_module(module):
    try:
        tok = requests.post(f"{API}/auth/login",
                            json={"email": ADMIN[0], "password": ADMIN[1]}).json()["access_token"]
        tasks = requests.get(f"{API}/tasks", headers=_bearer(tok)).json()
        for t in tasks:
            if t["title"].startswith("TEST_iter10"):
                requests.delete(f"{API}/tasks/{t['id']}", headers=_bearer(tok))
    except Exception:
        pass
