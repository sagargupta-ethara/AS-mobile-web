# Web Frontend Commit Log

## Iteration 1 — Initial Scaffold (Phase 2a baseline)
- **Commit**: bc49af9b939972575244a449576c499dac893a46
- **Date**: 2026-07-15T13:05:00Z
- **Changes**: 
  - All 15 page components scaffolded (Login, Dashboard, Tasks, TaskDetail, NewTask, Projects, ProjectDetail, NewProject, Staff, NewStaff, Profile, History, Concierge, Reviews, TeamMember)
  - AppLayout sidebar with navigation
  - AuthContext with login/logout/refresh
  - apiClient.js with fetch wrapper
  - Theme colors matching mobile app
- **Files modified**: All files under `/app/frontend/src/`
- **Mobile files referenced**: All files under `/app/mobile/app/(app)/`, `/app/mobile/src/api/`, `/app/mobile/src/auth/`

## Iteration 2 — Phase 2a Fixes + Phase 2b Enhancements
- **Commit**: 09c1737602ca08a68c86471159985555b48fd659
- **Date**: 2026-07-15T13:19:07Z
- **Changes**:
  - Fixed: Added "Reviews" nav item to sidebar (visible for admin/manager only)
  - Fixed: 401 auto-logout — apiClient emits `auth:logout` event on 401, AuthContext listens and clears user
  - Fixed: Boot-time `/auth/me` call already existed — 401 from it now triggers auto-logout via event bus
  - Fixed: Lint issue (unescaped quotes in TaskDetailPage.js)
  - Added: AI Task Assistant component (`AiTaskAssistant.js`) — modal with natural language input, suggestion chips, POST /api/ai/task-parse
  - Added: AI Parse button in NewTaskPage header that opens the assistant and auto-fills form fields
  - Added: eslint-disable for shadcn/ui library lint warnings (calendar.jsx, command.jsx)
- **Files modified**: 
  - `/app/frontend/src/components/AppLayout.js` (Reviews nav)
  - `/app/frontend/src/apiClient.js` (401 auto-logout event bus)
  - `/app/frontend/src/auth/AuthContext.js` (401 listener)
  - `/app/frontend/src/pages/NewTaskPage.js` (AI Parse button)
  - `/app/frontend/src/pages/TaskDetailPage.js` (lint fix)
  - `/app/frontend/src/components/AiTaskAssistant.js` (new component)
  - `/app/frontend/src/components/ui/calendar.jsx` (eslint-disable)
  - `/app/frontend/src/components/ui/command.jsx` (eslint-disable)
- **Mobile files referenced**: `/app/mobile/src/ui/ai-task-assistant.tsx`, `/app/mobile/src/api/client.ts`, `/app/mobile/src/api/ai.ts`
