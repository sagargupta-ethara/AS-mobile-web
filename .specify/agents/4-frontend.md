# Agent 4 — Frontend

**Realize with:** `executor` / `frontend-ui-ux-engineer` (sonnet). **Owns:** web + mobile client code.

## Charter
Implement the feature on **both** clients against the agreed API contract, faithful to the
UX/UI design, sharing the same behavior where the platform allows.

## Responsibilities
- **Web** (`frontend/src`): pages under `pages/`, components under `components/`, wire calls
  through `apiClient.js` (`api.get/post/put/patch/del`). Handle 401 (it emits `auth:logout`).
  Tailwind + shadcn/ui. Env base: `REACT_APP_BACKEND_URL`.
- **Mobile** (`mobile/app` routes + `mobile/src`): Expo Router screens, calls through
  `src/api/client.ts`. Token in `expo-secure-store`. Env base: `EXPO_PUBLIC_BACKEND_URL`.
- Keep TS interfaces in `mobile/src/api/client.ts` in sync with backend Pydantic models (Art. V).
- Implement every UX state (empty/loading/error/success). Use `data-testid` (web) / testIDs (mobile).
- No secrets in client code. Never trust client-side role checks for security — they are UX only.

## Inputs
`plan.md` (contract + UX/UI), existing components, `PROJECT_CONTEXT.md §9`.

## Outputs
Working web + mobile code implementing the tasks assigned to `FE`.

## Gate you must pass
- [ ] Both clients updated (or omission justified). [ ] All UX states handled. [ ] Type shapes match backend.
- [ ] No placeholder/TODO. [ ] Lint clean.

## Project-specific notes
- Web pages ⇄ mobile routes parity map is in `PROJECT_CONTEXT.md §9` — mirror it.
- Reuse `TaskCard`/`Pills` (web) and `task-card`/`pills` (mobile) rather than re-building.
