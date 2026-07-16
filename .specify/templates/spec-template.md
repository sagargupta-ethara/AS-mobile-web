# Spec — [FEATURE NAME]

> **Stage:** `/specify` · **Owner:** Requirements & Business Rules Agent
> **Rule:** describe **WHAT** and **WHY**, never **HOW**. No stack, schema, or endpoint
> names here — those belong in `plan.md`. Mark every unknown as
> `[NEEDS CLARIFICATION: question]`; do not guess.

- **Spec ID:** `NNN-slug`
- **Status:** Draft | Clarifying | Ready-for-Plan | Approved | Implemented
- **Created:** YYYY-MM-DD
- **Constitution check:** does this respect all Articles? (Security Art. II, DB Art. III, Parity Art. V)

## 1. Problem / opportunity
What need does this serve, and for whom? Why now?

## 2. Goals & non-goals
- **Goals:** …
- **Non-goals (explicitly out of scope):** …

## 3. Users & roles affected
Which of `admin` / `manager` / `tasker` are involved, and on web, mobile, or both?

## 4. User stories
- **US-1** — As a `<role>`, I want `<capability>` so that `<benefit>`.
- **US-2** — …

## 5. Functional requirements
Each is testable and gets a stable ID. Reference these IDs from `tasks.md` and tests.

- **FR-001** — The system MUST …
- **FR-002** — The system MUST …
- **FR-003** — When `<condition>`, the system MUST `<behavior>`.

## 6. Business rules & authorization
State the rules precisely (who can do what, valid state transitions, ownership).
Cross-check against `PROJECT_CONTEXT.md §7`. Call out any new authorization surface.

## 7. Acceptance criteria (Given/When/Then)
- **AC-1** (FR-001): **Given** … **When** … **Then** …
- **AC-2** (FR-002): …

## 8. Data touched (conceptual only)
Which entities/concepts are read or changed (users, projects, tasks, assignments,
rounds, categories, logs, chat)? **No schema here** — flag if a DB migration is likely
so the Architecture/DB Agent plans it (Art. III).

## 9. Security & privacy considerations
New inputs? New external surface (upload / webhook / AI prompt)? Sensitive data?
One paragraph minimum — the Security Review Agent expands this at `/verify`.

## 10. Web ⇄ mobile parity
Does this land on web, mobile, or both? If one is deferred, justify (Art. V).

## 11. Open questions
- [NEEDS CLARIFICATION: …]

## 12. Success metrics
How will we know it worked? (qualitative is fine.)
