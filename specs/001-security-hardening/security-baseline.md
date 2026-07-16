# Security Baseline — findings register (2026-07-16)

> Reference artifact for spec `001-security-hardening`. Produced by the Security Review
> Agent (`security-reviewer`) over `backend/server.py`, `frontend/src`, `mobile/src` +
> `mobile/app`, and `.emergent/cron`. **Overall risk at baseline: HIGH.**
>
> Automated scanners (`pip-audit`, `npm audit`) could not run in the review sandbox (not
> installed / no committed lockfile) — dependency findings are version-based and must be
> re-confirmed in CI. Each finding maps to a functional requirement (`FR-###`) in
> [`spec.md`](spec.md).

| ID | Sev | Category | Location | Finding | FR |
|----|-----|----------|----------|---------|----|
| S-1 | **Critical** | Auth / default creds | `frontend/src/pages/LoginPage.js:7-11`, `mobile/app/login.tsx:37`, `backend/server.py:528-546`, tests `test_ai.py:13`,`test_scindia_v2.py:11` | Real admin password `Royal@2026` embedded in web+mobile client (mobile obfuscates via `String.fromCharCode(64)`) and in tests; demo `manager`/`tasker` accounts seeded unconditionally with `test1234` on every boot. One-click "Quick access" logs in as admin. | FR-001, FR-002 |
| S-2 | High | Rate limiting | `backend/server.py:561-567` (`/auth/login`); `/ai/*` `1255,1320` | No throttle/lockout/CAPTCHA anywhere; login brute-force + billed-AI cost abuse. | FR-003 |
| S-3 | High | Insecure design / DoS | `server.py:146-151,196-199,966-1000` | Attachment `data_uri`/`photos`/`files` unbounded — no size/count/MIME limit; client `size` trusted; rounds accumulate toward Mongo's 16 MB doc cap. | FR-004 |
| S-4 | High | Broken access control / IDOR | `server.py:576-583` (`GET /users`), `631-675` (`GET /users/{id}/profile`), `822-837`,`897-905` (`GET /tasks[/{id}]`) | Any authenticated user (incl. tasker) reads all users' email/phone; any user reads any other user's profile/reviews/logs (IDOR); managers read all tasks system-wide (no project/creator scoping). | FR-005 |
| S-5 | Medium | CORS misconfig | `server.py:1437-1443` | `allow_origins=["*"]` with `allow_credentials=True`. Real impact reduced (Bearer-token auth, no cookies) but self-contradictory and fragile if moved to cookie auth. | FR-006 |
| S-6 | Medium | Stored XSS (WebView) | `mobile/src/ui/attachment-viewer.tsx:83-84,137-153` | Untrusted `data_uri` string-interpolated into `<embed src="${uri}">` inside a `WebView` with JS enabled + `originWhitelist=["*"]`. | FR-004, FR-007 |
| S-7 | Medium | Token lifetime / storage | `server.py:37` (720h JWT), `apiClient.js:14-24` (localStorage), `mobile/.../storage/index.web.ts:50-55` | 30-day non-revocable tokens; web + mobile-web store token outside a secure store; no CSP. Native mobile correctly uses `expo-secure-store`. Algorithm is pinned (good); `get_current_user` re-reads DB so deletes/role-changes take effect (good). | FR-008 |
| S-8 | Medium | Vulnerable deps | `backend/requirements.txt` | `python-jose` (CVE-2024-33664 JWT-bomb DoS, CVE-2024-33663 alg-confusion), `python-multipart==0.0.9` (CVE-2024-53981, fixed 0.0.18), transitive `ecdsa` (CVE-2024-23342), `requests` pin `>=2.32.4`. Migrate JWT to already-present `pyjwt`. | FR-009 |
| S-9 | Medium | Resource consumption | `server.py` (no body-size middleware), `1295-1303` (uncapped `description`) | No global request body-size limit; free-text fields (`title`/`description`/`note`/`feedback`/`message`/`text`) uncapped. Prompt-injection on `/ai/*` is low blast-radius (user-scoped, output allow-listed). | FR-004, FR-009 |
| S-10 | Low | Misconfig | `server.py:44-46` | `/api/docs`,`/api/redoc`,`/api/openapi.json` public — endpoint enumeration. Gate/disable in prod. | FR-010 |
| S-11 | Low | Missing headers | app-wide | No CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy. | FR-010 |
| S-12 | Low | Logging | `server.py:561-567` | No failed-login / security-event logging — brute-force (S-2) undetectable. | FR-011 |
| S-13 | Low | User enumeration | `server.py:591` | `create_user` returns "Email already registered". Login itself is generic (safe). | FR-005 |
| S-14 | Low | Secret strength | env-injected `JWT_SECRET`/`ADMIN_PASSWORD`/`WEBHOOK_CRON_SECRET` (not inspectable) | Ensure ≥256-bit random `JWT_SECRET`; rotate `ADMIN_PASSWORD` (exposed via tests). Cron uses `curl --location-trusted` — acceptable only for the fixed internal host. | FR-002, FR-012 |
| S-15 | Low | Mass-assignment smell | `server.py:733-749` | `update_project` binds raw `Dict[str, Any]`; only name/description applied today but invites over-posting. Bind a typed model. | FR-005 |

## Positives observed (keep these)
- JWT algorithm is pinned (`algorithms=[JWT_ALGORITHM]`) → no `alg=none`/confusion bypass.
- `get_current_user` re-reads the DB each request → role changes / deletions take effect immediately.
- Passwords hashed with bcrypt (passlib). Mongo queries use Pydantic-typed scalars → NoSQL operator-injection mitigated.
- LLM output validated against allow-lists for category/priority/recurrence.
- Native mobile uses `expo-secure-store` for the token.

## Immediate operational actions (outside code)
- **Rotate** `Royal@2026`, all `test1234` accounts, and `ADMIN_PASSWORD` now (exposed in repo/tests).
- Commit lockfiles; wire `pip-audit` + `npm audit --audit-level=high` into CI.
