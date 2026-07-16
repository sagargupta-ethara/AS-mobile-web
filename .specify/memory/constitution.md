# Scindia Royal Household — Project Constitution

> The supreme governing document for this repository. Every spec, plan, task, and
> code change MUST comply. When any other document, habit, or convenience conflicts
> with this Constitution, **the Constitution wins**. Amendments follow the Governance
> section at the bottom.

- **Project:** Scindia Royal Household — Staff & Task Management
- **Platform:** [Emergent](https://emergent.sh) (hosted; MongoDB-backed)
- **Repo shape:** one backend (FastAPI + MongoDB) serving two clients — a React web app and an Expo/React Native mobile app.
- **Ratified:** 2026-07-16
- **Version:** 1.0.0

---

## Article I — Spec-Driven Development (SDD) is mandatory

1. **No code without a spec.** Every non-trivial change starts as a spec in `specs/NNN-slug/spec.md`, then a `plan.md`, then `tasks.md`, and only then implementation. Trivial changes (typo, comment, single-line config) are exempt but must still respect every other Article.
2. **The spec describes WHAT and WHY, never HOW.** No tech stack, no schema, no endpoint names in a spec. Those belong in the plan.
3. **Ambiguity is a defect.** Any unresolved question is marked `[NEEDS CLARIFICATION: …]` and MUST be resolved before the plan is approved. Guessing is forbidden.
4. **The flow is linear and gated:** `Constitution → /specify → /clarify → /plan → /tasks → /implement → /verify`. A later stage may not begin until the earlier stage's artifact exists and passes its gate.
5. **Traceability.** Every task references the requirement (`FR-###`) it satisfies. Every requirement is testable. Requirements with no test are not "done."

## Article II — Security is a non-negotiable gate

Security is not a feature to be added later; it is a gate every change passes through. The Security Review Agent has **veto power** — a change with an unresolved Critical or High finding does not ship.

Non-negotiable baseline (violations are release blockers):

1. **AuthZ on every endpoint.** Every API route declares an explicit auth dependency (`get_current_user`, `require_manager`, `require_admin`, or a documented public exception). No route is authenticated-but-unauthorized by accident. Ownership/tenant checks (IDOR) are verified per resource, not assumed from the role.
2. **Secrets only from the environment.** `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `EMERGENT_LLM_KEY`, `ADMIN_PASSWORD`, `WEBHOOK_CRON_SECRET`, etc. come from injected env only. **No secret, key, token, or real password is ever committed.** `.env*` stays git-ignored. Seed/demo credentials must never be usable in production (see Article III seeding rules).
3. **Validate all input at the boundary.** Pydantic models validate every request body; LLM output is parsed defensively and re-validated against allow-lists before use; attachment/data-URI payloads have enforced size and MIME limits.
4. **CORS is explicit.** `allow_origins` is an explicit allow-list of known frontends — never `"*"` when `allow_credentials=True`.
5. **Least privilege by default.** New roles/permissions start denied and are opened deliberately.
6. **Auth secrets never leave the secure store.** Web: token in a single documented storage key; Mobile: `expo-secure-store`. A 401 always clears the token client-side.
7. **No new attack surface without a threat note.** Any new external input (upload, webhook, AI prompt path) ships with a one-paragraph threat consideration in its plan.

## Article III — Emergent deployment & the DB-migration protocol

The deploy loop is: **edit here → commit → push to GitHub → pull on Emergent → Emergent rebuilds & restarts**. There is no separate "run migrations" step on Emergent. Therefore:

1. **The database self-updates on boot.** All schema evolution, backfills, index creation, and seeding happen inside the FastAPI startup handler (`bootstrap()` in `backend/server.py`). Pulling new code and restarting the process IS the migration.
2. **Every migration is idempotent.** It must be safe to run on every boot, forever, on a fresh DB and on a populated one. Use guards: `create_index` (idempotent by nature), `update_many` with a filter that self-excludes already-migrated docs, `count_documents(...) == 0` before seeding, `find_one` existence checks before insert.
3. **Migrations are forward-only and non-destructive by default.** Destroying or dropping data requires an explicit, reviewed spec that calls it out in bold. The existing "drop legacy task docs" precedent is the only sanctioned destructive migration and is documented.
4. **Order matters.** Indexes first, then data migrations/backfills, then seeds. New migrations append to the end of the ordered sequence; never reorder existing ones.
5. **Seeding is env-gated and production-safe.** The admin is seeded only when `ADMIN_EMAIL`/`ADMIN_PASSWORD` are present. Demo/quick-login accounts and their fixed passwords MUST NOT be seeded in a production environment — gate them behind an explicit `SEED_DEMO_USERS` (or environment) flag rather than seeding unconditionally.
6. **Client changes ride along automatically.** Frontend/mobile are static/JS bundles rebuilt from the same commit; no special step. But a breaking API change requires both clients updated in the **same** spec so a pull never leaves a client broken.
7. **The full protocol lives in** [`.specify/protocols/emergent-db-migration.md`](../protocols/emergent-db-migration.md). Read it before touching any collection shape.

## Article IV — The eight-agent workflow

Every feature is produced by a pipeline of specialized agents, coordinated by the Orchestrator. No single agent both authors and approves its own work — authoring and review are always separate lanes (see Article VI).

| # | Agent | Owns | Produces |
|---|-------|------|----------|
| 0 | **Orchestrator** | Sequencing, gates, handoffs | task graph, go/no-go decisions |
| 1 | **Requirements & Business Rules** | `spec.md` | user stories, `FR-###`, acceptance criteria |
| 2 | **UX/UI Design** | interaction & visual spec | flows, states, web+mobile parity notes |
| 3 | **Architecture & Database** | `plan.md`, `data-model.md` | schema, collections, indexes, migration plan |
| 4 | **Frontend** | web + mobile client code | React + Expo screens sharing the API contract |
| 5 | **Backend & Integration** | FastAPI routes, Mongo, AI, migrations | endpoints + idempotent `bootstrap()` migrations |
| 6 | **Security Review** | the security gate (veto) | findings report, sign-off |
| 7 | **Testing & QA** | verification | test plan, results, evidence |

Full role definitions, inputs/outputs, and handoff contracts live in [`.specify/agents/`](../agents/README.md).

## Article V — Backend is the single source of truth; clients stay in parity

1. The **API contract is authoritative.** Web (`frontend/`) and mobile (`mobile/`) are two renderings of the same contract and must expose the same capabilities where the platform allows.
2. A change to a shared endpoint updates **both** clients in the same spec, or explicitly documents why one client is intentionally omitted.
3. Type shapes are mirrored: backend Pydantic models ⇔ mobile TS interfaces (`mobile/src/api/client.ts`) ⇔ web usage. Drift is a defect.
4. Env-var contract per surface: backend reads OS env; web reads `REACT_APP_BACKEND_URL`; mobile reads `EXPO_PUBLIC_BACKEND_URL`.

## Article VI — Quality gates & separation of duties

1. **Author ≠ approver.** The agent (or pass) that writes code never signs off on it. Review and verification are separate lanes.
2. **Verify before "done."** A task is complete only with evidence: the acceptance criteria exercised, tests passing, and (for security-relevant work) a Security Review sign-off.
3. **No fake completion.** `TODO`, `FIXME`, stubbed returns, `test.skip`/`.only`, and unimplemented branches are blockers, not progress. They are either implemented or reported as blockers — never quietly shipped.
4. **Tests live with features.** Backend tests in `backend/tests/`; each new `FR-###` gets at least one test.

## Article VII — Simplicity & consistency

1. **Match the surrounding code.** New code reads like the code already there — same naming, comment density, and idiom. The backend is intentionally a single well-organized `server.py`; do not fragment it without a spec that justifies the restructure.
2. **Justify every new dependency.** Prefer the platform's existing libraries (FastAPI, Motor, Pydantic, passlib/bcrypt, python-jose, emergentintegrations on backend; shadcn/ui + Radix on web; Expo SDK on mobile). A new dependency needs a one-line justification in the plan.
3. **YAGNI.** Build what the spec requires, not what it might someday require.

---

## Governance

- **Supremacy.** This Constitution supersedes all other practices. Where code and Constitution disagree, the code is wrong until amended or the Constitution is amended.
- **Amendments.** Changes require: (a) a short rationale, (b) a version bump per the policy below, (c) an update to the "Ratified/Version" header, and (d) a note in `specs/` if the change invalidates existing plans.
- **Versioning policy (semantic):**
  - **MAJOR** — remove/redefine a principle in a backward-incompatible way.
  - **MINOR** — add a new principle/Article or materially expand guidance.
  - **PATCH** — clarifications, wording, typo fixes.
- **Compliance review.** The Orchestrator checks each plan against this Constitution at the `/plan` gate. The Security Review Agent enforces Article II at the `/verify` gate.
- **Living document.** When reality and this document diverge, fix whichever is wrong — do not silently ignore the Constitution.

**Version:** 1.0.0 | **Ratified:** 2026-07-16 | **Last amended:** 2026-07-16
