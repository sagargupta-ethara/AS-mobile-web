# Tasks — Security Hardening

- **Spec:** `spec.md` · **Plan:** `plan.md` · **Findings:** `security-baseline.md`
- Owners: `ARCH` `BE` `FE` `UX` `SEC` `QA` `ORCH`. `[P]` = parallel-safe.
- **Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

> ⚠️ Nothing here is implemented yet — this is the seeded remediation backlog. Resolve the
> three open clarifications in `spec.md §11` before starting group D (token lifetime, CORS
> origins, attachment storage).

## Group A — Credentials & seeding (CRITICAL — ship first) — FR-001, FR-002
- [ ] A01 `FE` Remove quick-login credential constants + buttons from `frontend/src/pages/LoginPage.js` (S-1)
- [ ] A02 `FE` Remove obfuscated admin credential from `mobile/app/login.tsx` (S-1)
- [ ] A03 `BE` Gate demo-user seeding behind `SEED_DEMO_USERS` + non-prod `ENV`; random logged one-time password (`backend/server.py:528-546`) (S-1)
- [ ] A04 `BE [P]` Scrub credentials from `backend/tests/*` fixtures; read from env (S-1)
- [ ] A05 `ORCH` Operational: rotate `Royal@2026`, all `test1234` accounts, `ADMIN_PASSWORD` in the Emergent env (S-1, S-14)
- [ ] A06 `SEC` Verify no credential remains in repo or built bundles (AC-1); sign-off
- [ ] A07 `ORCH` Commit + push group A as an isolated hotfix → Emergent pull

## Group B — Authorization / IDOR — FR-005
- [ ] B01 `BE` `GET /users` → `require_manager` (`server.py:576-583`) (S-4)
- [ ] B02 `BE` `GET /users/{id}/profile` → self-or-manager/admin check (`631-675`) (S-4)
- [ ] B03 `BE` `GET /tasks` + `GET /tasks/{id}` → scope managers to created/assigned (`822-905`) (S-4)
- [ ] B04 `BE` Replace raw `Dict` body in `PATCH /projects/{id}` with a typed model (`733-749`) (S-15)
- [ ] B05 `BE [P]` Fix `create_user` enumeration message where feasible (`591`) (S-13)
- [ ] B06 `FE` Web + mobile: handle new 403s gracefully on affected screens (Art. V)
- [ ] B07 `QA` Role-matrix tests (tasker/manager/admin × each tightened endpoint) — AC-5
- [ ] B08 `SEC` Re-review authz/IDOR closed; sign-off

## Group C — Input bounds / DoS / XSS — FR-004, FR-007, FR-009
- [ ] C01 `BE` `Attachment` validators: `data_uri` max size, `mime` allow-list; don't trust `size` (`146-151`) (S-3)
- [ ] C02 `BE` `SubmitBody`: `max_length` on `photos`/`files`; cap all free-text fields (`196-199`, `1295-1303`) (S-3, S-9)
- [ ] C03 `BE` Global request body-size limit at uvicorn/proxy (S-9)
- [ ] C04 `FE` Mobile `attachment-viewer.tsx`: render via `source={{uri}}`, `javaScriptEnabled={false}`, validate `data:` URI; no string-built HTML (`83-84,137-153`) (S-6, S-7)
- [ ] C05 `QA` Reject-oversized/wrong-MIME/too-many tests; XSS payload does not execute — AC-4, AC-7
- [ ] C06 `SEC` Sign-off on bounds + XSS fix

## Group D — Transport / config / deps (needs clarifications) — FR-003, FR-006, FR-008, FR-010, FR-011, FR-012
- [ ] D01 `BE` Add `slowapi` rate limiting on `/auth/login` + `/ai/*`; lockout/backoff (S-2) — FR-003
- [ ] D02 `BE` Log failed logins + authz denials distinctly (S-12) — FR-011
- [ ] D03 `BE` CORS from `CORS_ORIGINS` env allow-list; drop `*`+credentials (`1437-1443`) (S-5) — FR-006
- [ ] D04 `BE [P]` Disable `/api/docs`,`/redoc`,`/openapi.json` in prod (`44-46`) (S-10) — FR-010
- [ ] D05 `BE [P]` Security-headers middleware (CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy) (S-11) — FR-010
- [ ] D06 `BE` Migrate JWT to `pyjwt`; bump `python-multipart>=0.0.18`, pin `requests>=2.32.4` (S-8) — FR-009
- [ ] D07 `ARCH` Decide token lifetime + optional revocation store (idempotent migration if adopted) (S-7) — FR-008 (blocked by spec §11)
- [ ] D08 `ORCH` Commit lockfiles; add `pip-audit` + `npm audit --audit-level=high` to CI (S-8) — FR-009
- [ ] D09 `QA` Rate-limit lockout, CORS origin, headers, and dependency-audit tests — AC-3, AC-6
- [ ] D10 `SEC` Full re-review → zero Critical/High; final sign-off

## Ship
- [ ] Z01 `ORCH` All groups green, both clients in parity, migrations (if any) idempotent → push for Emergent deploy

## Traceability
| FR | Tasks |
|----|-------|
| FR-001 | A01,A02,A04,A06 |
| FR-002 | A03,A05 |
| FR-003 | D01 |
| FR-004 | C01,C02,C03 |
| FR-005 | B01,B02,B03,B04,B05 |
| FR-006 | D03 |
| FR-007 | C04 |
| FR-008 | D07 |
| FR-009 | D06,D08 |
| FR-010 | D04,D05 |
| FR-011 | D02 |
| FR-012 | A05,D06 |
