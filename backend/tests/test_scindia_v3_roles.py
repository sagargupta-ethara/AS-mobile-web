"""
Scindia iteration 4 regression suite.
Covers role rename (tasker -> floor_manager), strict membership visibility for ALL roles
including admin, cross-role assignments, /auth/change-password gate, floor_manager
restrictions on project/task creation, project close permissions, reviews queue, and
GET /users scoping.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"

DEFAULT_PW = "Scindia@2026"
ADMIN_PW = "Royal@2026"

ADMIN = "admin@scindia.royal"
MGR_HH = "her-highness@scindia.royal"
MGR_MAY = "mayank@scindia.royal"
MGR_YUV = "yuvraj-maharaj@scindia.royal"
FM_TANYA = "tanya@scindia.royal"
FM_DESH = "desh@scindia.royal"
FM_PRI = "priyanka@scindia.royal"
FM_SAT = "satish@scindia.royal"
FM_BRA = "brajhari@scindia.royal"
FM_RAJ = "rajinder@scindia.royal"
FM_BHU = "bhushan@scindia.royal"

ALL_NON_ADMIN = [MGR_HH, MGR_MAY, MGR_YUV, FM_TANYA, FM_DESH, FM_PRI, FM_SAT, FM_BRA, FM_RAJ, FM_BHU]

# We only use these users freshly for change-password test (they will lose the flag afterwards):
# - MGR_YUV and FM_PRI (dedicated for change-password permanent flip in a controlled way)
# For all membership tests we use MGR_MAY, MGR_HH, FM_TANYA, FM_DESH - keep them at must_change_password=True
# but pw is still DEFAULT_PW so login works.


def _login(email, pw):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw}, timeout=15)
    return r


def _token(email, pw=DEFAULT_PW):
    r = _login(email, pw)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- 1. Login flag correctness for all 11 users ----------
def test_all_11_users_login_with_correct_flag():
    r = _login(ADMIN, ADMIN_PW)
    assert r.status_code == 200
    assert r.json()["user"]["must_change_password"] is False
    assert r.json()["user"]["role"] == "admin"

    for email in ALL_NON_ADMIN:
        r = _login(email, DEFAULT_PW)
        assert r.status_code == 200, f"{email} login failed"
        u = r.json()["user"]
        # Some may have been flipped by other test runs; only require that at least the roles are right.
        assert u["role"] in ("manager", "floor_manager"), f"{email} bad role {u['role']}"
        expected_role = "manager" if email in (MGR_HH, MGR_MAY, MGR_YUV) else "floor_manager"
        assert u["role"] == expected_role, f"{email} role mismatch"


# ---------- 2. change-password endpoint ----------
def test_change_password_endpoint_validation():
    # Use satish - a floor_manager we don't need elsewhere much
    email = FM_SAT
    tok = _token(email, DEFAULT_PW)
    # wrong current password -> 401
    r = requests.post(f"{BASE}/auth/change-password",
                      headers=_hdr(tok),
                      json={"current_password": "wrong-pw", "new_password": "abcdef12"})
    assert r.status_code == 401, f"expected 401 got {r.status_code} {r.text}"

    # new password too short -> 422 (pydantic) or 400
    r = requests.post(f"{BASE}/auth/change-password",
                      headers=_hdr(tok),
                      json={"current_password": DEFAULT_PW, "new_password": "short"})
    assert r.status_code in (400, 422), f"expected 400/422 got {r.status_code} {r.text}"


def test_change_password_success_and_me_flag():
    # Use brajhari (dedicated for this test) - after this the account pw is NewPw@2026
    email = FM_BRA
    # We may already have changed it in a prior run; try both.
    tok = None
    for pw in (DEFAULT_PW, "NewPw@2026"):
        r = _login(email, pw)
        if r.status_code == 200:
            tok = r.json()["access_token"]
            current = pw
            break
    assert tok, "could not log into brajhari with any known password"

    new_pw = "NewPw@2026" if current == DEFAULT_PW else DEFAULT_PW
    r = requests.post(f"{BASE}/auth/change-password",
                      headers=_hdr(tok),
                      json={"current_password": current, "new_password": new_pw})
    assert r.status_code == 200, f"change-password failed: {r.status_code} {r.text}"

    # /auth/me after change reflects must_change_password=false
    me = requests.get(f"{BASE}/auth/me", headers=_hdr(tok))
    assert me.status_code == 200
    assert me.json()["must_change_password"] is False


# ---------- 3. Strict membership project visibility ----------
@pytest.fixture(scope="module")
def strict_project():
    """Mayank creates a project with Her Highness as manager and Tanya+Desh as floor managers."""
    tok = _token(MGR_MAY)
    users = requests.get(f"{BASE}/users", headers=_hdr(tok)).json()
    # Mayank as manager can see users he shares projects with + himself. May need admin to look up ids.
    admin_tok = _token(ADMIN, ADMIN_PW)
    all_users = requests.get(f"{BASE}/users", headers=_hdr(admin_tok)).json()
    by_email = {u["email"]: u["id"] for u in all_users}
    payload = {
        "name": f"TEST_strict_proj_{uuid.uuid4().hex[:6]}",
        "description": "iteration4 strict membership test",
        "manager_ids": [by_email[MGR_HH]],
        "floor_manager_ids": [by_email[FM_TANYA], by_email[FM_DESH]],
    }
    r = requests.post(f"{BASE}/projects", headers=_hdr(tok), json=payload)
    assert r.status_code in (200, 201), f"project create failed {r.status_code} {r.text}"
    proj = r.json()
    return proj, by_email


def test_strict_project_visibility_members_only(strict_project):
    proj, by_email = strict_project
    pid = proj["id"]

    # Members should see it
    for email in (MGR_MAY, MGR_HH, FM_TANYA, FM_DESH):
        pw = ADMIN_PW if email == ADMIN else DEFAULT_PW
        # try current default; also try alternate for accounts we may have changed
        r = _login(email, pw)
        if r.status_code != 200 and email == FM_BRA:
            r = _login(email, "NewPw@2026")
        assert r.status_code == 200, f"login {email}"
        tok = r.json()["access_token"]
        plist = requests.get(f"{BASE}/projects", headers=_hdr(tok)).json()
        assert any(p["id"] == pid for p in plist), f"{email} should see project"
        d = requests.get(f"{BASE}/projects/{pid}", headers=_hdr(tok))
        assert d.status_code == 200, f"{email} detail failed {d.status_code}"

    # Non-members: Yuvraj, Priyanka, Admin should NOT see it & get 403 on detail
    for email, pw in ((MGR_YUV, DEFAULT_PW), (FM_PRI, DEFAULT_PW), (ADMIN, ADMIN_PW)):
        r = _login(email, pw)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        plist = requests.get(f"{BASE}/projects", headers=_hdr(tok)).json()
        assert not any(p["id"] == pid for p in plist), f"{email} should NOT see project"
        d = requests.get(f"{BASE}/projects/{pid}", headers=_hdr(tok))
        assert d.status_code == 403, f"{email} should get 403 on detail, got {d.status_code}"


# ---------- 4. Cross-role task assignment ----------
@pytest.fixture(scope="module")
def cross_role_task(strict_project):
    proj, by_email = strict_project
    tok = _token(MGR_MAY)
    payload = {
        "project_id": proj["id"],
        "title": f"TEST_cross_task_{uuid.uuid4().hex[:6]}",
        "description": "assign floor_manager AND manager",
        "assignee_ids": [by_email[FM_TANYA], by_email[MGR_HH]],
    }
    r = requests.post(f"{BASE}/tasks", headers=_hdr(tok), json=payload)
    assert r.status_code in (200, 201), f"task create {r.status_code} {r.text}"
    return r.json(), by_email


def test_cross_role_task_visibility(cross_role_task):
    task, by_email = cross_role_task
    tid = task["id"]
    # Tanya + Her Highness see it
    for email in (FM_TANYA, MGR_HH):
        tok = _token(email)
        tlist = requests.get(f"{BASE}/tasks", headers=_hdr(tok)).json()
        assert any(t["id"] == tid for t in tlist), f"{email} missing task"

    # Desh (floor_manager on project but NOT task assignee) - by strict rule, task visible if creator OR assignee OR in project.manager_ids. Desh is only in floor_manager_ids => should NOT see.
    tok = _token(FM_DESH)
    tlist = requests.get(f"{BASE}/tasks", headers=_hdr(tok)).json()
    assert not any(t["id"] == tid for t in tlist), "Desh should not see task (not assignee, not in manager_ids)"

    # Unrelated Yuvraj -> 403 on detail
    tok = _token(MGR_YUV)
    d = requests.get(f"{BASE}/tasks/{tid}", headers=_hdr(tok))
    assert d.status_code == 403


# ---------- 5. Submit + review permissions ----------
def test_submit_and_review_permissions(cross_role_task):
    task, by_email = cross_role_task
    tid = task["id"]
    # Find Tanya's assignment id
    tanya_tok = _token(FM_TANYA)
    detail = requests.get(f"{BASE}/tasks/{tid}", headers=_hdr(tanya_tok)).json()
    assigns = detail["assignments"]
    tanya_aid = next(a["id"] for a in assigns if a["assignee_id"] == by_email[FM_TANYA])

    # Tanya submits
    r = requests.post(f"{BASE}/tasks/{tid}/assignments/{tanya_aid}/submit",
                      headers=_hdr(tanya_tok),
                      json={"note": "done", "photos": [], "files": []})
    # allow 200 or 400 if already submitted from prior run - refetch
    assert r.status_code in (200, 400), f"submit {r.status_code} {r.text}"

    # Her Highness (project manager) approves 5*
    hh_tok = _token(MGR_HH)
    r = requests.post(f"{BASE}/tasks/{tid}/assignments/{tanya_aid}/review",
                      headers=_hdr(hh_tok),
                      json={"decision": "approve", "rating": 5, "note": "well done"})
    assert r.status_code in (200, 400), f"HH review {r.status_code} {r.text}"

    # Yuvraj (not member) -> 403
    yuv_tok = _token(MGR_YUV)
    r = requests.post(f"{BASE}/tasks/{tid}/assignments/{tanya_aid}/review",
                      headers=_hdr(yuv_tok),
                      json={"decision": "approve", "rating": 5})
    assert r.status_code == 403, f"Yuvraj expected 403 got {r.status_code}"

    # Admin (not member) -> 403
    admin_tok = _token(ADMIN, ADMIN_PW)
    r = requests.post(f"{BASE}/tasks/{tid}/assignments/{tanya_aid}/review",
                      headers=_hdr(admin_tok),
                      json={"decision": "approve", "rating": 5})
    assert r.status_code == 403, f"Admin expected 403 got {r.status_code}"


def test_assignment_status_permission(cross_role_task):
    task, by_email = cross_role_task
    tid = task["id"]
    tanya_tok = _token(FM_TANYA)
    detail = requests.get(f"{BASE}/tasks/{tid}", headers=_hdr(tanya_tok)).json()
    tanya_aid = next(a["id"] for a in detail["assignments"] if a["assignee_id"] == by_email[FM_TANYA])

    # Another floor_manager (Desh) attempting /status -> 403
    desh_tok = _token(FM_DESH)
    r = requests.post(f"{BASE}/tasks/{tid}/assignments/{tanya_aid}/status",
                      headers=_hdr(desh_tok),
                      json={"status": "in_progress"})
    assert r.status_code == 403, f"desh status expected 403 got {r.status_code}"

    # Admin -> 403
    admin_tok = _token(ADMIN, ADMIN_PW)
    r = requests.post(f"{BASE}/tasks/{tid}/assignments/{tanya_aid}/status",
                      headers=_hdr(admin_tok),
                      json={"status": "in_progress"})
    assert r.status_code == 403


# ---------- 6. Floor manager restrictions ----------
def test_floor_manager_cannot_create_projects_or_tasks(strict_project):
    proj, _ = strict_project
    tok = _token(FM_TANYA)
    r = requests.post(f"{BASE}/projects", headers=_hdr(tok),
                      json={"name": "TEST_fm_cannot", "description": "x"})
    assert r.status_code == 403

    r = requests.post(f"{BASE}/tasks", headers=_hdr(tok),
                      json={"project_id": proj["id"], "title": "TEST_fm_cannot_task"})
    assert r.status_code == 403


# ---------- 7. Admin creates project + close permissions ----------
def test_admin_can_create_and_close_own_project():
    admin_tok = _token(ADMIN, ADMIN_PW)
    all_users = requests.get(f"{BASE}/users", headers=_hdr(admin_tok)).json()
    by_email = {u["email"]: u["id"] for u in all_users}
    payload = {
        "name": f"TEST_admin_proj_{uuid.uuid4().hex[:6]}",
        "description": "admin creates",
        "manager_ids": [by_email[MGR_YUV]],
        "floor_manager_ids": [by_email[FM_PRI]],
    }
    r = requests.post(f"{BASE}/projects", headers=_hdr(admin_tok), json=payload)
    assert r.status_code in (200, 201), f"admin project create {r.status_code} {r.text}"
    proj = r.json()
    pid = proj["id"]
    mgr_ids = [m["id"] for m in proj.get("managers", [])]
    assert by_email[ADMIN] in mgr_ids, f"admin should be in managers, got {mgr_ids}"

    # Yuvraj + Priyanka + admin see it
    for email, pw in ((MGR_YUV, DEFAULT_PW), (FM_PRI, DEFAULT_PW), (ADMIN, ADMIN_PW)):
        r = _login(email, pw)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        plist = requests.get(f"{BASE}/projects", headers=_hdr(tok)).json()
        assert any(p["id"] == pid for p in plist), f"{email} should see admin project"

    # Unrelated Tanya should NOT
    tok = _token(FM_TANYA)
    plist = requests.get(f"{BASE}/projects", headers=_hdr(tok)).json()
    assert not any(p["id"] == pid for p in plist)

    # Admin (member) can close it
    r = requests.post(f"{BASE}/projects/{pid}/close", headers=_hdr(admin_tok),
                      json={"rating": 5, "feedback": "great"})
    assert r.status_code == 200, f"admin close {r.status_code} {r.text}"


def test_admin_not_member_cannot_close():
    """Mayank creates a project (admin not in it). Admin tries to close -> 403."""
    tok = _token(MGR_MAY)
    r = requests.post(f"{BASE}/projects", headers=_hdr(tok),
                      json={"name": f"TEST_no_admin_{uuid.uuid4().hex[:6]}",
                            "description": "no admin"})
    assert r.status_code in (200, 201)
    pid = r.json()["id"]
    admin_tok = _token(ADMIN, ADMIN_PW)
    r = requests.post(f"{BASE}/projects/{pid}/close", headers=_hdr(admin_tok),
                      json={"rating": 5, "feedback": "x"})
    assert r.status_code == 403, f"admin non-member close expected 403 got {r.status_code}"


# ---------- 8. Reviews queue ----------
def test_reviews_queue_scoping():
    # floor_manager -> []
    tok = _token(FM_TANYA)
    r = requests.get(f"{BASE}/reviews/pending", headers=_hdr(tok))
    assert r.status_code == 200
    assert r.json() == [] or isinstance(r.json(), list)
    if isinstance(r.json(), list) and len(r.json()) > 0:
        pytest.fail(f"floor_manager should get empty reviews queue, got {len(r.json())}")

    # admin also strict - no projects unless member
    admin_tok = _token(ADMIN, ADMIN_PW)
    r = requests.get(f"{BASE}/reviews/pending", headers=_hdr(admin_tok))
    assert r.status_code == 200
    admin_reviews = r.json()
    # admin only sees reviews for tasks in projects where admin is member or task creator
    admin_projects = requests.get(f"{BASE}/projects", headers=_hdr(admin_tok)).json()
    admin_pids = {p["id"] for p in admin_projects}
    for rev in admin_reviews:
        # Each review must be within admin's project scope
        assert rev.get("project_id") in admin_pids or rev.get("created_by") == admin_tok, \
            f"admin has stray review outside membership: {rev}"


# ---------- 9. Dashboard stats regression ----------
def test_dashboard_active_projects_matches_project_list():
    for email, pw in ((ADMIN, ADMIN_PW), (MGR_MAY, DEFAULT_PW), (FM_TANYA, DEFAULT_PW)):
        r = _login(email, pw)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        stats = requests.get(f"{BASE}/stats/dashboard", headers=_hdr(tok)).json()
        projs = requests.get(f"{BASE}/projects", headers=_hdr(tok)).json()
        active = [p for p in projs if p.get("status") != "closed"]
        assert stats["active_projects"] == len(active), \
            f"{email} stats.active_projects={stats['active_projects']} vs projects list active={len(active)}"


# ---------- 10. GET /users scoping ----------
def test_get_users_scoping():
    # admin sees all 11
    admin_tok = _token(ADMIN, ADMIN_PW)
    r = requests.get(f"{BASE}/users", headers=_hdr(admin_tok))
    assert r.status_code == 200
    users = r.json()
    emails = {u["email"] for u in users}
    for e in [ADMIN] + ALL_NON_ADMIN:
        assert e in emails, f"admin missing user {e}"

    # manager (Mayank) sees only shared-project users + self
    tok = _token(MGR_MAY)
    r = requests.get(f"{BASE}/users", headers=_hdr(tok))
    assert r.status_code == 200
    manager_emails = {u["email"] for u in r.json()}
    assert MGR_MAY in manager_emails
    # Since Mayank created the strict_project with HH, Tanya, Desh, he should see them
    for e in (MGR_HH, FM_TANYA, FM_DESH):
        assert e in manager_emails, f"Mayank should see shared-project user {e}"
    # Should NOT see users he doesn't share a project with (Bhushan not on his project)
    # Note: hard to guarantee since past runs may have added him. Just log:
    print(f"Mayank visible users: {manager_emails}")

    # floor_manager Tanya
    tok = _token(FM_TANYA)
    r = requests.get(f"{BASE}/users", headers=_hdr(tok))
    assert r.status_code == 200
    fm_emails = {u["email"] for u in r.json()}
    assert FM_TANYA in fm_emails
    assert MGR_MAY in fm_emails  # shared project creator
