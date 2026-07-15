"""Verify demo seeded users (Manager Rao, Tasker Krishna) authenticate."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://team-control-29.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    return api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)


class TestQuickLoginSeed:
    def test_admin_login(self, api):
        r = _login(api, "admin@scindia.royal", "Royal@2026")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data or "access_token" in data
        user = data.get("user", data)
        assert user.get("role") == "admin"

    def test_manager_login(self, api):
        r = _login(api, "manager@scindia.royal", "test1234")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data or "access_token" in data
        user = data.get("user", data)
        assert user.get("role") == "manager"
        assert "Manager Rao" in user.get("name", "")

    def test_tasker_login(self, api):
        r = _login(api, "tasker@scindia.royal", "test1234")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data or "access_token" in data
        user = data.get("user", data)
        assert user.get("role") == "tasker"
        assert "Tasker Krishna" in user.get("name", "")

    def test_invalid_login(self, api):
        r = _login(api, "manager@scindia.royal", "wrongpw")
        assert r.status_code in (400, 401)
