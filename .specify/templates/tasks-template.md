# Tasks — [FEATURE NAME]

> **Stage:** `/tasks` · **Owner:** Orchestrator (decomposes), each agent (executes)
> **Rule:** each task is small, independently verifiable, names its **owner agent**, and
> traces to an `FR-###`. `[P]` marks tasks that can run in parallel (no shared files).

- **Spec:** `specs/NNN-slug/spec.md` · **Plan:** `specs/NNN-slug/plan.md`

## Legend
`[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked
Owners: `ARCH` (Architecture/DB) · `BE` (Backend) · `FE` (Frontend) · `UX` · `SEC` (Security) · `QA` · `ORCH`

## Phase 1 — Foundation (schema, migrations, contracts)
- [ ] T001 `ARCH` Define/adjust data model + `data-model.md` — FR-00_
- [ ] T002 `BE` Append idempotent migration to `bootstrap()`; prove it re-runs cleanly — FR-00_ (Art. III)
- [ ] T003 `ARCH` Finalize API contract + Pydantic/TS type shapes — FR-00_

## Phase 2 — Backend
- [ ] T010 `BE` Implement endpoint(s) with explicit auth deps + ownership checks — FR-00_ (Art. II)
- [ ] T011 `BE` Input validation + error handling + activity logging — FR-00_
- [ ] T012 `BE [P]` Backend unit/integration tests in `backend/tests/` — FR-00_

## Phase 3 — Clients (web + mobile, parity)
- [ ] T020 `FE [P]` Web: pages/components + apiClient wiring — FR-00_
- [ ] T021 `FE [P]` Mobile: routes/components + api client wiring — FR-00_
- [ ] T022 `UX` States: empty / loading / error / success on both surfaces — FR-00_

## Phase 4 — Security & QA gates (separate lane — never the author)
- [ ] T030 `SEC` Security review: authz/IDOR, input, secrets, CORS; sign-off or veto — Art. II
- [ ] T031 `QA` Execute acceptance criteria (AC-#) on web + mobile; capture evidence
- [ ] T032 `QA` Verify migration idempotency (double-boot); confirm no data loss

## Phase 5 — Ship
- [ ] T040 `ORCH` Confirm all FRs covered, gates green, no placeholders/TODOs
- [ ] T041 `ORCH` Commit + push to `origin/main` for Emergent pull → deploy

## Traceability matrix
| FR | Tasks | Acceptance | Test |
|----|-------|-----------|------|
| FR-001 | T0__ | AC-1 | test_… |
