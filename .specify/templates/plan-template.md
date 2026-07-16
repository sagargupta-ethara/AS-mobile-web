# Plan — [FEATURE NAME]

> **Stage:** `/plan` · **Owners:** Architecture & Database Agent (lead), UX/UI, Backend, Frontend
> **Rule:** this is the **HOW**. Must trace to the spec's `FR-###`. No task may begin
> until this plan passes the Constitution check below.

- **Spec:** `specs/NNN-slug/spec.md`
- **Status:** Draft | Approved
- **Created:** YYYY-MM-DD

## 0. Constitution gate (must pass before `/tasks`)
- [ ] **Art. I** — traces to spec FRs; no HOW leaked into the spec.
- [ ] **Art. II (Security)** — every new/changed route has an explicit auth dep; IDOR/ownership checked; inputs validated; no new secret committed; CORS unaffected or explicitly handled.
- [ ] **Art. III (DB)** — any schema change is an idempotent `bootstrap()` step, appended, forward-only.
- [ ] **Art. V (Parity)** — web + mobile both covered, or omission justified.
- [ ] **Art. VII (Simplicity)** — new dependencies justified (list below) or none.

## 1. Approach
The chosen design in a few paragraphs. Note alternatives considered and why rejected.

## 2. Architecture & data model changes
- **Collections touched:** …
- **New/changed fields:** field → type → default → nullable?
- **Indexes:** any new index (Phase A)?
- **Migration (Phase B/C):** exact idempotent step(s) to append to `bootstrap()`.
  Reference `.specify/protocols/emergent-db-migration.md`. Include a `data-model.md` if non-trivial.

## 3. API contract
For each endpoint: method, path (under `/api`), auth dependency, request model,
response model, error cases. Keep Pydantic models in sync with mobile TS interfaces.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| | | | | |

## 4. Backend implementation notes
Where in `server.py` this lands, helpers reused (`_project_visible_to`, `require_manager`,
`log_activity`, `_to_user_public`, …), AI usage if any.

## 5. UX/UI design
Screens/states (empty, loading, error, success), navigation, and web↔mobile parity.
Reuse existing components (web: `components/ui/*`, `TaskCard`, `Pills`; mobile: `src/ui/*`).

## 6. Frontend implementation notes
- **Web:** pages/components touched under `frontend/src`, apiClient calls.
- **Mobile:** routes/components under `mobile/app` + `mobile/src`, api client calls.

## 7. Dependencies
New libraries (with one-line justification each), or "none."

## 8. Rollout / deploy considerations
Anything special for the Emergent pull-to-deploy? Backward compatibility across a
rolling restart (old client + new backend, or vice-versa)?

## 9. Test strategy (feeds Testing & QA Agent)
Unit / integration / e2e coverage per FR; how idempotency of any migration is proven.

## 10. Risks & mitigations
Security, data, and parity risks with mitigations.
