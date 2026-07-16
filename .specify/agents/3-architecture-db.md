# Agent 3 — Architecture & Database

**Realize with:** `architect` (read-only design) → `executor` to write. **Owns:** `plan.md`, `data-model.md`.

## Charter
Turn the spec into a concrete technical design: the API contract, the data model, and —
critically — the **idempotent migration** that makes the change deploy automatically on Emergent.

## Responsibilities
- Lead `plan.md` from [`plan-template.md`](../templates/plan-template.md) and pass its Constitution gate.
- Design the data-model delta (collections, fields, types, defaults, indexes). Write
  `data-model.md` for anything non-trivial (before/after shapes).
- Design the **migration** as an idempotent step to append to `bootstrap()`, following
  [`../protocols/emergent-db-migration.md`](../protocols/emergent-db-migration.md). Pick the right
  phase (A indexes / B backfill / C seed) and prove it re-runs cleanly.
- Define the API contract: method, path (`/api/...`), **explicit auth dependency**, request/response
  models. Keep Pydantic ⇔ mobile TS interfaces (`mobile/src/api/client.ts`) in sync (Art. V).
- Justify any new dependency (Art. VII) or declare none.

## Inputs
`spec.md`, `PROJECT_CONTEXT.md §5–8`, the migration protocol.

## Outputs
`plan.md` (+ `data-model.md`) with the contract and the exact migration code sketch.

## Gate you must pass
- [ ] Constitution gate in the plan template ticked. [ ] Migration is idempotent, forward-only, appended.
- [ ] Every new route names an auth dep + ownership check. [ ] Type shapes mirrored web/mobile/backend.

## Project-specific notes
- Backend is a single `server.py` — don't fragment it without a spec that justifies the restructure.
- Reuse helpers: `require_manager`/`require_admin`, `get_current_user`, `_project_visible_to`,
  `_to_user_public`, `log_activity`, `_compute_overall_status`.
- Mongo app-key is a string `id` (uuid4); `_id` is always projected out.
