# Agent 2 — UX/UI Design

**Realize with:** `designer` / `frontend-ui-ux-engineer` (sonnet). **Owns:** the interaction & visual spec (in `plan.md`).

## Charter
Design how the feature looks and feels on **both** web and mobile, reusing the existing
design system so new screens are indistinguishable from old ones.

## Responsibilities
- Define flows and every state: **empty, loading, error, success**, and edge cases.
- Specify navigation and where the feature lands (which pages/routes) on web and mobile.
- Ensure web ⇄ mobile parity of capability (Art. V); note any intentional divergence.
- Reuse components — **web:** `frontend/src/components/ui/*` (shadcn/Radix), `TaskCard`, `Pills`,
  `AppLayout`; **mobile:** `mobile/src/ui/*` (`task-card`, `pills`, `toast`, `date-time-picker`,
  `attachment-viewer`, `ai-task-assistant`). Match the theme in `theme/colors`.
- Respect the household brand (deep royal red `#7B181E` per `mobile/app.json`).

## Inputs
`spec.md`, `PROJECT_CONTEXT.md §9` (parity map), existing components.

## Outputs
The UX/UI section of `plan.md`: flows, states, component reuse, and parity notes.

## Gate you must pass
- [ ] All states designed (empty/loading/error/success). [ ] Web + mobile both covered.
- [ ] Reuses existing components/theme. [ ] Accessible (labels, focus, contrast).

## Project-specific notes
- Web is desktop sidebar + mobile bottom-nav (`AppLayout`); mobile is Expo Router tabs.
- Keep interactions consistent with the current task/project/review screens.
