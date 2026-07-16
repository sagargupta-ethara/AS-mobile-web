# The Eight-Agent SDD Workflow

> Every feature in this repo is produced by a pipeline of specialized agents, coordinated
> by the Orchestrator. This directory defines each agent's charter, inputs, outputs, and
> handoff contract. Governed by [Constitution Article IV](../memory/constitution.md).

Each agent has a file here. Read the one for your current stage; read this README to
understand where you sit in the pipeline and what you owe the next agent.

## The pipeline

```
                         ┌─────────────────────────────────────────────┐
                         │  0. ORCHESTRATOR  (sequences everything)      │
                         └───────────────┬─────────────────────────────┘
                                         │ gates each handoff
   /specify        /clarify      /plan                 /tasks        /implement       /verify
      │               │            │                     │               │              │
      ▼               ▼            ▼                     ▼               ▼              ▼
┌───────────┐   (resolve      ┌─────────────┐     ┌───────────┐   ┌───────────┐  ┌───────────┐
│ 1. REQUIRE-│   ambiguity)   │ 3. ARCH & DB │     │  tasks.md │   │ 4. FRONTEND│  │ 6. SECURITY│
│   MENTS    │──spec.md──────▶│  + 2. UX/UI  │────▶│ (owner-   │──▶│ 5. BACKEND │─▶│ 7. QA      │
│ spec.md    │                │  plan.md     │     │  tagged)  │   │ (build)    │  │ (gate)     │
└───────────┘                └─────────────┘     └───────────┘   └───────────┘  └───────────┘
```

**One rule above all (Constitution Art. VI):** the agent that *builds* something never
*approves* it. Security (6) and QA (7) are a separate lane from Frontend/Backend (4/5).

## Stage → agent → artifact

| Stage | Driven by | Reads | Produces | Gate to pass |
|-------|-----------|-------|----------|--------------|
| `/specify` | 1 Requirements | request, `PROJECT_CONTEXT.md` | `spec.md` | no HOW; FRs testable |
| `/clarify` | 1 Requirements + Orchestrator | `spec.md` | resolved `[NEEDS CLARIFICATION]` | zero open ambiguities |
| `/plan` | 3 Arch/DB (lead) + 2 UX/UI | `spec.md` | `plan.md` (+ `data-model.md`) | Constitution gate in plan template |
| `/tasks` | 0 Orchestrator | `plan.md` | `tasks.md` (owner-tagged) | each task traces to an FR |
| `/implement` | 5 Backend + 4 Frontend | `tasks.md` | code + tests + migration | no placeholders/TODOs |
| `/verify` | 6 Security + 7 QA | code + `spec.md` | findings + sign-off | no Critical/High open; ACs pass |

## Handoff contracts (what each agent owes the next)

- **Requirements → Arch/DB:** a spec where every FR is unambiguous and testable, security/privacy noted, parity decided.
- **UX/UI → Frontend:** flows and states (empty/loading/error/success) for **both** web and mobile, reusing existing components.
- **Arch/DB → Backend:** exact API contract, data-model deltas, and the **idempotent** migration step to append to `bootstrap()`.
- **Backend/Frontend → Security/QA:** working code, tests, and a note of every new input/route/surface.
- **Security → Ship:** an explicit sign-off, or a veto with the blocking finding IDs.
- **QA → Ship:** every acceptance criterion exercised on web + mobile, migration idempotency proven, evidence captured.

## Mapping to the runtime (OMC / Claude Code agents)

These eight roles are *charters*, not separate processes. Realize them with the available
subagents so authoring and review stay in different lanes:

| SDD agent | Realize with | Model hint |
|-----------|-------------|-----------|
| 0 Orchestrator | main session / `orchestrator` / `planner` | opus |
| 1 Requirements | `analyst` / `planner` | opus |
| 2 UX/UI | `designer` / `frontend-ui-ux-engineer` | sonnet |
| 3 Arch & DB | `architect` (read-only design) → `executor` to write | opus → sonnet |
| 4 Frontend | `executor` / `frontend-ui-ux-engineer` | sonnet |
| 5 Backend | `executor` (model=opus for complex) | sonnet/opus |
| 6 Security | `security-reviewer` / `code-reviewer` | opus |
| 7 QA | `test-engineer` / `qa-tester` / `verifier` | sonnet |

**Never** let the same agent instance both implement and sign off. Spawn Security/QA fresh.

## Invoking the workflow

See [`SDD.md`](../../SDD.md) at the repo root for the commands (`/specify`, `/plan`, …)
and a worked example. In this Claude Code environment, drive the pipeline with the
Agent tool + the mapping above; delegate build work to `executor`, review to
`security-reviewer`/`code-reviewer`, verification to `verifier`/`test-engineer`.
