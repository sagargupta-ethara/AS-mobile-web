# Plan — Security Hardening

- **Spec:** `specs/001-security-hardening/spec.md`
- **Status:** Draft (awaiting the 3 open clarifications in spec §11)
- **Created:** 2026-07-16

## 0. Constitution gate
- [x] **Art. I** — traces to FR-001…FR-012.
- [x] **Art. II** — this plan *is* the Article II remediation.
- [ ] **Art. III** — only the optional token-revocation store touches the DB; if adopted it is an idempotent `bootstrap()` step. Resolve in §2.
- [ ] **Art. V** — web + mobile changes are paired below.
- [x] **Art. VII** — new deps limited to `slowapi` (rate limiting) + `pyjwt` (already declared); justified.

## 1. Approach
Fix in severity order, smallest-blast-radius first, each behind its own task and each
verified by the Security lane (never self-approved). Group into: (A) credentials & seeding,
(B) authorization/IDOR, (C) input/DoS bounds, (D) transport/config/deps. Ship (A) first as a
hotfix; (B)–(D) follow. Update both clients in lock-step with any endpoint change.

## 2. Architecture & data model changes
- **No schema change** required for FR-001…FR-007.
- **Optional (FR-008)** token revocation: add a `token_version` int on `users` (default 1) or a
  `revoked_jti` collection. If chosen → append idempotent migration:
  `update_many({"token_version": {"$exists": False}}, {"$set": {"token_version": 1}})` and
  include `ver`/`jti` in the JWT; reject on mismatch. Decide after the lifetime clarification.

## 3. API contract changes (auth tightening — FR-005)
| Method | Path | Auth (before → after) |
|---|---|---|
| GET | `/users` | `get_current_user` → **`require_manager`** |
| GET | `/users/{id}/profile` | `get_current_user` → self-or-`require_manager` check |
| GET | `/tasks` | manager unrestricted → manager scoped to created/assigned |
| GET | `/tasks/{id}` | add project-membership/assignment check for managers |
| PATCH | `/projects/{id}` | raw `Dict` body → typed `ProjectUpdate` model |

## 4. Backend implementation notes (`backend/server.py`)
- **A/credentials:** gate demo seeding behind `SEED_DEMO_USERS` + non-prod `ENV`; random `secrets.token_urlsafe(16)` password, logged once. Keep admin seeding env-gated as today.
- **B/authz:** reuse `require_manager`, `_project_visible_to`, `_project_manager`; add per-resource ownership checks; mirror `dashboard_stats` scoping for `/tasks`.
- **C/bounds:** Pydantic `field_validator` on `Attachment.data_uri`/`mime`, `Field(max_length=…)` on `photos`/`files` lists and all free-text; add a body-size limit at uvicorn/proxy.
- **D/config:** CORS from `CORS_ORIGINS` env (no `*`+credentials); disable `/api/docs` when prod; security-headers middleware; migrate JWT decode/encode to `pyjwt`; bump `python-multipart`, pin `requests`; add failed-login logging.

## 5. UX/UI design
- Remove "Quick access"/demo credential chips from **web** `LoginPage.js` and **mobile** `login.tsx`; replace with a plain email/password form. Show a friendly lockout message on rate-limit (429).
- Attachment viewer (mobile): render validated PDFs/images via `source={{ uri }}` with `javaScriptEnabled={false}`, never string-built HTML.

## 6. Frontend implementation notes
- **Web** (`frontend/src`): delete credential constants; handle new 403s from tightened endpoints gracefully; nothing else visual.
- **Mobile** (`mobile/app`, `mobile/src`): delete obfuscated credential; fix `attachment-viewer.tsx`; handle 403s.

## 7. Dependencies
`slowapi` (rate limiting — justified by FR-003); `pyjwt` (already in requirements — replace `python-jose` usage); bump `python-multipart>=0.0.18`, `requests>=2.32.4`.

## 8. Rollout / deploy considerations
- Ship group **A** as an isolated commit (credential removal + seeding gate) → push → Emergent pull. Rotate exposed secrets in the Emergent env at the same time.
- Auth-tightening (group B) must land backend + both clients in the **same** commit so a pull never leaves a client calling a now-forbidden endpoint.
- Any token-revocation migration is idempotent and forward-only (Art. III).

## 9. Test strategy
Per-FR tests in `backend/tests/` (authz matrix per role, attachment-bounds rejection,
rate-limit lockout, CORS origin check, seeding behavior with/without the flag). Prove any
migration idempotent via double-boot (protocol §6). Grep built bundles for known passwords (AC-1).

## 10. Risks & mitigations
- **Tightening authz breaks a client call** → update both clients in lock-step; QA the role matrix.
- **Rate-limit false positives** in shared-IP/preview → tune window; per-account + per-IP combo.
- **Secret rotation** must happen in Emergent env, not code → operational checklist in tasks.
