# Spec-Driven Development (SDD) — how we build here

> **Start here.** This repo builds features spec-first, through an eight-agent pipeline,
> with security as a gate and a database that updates itself on deploy. This file is the
> operating manual. It complements — never overrides — the
> [Constitution](.specify/memory/constitution.md).

## The two-minute version

1. **Nothing ships without a spec.** WHAT/WHY first (spec), then HOW (plan), then a task
   list, then code, then verification. See the flow below.
2. **Eight agents, two lanes.** Requirements → UX/UI → Arch/DB → Backend/Frontend build it;
   **Security + QA verify it** — and the builder never signs off on its own work.
3. **Security is a gate.** A Critical/High finding blocks the ship. Article II is law.
4. **The DB updates itself on `git pull`.** All schema/seed changes are idempotent steps in
   the backend startup handler; pushing to `main` and letting Emergent pull IS the migration.

## The flow

```
/specify → /clarify → /plan → /tasks → /implement → /verify → ship
   │          │          │        │          │           │        │
 spec.md   resolve    plan.md  tasks.md    code +     Security  commit +
 (WHAT)    ambiguity   (HOW)  (owner-tag) tests +     + QA       push →
                                          migration   sign-off   Emergent pulls
```

| Command | You produce | Gate before moving on |
|---------|-------------|------------------------|
| `/specify` | `specs/NNN-slug/spec.md` from [template](.specify/templates/spec-template.md) | FRs testable, no HOW |
| `/clarify` | resolved `[NEEDS CLARIFICATION]` | zero open ambiguities |
| `/plan` | `plan.md` (+ `data-model.md`) from [template](.specify/templates/plan-template.md) | Constitution gate passes |
| `/tasks` | `tasks.md` from [template](.specify/templates/tasks-template.md) | each task → an FR, owner-tagged |
| `/implement` | code + tests + idempotent migration | no TODO/stub/skip |
| `/verify` | Security findings + QA evidence | no open Critical/High; ACs pass |

## Who does what (the eight agents)

Full charters in [`.specify/agents/`](.specify/agents/README.md). Summary:

| # | Agent | Stage it leads | Realize with (this env) |
|---|-------|----------------|--------------------------|
| 0 | Orchestrator | sequences & gates all | main session / `orchestrator` |
| 1 | Requirements & Business Rules | `/specify`, `/clarify` | `analyst` / `planner` |
| 2 | UX/UI Design | `/plan` (design part) | `designer` |
| 3 | Architecture & Database | `/plan` (lead) | `architect` → `executor` |
| 4 | Frontend | `/implement` (web+mobile) | `executor` / `frontend-ui-ux-engineer` |
| 5 | Backend & Integration | `/implement` (API+DB) | `executor` (opus if complex) |
| 6 | Security Review | `/verify` (veto) | `security-reviewer` |
| 7 | Testing & QA | `/verify` | `test-engineer` / `verifier` |

**Golden rule:** authoring and approval are separate lanes. Spawn Security/QA fresh; the
agent that wrote the code does not verify it (Constitution Art. VI).

## Running a feature (worked example)

Say the request is *"managers should be able to archive a completed project."*

1. **`/specify`** — Agent 1 writes `specs/002-archive-projects/spec.md`: user stories, FRs
   (`FR-001` a manager MAY archive a `closed` project; `FR-002` archived projects are hidden
   from the default list…), acceptance criteria, parity note (web + mobile).
2. **`/clarify`** — resolve any `[NEEDS CLARIFICATION]` (e.g. "can it be un-archived?").
3. **`/plan`** — Agent 3 designs it: add `archived: bool` to `projects`; **idempotent
   migration** `update_many({"archived": {"$exists": False}}, {"$set": {"archived": False}})`
   appended to `bootstrap()`; new `PATCH /projects/{id}/archive` with `require_manager` +
   project-membership check; UX for both clients. Constitution gate ticked.
4. **`/tasks`** — Agent 0 decomposes into owner-tagged tasks (ARCH/BE/FE/UX/SEC/QA).
5. **`/implement`** — Agent 5 (backend + migration + tests), Agent 4 (web + mobile).
6. **`/verify`** — Agent 6 reviews authz/IDOR/input; Agent 7 runs ACs on both clients and
   double-boots the backend to prove the migration is idempotent.
7. **Ship** — Agent 0 confirms gates green → commit → push to `origin/main` → Emergent pulls,
   rebuilds, restarts, and the `archived` field backfills automatically on boot.

## The deploy loop (and why the DB "just updates")

```
edit locally → git commit → git push origin main
     → Emergent pulls → rebuilds image → restarts backend
          → bootstrap() runs (indexes → migrations → seeds) → DB current
```

There is no manual migration step. If your DB change is **not** an idempotent step inside
`bootstrap()`, it will **not** apply on Emergent. Read
[`.specify/protocols/emergent-db-migration.md`](.specify/protocols/emergent-db-migration.md)
before touching any collection. Clients (web/mobile) rebuild from the same commit — but a
breaking API change updates **both** clients in the same spec (Art. V).

## Where things live

| You want… | Go to |
|-----------|-------|
| The rules of the road | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) |
| What the system is | [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) |
| Agent charters | [`.specify/agents/`](.specify/agents/README.md) |
| Spec/plan/tasks templates | [`.specify/templates/`](.specify/templates/) |
| DB migration protocol | [`.specify/protocols/emergent-db-migration.md`](.specify/protocols/emergent-db-migration.md) |
| Current backlog / specs | [`specs/`](specs/README.md) |
| The security baseline | [`specs/001-security-hardening/`](specs/001-security-hardening/spec.md) |

## Current state (2026-07-16)

- ✅ SDD system installed (this scaffolding).
- 🔴 **First backlog item is live:** `specs/001-security-hardening` — a baseline review found
  1 Critical + 3 High + 6 Medium + 5 Low. **Start there** before new features: the Critical
  (shipped admin credentials) should be remediated and secrets rotated first.

## Starting a new spec

1. Copy the templates into a new numbered folder:
   `specs/NNN-short-slug/{spec.md,plan.md,tasks.md}` (next free `NNN`).
2. Fill `spec.md` (Agent 1). Drive `/clarify` to zero.
3. Proceed through the flow. Keep [`specs/README.md`](specs/README.md) updated.
