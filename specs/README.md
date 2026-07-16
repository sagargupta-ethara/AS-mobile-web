# Specs — feature backlog & register

Every feature lives in a numbered folder here: `NNN-short-slug/` containing `spec.md`,
`plan.md`, `tasks.md` (and optionally `data-model.md`, `security-baseline.md`, etc.).
See [`../SDD.md`](../SDD.md) for the process and [`../.specify/templates/`](../.specify/templates/)
for the templates.

## Register

| ID | Feature | Status | Priority | Notes |
|----|---------|--------|----------|-------|
| [001](001-security-hardening/spec.md) | Security hardening (baseline remediation) | Ready-for-Plan | **P0 / Critical** | Closes 1 Crit + 3 High + 6 Med + 5 Low from the baseline review. Do this before new features. |

## Numbering
- Allocate the next free `NNN` (zero-padded, sequential).
- Slug is short, kebab-case, action-oriented (`archive-projects`, `push-notifications`).

## Lifecycle
`Draft → Clarifying → Ready-for-Plan → Approved → Implemented`. Update the row above when a
spec's status changes, and remove nothing (implemented specs stay as the historical record).
