# Iteration 2 — Phase 2a Fixes + Phase 2b Verification

## What was implemented
### Phase 2a Fixes
1. **Reviews nav item** — Added `Inbox` icon nav entry to AppLayout sidebar, filtered by `managerOnly: true` (hidden for tasker). Route: `/reviews`.
2. **401 auto-logout** — apiClient.js now emits a custom `auth:logout` event on any 401 response. AuthContext listens via `onAuthLogout()` and clears user state, which triggers the ProtectedRoute redirect to `/login`. Boot-time `/auth/me` already existed and now properly triggers logout on 401.

### Phase 2b Verification — All 7 Pages Confirmed Working
| Page | Route | Status |
|------|-------|--------|
| Projects | `/projects` | Renders list, create form, detail with members/tasks/close |
| Tasks | `/tasks` | Filter chips, task cards, new task form |
| Reviews | `/reviews` | Pending submissions list, empty state |
| Team | `/staff` | User list with filters (All/Managers/Taskers), add/delete |
| History | `/history` | Tabs (Tasks/Projects), empty states |
| Profile | `/profile` | User info, account details, sign out |
| Concierge | `/concierge` | Chat UI with real GPT-4o replies |

### New Feature: AI Task Assistant
- `AiTaskAssistant.js` component — modal with text area, suggestion chips, POST /api/ai/task-parse
- AI Parse button added to NewTaskPage header
- Auto-fills title, description, category, priority, due date, recurrence from parsed result

## Mobile-to-Web Mapping Decisions
- Reviews nav placement: between Team and History (matching mobile tab order)
- 401 handling: custom event bus instead of axios interceptor (we use fetch, not axios)
- AI Task Assistant: faithful port of mobile's `ai-task-assistant.tsx` with suggestion chips

## Dependencies Installed
- None new (all needed packages already present)

## Known Issues
- None blocking. All pages compile and render.
- Calendar and Command lint warnings suppressed with eslint-disable (standard shadcn/ui patterns)
