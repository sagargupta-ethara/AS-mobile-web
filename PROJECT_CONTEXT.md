# PROJECT_CONTEXT — Scindia Royal Household

> Single source of truth for **what this system is** and **how it fits together**.
> Read this first. It is loaded as shared context by every agent in the SDD workflow.
> Keep it accurate — when the code and this file disagree, fix whichever is wrong.
>
> **Governed by** [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
> Last synced with code: 2026-07-16 (`backend/server.py` API v2.1).

---

## 1. What it is

**Scindia Royal Household — Staff & Task Management.** An internal operations app for
a royal household's staff: managers create projects and tasks, assign them to taskers,
review submitted work across multiple rounds with star ratings, and track performance.
An AI concierge (GPT-4o via Emergent) parses natural-language task descriptions and
answers questions.

**Three roles:** `admin` · `manager` · `tasker`.

## 2. Shape of the repo

```
AS-mobile-web/
├── backend/            FastAPI + MongoDB (async, Motor). One file: server.py (~1447 lines)
│   ├── server.py       All routes, models, auth, AI, and the startup bootstrap/migrations
│   ├── requirements.txt
│   └── tests/          pytest suites (test_ai, test_scindia_v2, test_reviews_digest, ...)
├── frontend/           React 19 web app (CRA + CRACO), Tailwind + shadcn/ui, React Router v7
│   └── src/            apiClient.js, auth/, components/, pages/, theme/, ui/
├── mobile/             Expo / React Native (SDK 54, RN 0.81), Expo Router v6, TypeScript
│   └── src/ + app/     file-based routes mirroring the web pages
├── .emergent/          Emergent platform config (deploy image, webhook-crons, markers)
├── memory/             Prior iteration notes + commit log (pre-SDD history)
├── .specify/           ← SDD system: constitution, templates, agents, protocols
├── specs/              ← per-feature specs (NNN-slug/spec.md, plan.md, tasks.md)
└── PROJECT_CONTEXT.md  ← this file
```

## 3. Tech stack (exact)

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | FastAPI 0.110, Uvicorn, **Motor 3.3** (async MongoDB), Pydantic v2 | routes under `/api` prefix |
| Auth | **python-jose** JWT (HS256), **passlib + bcrypt** hashing, OAuth2PasswordBearer | 720h token expiry default |
| AI | **emergentintegrations** `LlmChat` → GPT-4o | key `EMERGENT_LLM_KEY` |
| DB | MongoDB (Emergent-managed) | collections listed in §5 |
| Web | React 19, react-router-dom v7, Tailwind, shadcn/ui (Radix), fetch wrapper | build: `craco build` |
| Mobile | Expo SDK 54, expo-router 6, react-native 0.81, expo-secure-store | `expo start` |
| Deploy | Emergent (`mono_fullstack_base_image_cloud_arm`) | see §8 |

## 4. Environment variables (never committed — injected by Emergent)

**Backend** (`os.environ`): `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `JWT_ALGORITHM` (def `HS256`),
`JWT_EXPIRE_HOURS` (def `720`), `EMERGENT_LLM_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`ADMIN_NAME` (def `Administrator`), `WEBHOOK_CRON_SECRET`.
**Web**: `REACT_APP_BACKEND_URL`. **Mobile**: `EXPO_PUBLIC_BACKEND_URL`.
All `.env*` files are git-ignored. Do not add real secrets to the repo.

## 5. Data model (MongoDB collections)

All documents use a string `id` (uuid4) as the app-level key (not Mongo `_id`, which is projected out).

- **users** — `id, name, email (unique, lowercased), phone, hashed_password, role, avatar, created_at, created_by`. `avg_rating`/`ratings_count` are **computed** from approved assignment ratings, not stored.
- **projects** — `id, name, description, status(active|closure_proposed|closed), manager_ids[], tasker_ids[], created_by, final_rating, final_feedback, closure_proposed_by, closure_proposed_note, created_at, closed_at`.
- **tasks** — `id, title, description, category, project_id, priority(low|medium|high|urgent), due_date, is_recurring, recurrence(daily|weekly|monthly), created_by, created_at, updated_at, assignments[]`.
  - **assignment** — `id, assignee_id, status(pending|in_progress|submitted|rejected|approved), rounds[], final_rating, approved_at`.
  - **round** — `id, submitted_at, photos[], files[] (Attachment: id,name,mime,size,data_uri), note, decision(approve|reject|null), rating, feedback, reviewed_by, reviewed_at`.
  - `overall_status` is **computed** from assignments (`pending|in_progress|in_review|completed`).
- **categories** — `id, name, icon`. Seeded defaults: Housekeeping, Culinary, Chauffeur, Grounds & Estate, Security, Family Office, Guest Relations, Wardrobe.
- **activity_logs** — `id, actor_id, actor_name, action, entity_type, entity_id, meta, created_at`.
- **chat_messages** — `id, user_id, session_id, role(user|assistant), content, created_at`. AI concierge history.

**Indexes** (created idempotently in `bootstrap()`): `users.email` (unique), `users.id` (unique), `tasks.id` (unique), `tasks.project_id`, `tasks.assignments.assignee_id`, `categories.id` (unique), `projects.id` (unique), `activity_logs.{entity_id,actor_id,created_at}`.

## 6. API surface (all under `/api`)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /auth/login` | public | email+password → JWT + user |
| `GET /auth/me` | user | current user |
| `GET /users` `POST /users` `DELETE /users/{id}` | user / manager / manager | list / create / delete team |
| `GET /users/{id}/profile` | user | profile + stats + recent reviews |
| `GET /categories` | user | task categories |
| `GET /projects` `POST /projects` `GET/PATCH /projects/{id}` | scoped / admin / visibility | project CRUD |
| `PUT /projects/{id}/members` | admin/mgr | set managers/taskers |
| `POST /projects/{id}/propose-close` `.../close` | mgr / admin+mgr | closure workflow |
| `GET /tasks` `POST /tasks` `GET/PATCH/DELETE /tasks/{id}` | scoped / manager / … | task CRUD |
| `POST /tasks/{id}/assignments/{aid}/status` | assignee/admin | pending→in_progress |
| `POST /tasks/{id}/assignments/{aid}/submit` | assignee | submit a round |
| `POST /tasks/{id}/assignments/{aid}/review` | task creator/admin | approve/reject + rate |
| `GET /stats/dashboard` `GET /stats/projects/{id}` | scoped / visibility | analytics |
| `GET /logs` | user (tasker self-scoped) | activity feed |
| `GET /reviews/pending` | manager+ | review queue |
| `POST /ai/task-parse` | manager | NL → structured task |
| `POST /ai/chat/send` `GET /ai/chat/history` `DELETE /ai/chat/history` | user | AI concierge |

## 7. Business rules (authoritative — verified against `backend/server.py`)

**Projects**
- Create: **admin only**. Update (name/description only): admin or a project manager. Members: managers editable by admin only; taskers editable by admin or project manager. Closed projects reject member edits.
- Closure: `active → closure_proposed` (propose-close, manager on the project) `→ closed` (close, admin or project manager). A project **can be closed directly from `active`** without a proposal. Closing records `final_rating` + `final_feedback` + `closed_at`.
- Visibility: admin sees all; manager/tasker see projects where they are a manager, tasker, or the creator.

**Tasks**
- Create: **manager or admin**; must have ≥1 assignee. A manager may assign **only to taskers**; project (if set) must exist, be open, and the creator must be admin or a manager on it.
- List: **tasker** is force-filtered to their own assignments (cannot pass `assignee_id`). Manager/admin can filter by `project_id`/`assignee_id`.
- Get: tasker restricted to own assignments. Update: tasker blocked; manager restricted to tasks they created; admin unrestricted. Delete: same as update.

**Assignment lifecycle** (per assignee within a task)
- State machine: `pending → in_progress` (`/status`, by assignee or admin) `→ submitted` (`/submit`, assignee only, appends a **round**) `→ approved | rejected` (`/review`, **task creator or admin**).
- Multi-round: each `/submit` appends a round; `/review` decides the last un-decided round. On **approve**: `final_rating` = average of all round ratings (2 dp), `approved_at` set, status `approved`. On **reject**: status `rejected`.

**Stats/logs**: dashboard and logs are role-scoped (tasker → self only). `top_taskers` leaderboard is global for admin.

> ⚠️ **Known authorization gaps** (candidates for the security-hardening spec, see `specs/001-*`):
> `GET /tasks/{id}` and the review endpoint lack an explicit project-membership check for managers → potential IDOR across managers' projects. These are tracked, not yet fixed.

## 8. Emergent deployment & the DB self-update loop

**Deploy loop:** edit here → commit → push to `github.com/sagargupta-ethara/AS-mobile-web` (branch `main`) → pull on Emergent → Emergent rebuilds the image and restarts.

**The database updates itself on boot.** There is no separate migration step. The FastAPI
`@app.on_event("startup")` handler `bootstrap()` runs on every start and performs, in order:
1. **Indexes** (`create_index`, idempotent).
2. **Migrations** — idempotent `update_many`/backfills (e.g. `role: staff→tasker`, backfill missing `name`, drop legacy pre-`assignments` task docs).
3. **Seeds** — admin (env-gated on `ADMIN_EMAIL`/`ADMIN_PASSWORD`), demo users, default categories (only when the collection is empty).

➡️ **Any DB change MUST be encoded here as an idempotent step.** Full rules & recipes:
[`.specify/protocols/emergent-db-migration.md`](.specify/protocols/emergent-db-migration.md).

**Emergent platform files** (`.emergent/`): `emergent.yml` (deploy image + job id), `cron/` (webhook-cron dispatcher — fires HTTP webhooks authenticated with `Bearer $WEBHOOK_CRON_SECRET`), `markers/` (restore/bootstrap markers). Commit identity is `emergent-agent` (`.gitconfig`).

## 9. Web ⇄ Mobile parity map

The backend is the single source of truth; both clients mirror it. Route parity:

| Feature | Web (`frontend/src/pages`) | Mobile (`mobile/app`) |
|---|---|---|
| Login | `LoginPage.js` | `login.tsx` |
| Dashboard | `DashboardPage.js` | `(app)/index.tsx` |
| Tasks / new / detail | `TasksPage`, `NewTaskPage`, `TaskDetailPage` | `(app)/tasks/{index,new,[id]}.tsx` |
| Projects / new / detail | `ProjectsPage`, `NewProjectPage`, `ProjectDetailPage` | `(app)/projects/{index,new,[id]}.tsx` |
| Team / new / member | `StaffPage`, `NewStaffPage`, `TeamMemberPage` | `(app)/staff/*`, `(app)/team/[id].tsx` |
| Reviews | `ReviewsPage.js` | `(app)/reviews.tsx` |
| History | `HistoryPage.js` | `(app)/history.tsx` |
| Profile | `ProfilePage.js` | `(app)/profile.tsx` |
| AI Concierge | `ConciergePage.js` | `(app)/concierge.tsx` |

Client conventions: web token in `localStorage["scindia_token"]` + `auth:logout` event on 401;
mobile token in `expo-secure-store` (key `scindia_token`), cleared on 401. API base differs by env var (§4).

## 10. How to work here

1. Read this file + the [Constitution](.specify/memory/constitution.md).
2. Follow the SDD flow — see [`SDD.md`](SDD.md): `/specify → /clarify → /plan → /tasks → /implement → /verify`.
3. Every feature runs through the [eight-agent workflow](.specify/agents/README.md).
4. Any DB change follows the [migration protocol](.specify/protocols/emergent-db-migration.md).
5. Security is a gate, not an afterthought (Constitution Article II).
