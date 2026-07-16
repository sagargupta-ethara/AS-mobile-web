# Spec — Security Hardening (baseline remediation)

- **Spec ID:** `001-security-hardening`
- **Status:** Ready-for-Plan
- **Created:** 2026-07-16
- **Constitution check:** enforces Article II (Security) directly; respects Art. III (DB), Art. V (parity).
- **Source:** [`security-baseline.md`](security-baseline.md) (findings register, 15 items).

## 1. Problem / opportunity
A baseline security review of the app found **1 Critical, 3 High, 6 Medium, 5 Low** issues,
including real admin credentials shipped in client code and demo accounts with known
passwords seeded on every deploy. These are exploitable by unauthenticated or low-privilege
users and put all household staff PII and operations at risk. We must bring the app to the
Constitution's Article II baseline before further feature work ships on top of it.

## 2. Goals & non-goals
- **Goals:** eliminate all Critical/High findings; reduce Medium/Low to accepted-risk or fixed;
  establish the security baseline every future spec is measured against.
- **Non-goals:** a full pen-test, SSO/OAuth provider migration, or a rewrite of the auth model.

## 3. Users & roles affected
All roles (`admin`/`manager`/`tasker`) on both web and mobile; and the deploy/operator surface.

## 4. User stories
- **US-1** — As the household, I want no credentials in shipped code so a bystander cannot log in as admin.
- **US-2** — As a tasker, I want my email/phone/performance not readable by every other user.
- **US-3** — As an operator, I want brute-force and cost-abuse of login/AI blocked.
- **US-4** — As a reviewer, I want attachments I open to be safe (bounded, typed, non-executable).

## 5. Functional requirements
- **FR-001** — No credential (password, token, key) MAY appear in any client bundle, repo file, or test fixture. "Quick access" credential buttons MUST be removed.
- **FR-002** — Demo/quick-login accounts MUST NOT be seeded in production; any non-prod seeding MUST be flag-gated and use a randomly generated, logged one-time password. Exposed passwords MUST be rotated.
- **FR-003** — Authentication and AI endpoints MUST be rate-limited (per-IP and/or per-account) with lockout/backoff; repeated failures MUST be logged.
- **FR-004** — Attachment/photo payloads MUST be bounded server-side: max size per item, max item count, and a MIME allow-list; client-supplied `size` MUST NOT be trusted. Free-text fields MUST have a max length.
- **FR-005** — Every read endpoint MUST authorize per-resource: PII listing restricted to managers/admins; a user's profile/reviews/logs readable only by that user or a manager/admin; managers scoped to tasks they created or are assigned to (no system-wide task read). Typed request models replace raw dict bodies.
- **FR-006** — CORS MUST use an explicit origin allow-list (from env); `"*"` with credentials is forbidden.
- **FR-007** — Rendered attachments MUST NOT execute untrusted content (no string-interpolated HTML in WebView; JS disabled for attachment rendering; validated `data:` URIs only).
- **FR-008** — Access-token lifetime SHOULD be shortened with a revocation path; a Content-Security-Policy SHOULD be set; web token storage risk documented/mitigated.
- **FR-009** — Known-vulnerable dependencies MUST be upgraded or replaced (`python-multipart` ≥ 0.0.18; migrate JWT off `python-jose` to `pyjwt`; pin `requests`); lockfiles committed; `pip-audit`/`npm audit` in CI.
- **FR-010** — API docs MUST be disabled or gated in production; standard security headers (CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy) MUST be present.
- **FR-011** — Security events (failed logins, authz denials) MUST be logged distinctly from business activity.
- **FR-012** — `JWT_SECRET` MUST be ≥256-bit random; secret-strength expectations documented for operators.

## 6. Business rules & authorization
Reaffirms `PROJECT_CONTEXT.md §7`; closes the IDOR gaps noted there (S-4). Role scoping:
tasker → self only; manager → own-created/assigned + own projects; admin → all.

## 7. Acceptance criteria (Given/When/Then)
- **AC-1** (FR-001): **Given** a built web/mobile bundle, **When** searched for known passwords, **Then** none are present and no quick-login credential button exists.
- **AC-2** (FR-002): **Given** a production env, **When** the backend boots, **Then** no demo user is created; **Given** `SEED_DEMO_USERS=1` in non-prod, **Then** demo users are created with random logged passwords.
- **AC-3** (FR-003): **Given** >N failed logins from an IP/account in a window, **When** another attempt is made, **Then** it is throttled/locked and the failures are logged.
- **AC-4** (FR-004): **Given** an oversized/wrong-MIME/too-many attachment submission, **When** submitted, **Then** the API rejects it with a validation error.
- **AC-5** (FR-005): **Given** a tasker, **When** they request another user's profile or `GET /users`, **Then** they are forbidden or receive only permitted data; **Given** a manager, **When** they request a task they didn't create/aren't assigned to, **Then** it is not returned.
- **AC-6** (FR-006): **Given** a disallowed Origin, **When** it calls the API, **Then** CORS does not grant it.
- **AC-7** (FR-007): **Given** a malicious `data_uri`, **When** a reviewer opens it, **Then** no script executes.

## 8. Data touched (conceptual only)
`users` (seeding behavior only — no schema change required for the credential fixes),
`tasks.assignments.rounds` (validation only). A possible token-revocation store (`jti`/token
version) would be a **new** DB concern → the Arch/DB Agent decides in the plan; if added it
MUST be an idempotent `bootstrap()` step (Art. III).

## 9. Security & privacy considerations
This entire spec is the security surface. Exposed secrets require rotation (operational, out
of code). Changing authorization on read endpoints must not break the web/mobile clients —
update both in lock-step (Art. V).

## 10. Web ⇄ mobile parity
Both clients change: remove credential buttons (web + mobile), fix WebView rendering (mobile),
adapt to any tightened read endpoints (both).

## 11. Open questions
- [NEEDS CLARIFICATION: target access-token lifetime and whether to add refresh tokens now vs. later?]
- [NEEDS CLARIFICATION: which exact Origins belong in the CORS allow-list for prod/preview?]
- [NEEDS CLARIFICATION: is object storage (e.g. S3) available on Emergent to move attachments out of Mongo, or keep base64-in-Mongo with strict caps for now?]

## 12. Success metrics
Zero Critical/High findings on re-review; all ACs pass on web + mobile; CI dependency audit green.
