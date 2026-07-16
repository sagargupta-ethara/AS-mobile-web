# Protocol — Emergent Deploy & Automatic DB Migration

> **Read this before changing any collection shape, index, seed, or default.**
> Governed by Constitution Article III. This protocol is how a `git pull` on Emergent
> becomes a live database update with zero manual steps.

---

## 1. The mental model

There is **no separate migration runner** on Emergent. The deploy loop is:

```
edit locally → git commit → git push (origin/main)
      → Emergent pulls the commit → rebuilds the image → restarts the backend process
            → FastAPI startup handler bootstrap() runs → DB is now up to date
```

**The startup handler IS the migration tool.** It lives in `backend/server.py`:

```python
@app.on_event("startup")
async def bootstrap():
    # 1) indexes   2) data migrations/backfills   3) seeds
    ...
```

Because a process restart happens on every deploy (and every crash/scale event),
**this function may run thousands of times.** Therefore every statement inside it
must be **idempotent** — safe to run again on an already-migrated database.

## 2. The three phases (order is fixed — never reorder existing steps)

### Phase A — Indexes (always safe)
`create_index` is idempotent by definition; MongoDB no-ops if the index exists.

```python
await db.<collection>.create_index("<field>")               # simple
await db.<collection>.create_index("<field>", unique=True)  # unique constraint
await db.<collection>.create_index([("a", 1), ("b", -1)])   # compound
```

> ⚠️ Adding `unique=True` to a field that already has duplicates will **fail on boot**.
> First run a de-dup migration (Phase B), then add the unique index in the same deploy.

### Phase B — Data migrations & backfills (must self-exclude migrated docs)
Use a filter that only matches not-yet-migrated documents, so re-runs match nothing.

```python
# Rename/normalize a value — filter excludes already-migrated docs
res = await db.users.update_many({"role": "staff"}, {"$set": {"role": "tasker"}})
if res.modified_count:
    logger.info(f"Migrated {res.modified_count} user(s) staff->tasker")

# Add a new field with a default to docs missing it
await db.tasks.update_many({"archived": {"$exists": False}}, {"$set": {"archived": False}})

# Backfill from another field (aggregation-pipeline update)
await db.users.update_many({"name": {"$exists": False}}, [{"$set": {"name": "$email"}}])
```

### Phase C — Seeds (only when empty / only when absent)
Guard every seed so it inserts once, never duplicates.

```python
# Seed a collection only when it is empty
if await db.categories.count_documents({}) == 0:
    for name, icon in DEFAULT_CATEGORIES:
        await db.categories.insert_one({...})

# Seed a specific doc only when it does not exist
if not await db.users.find_one({"email": admin_email}, {"_id": 0}):
    await db.users.insert_one({...})
```

## 3. The idempotency rules (non-negotiable)

1. **Every step must be a no-op on the second run.** If you can't guarantee that, it's not a migration — redesign it.
2. **Filter, don't blindly write.** `update_many({<already-done?>: <no>}, ...)` — the filter is what makes it idempotent.
3. **Seed behind existence/emptiness checks.** Never unconditional `insert_one` in `bootstrap()`.
4. **Forward-only & non-destructive by default.** Deleting/dropping data requires an explicit spec that says so in bold and a Security + QA sign-off.
5. **Append, never reorder.** New migrations go at the **end** of `bootstrap()`. Existing steps stay put and stay forever (old DBs may still need them).
6. **No long/blocking work in startup.** Keep it fast and index-guarded; a huge collection scan on every boot is a smell — gate it (e.g. only run while a marker doc is absent, then write the marker).
7. **Production-safe seeds.** Demo/quick-login accounts with fixed passwords must be gated behind an explicit flag (e.g. `SEED_DEMO_USERS`) or environment check — never seeded unconditionally into a production DB (Constitution Art. II & III).

## 4. Recipes

**Add a field to an existing collection**
```python
# Phase B — backfill existing docs; new writes set it explicitly in the model/handler
await db.projects.update_many({"priority_weight": {"$exists": False}},
                              {"$set": {"priority_weight": 1}})
```

**Add a unique constraint to a field that may have dupes**
```python
# Phase B first: keep the newest per key, delete older dupes (write carefully, review required)
# ...de-dup logic...
# Phase A (after): now safe
await db.users.create_index("email", unique=True)
```

**Rename a field**
```python
await db.tasks.update_many({"old_name": {"$exists": True}},
                           {"$rename": {"old_name": "new_name"}})
```

**One-time heavy migration guarded by a marker** (avoid re-scanning forever)
```python
if not await db.meta.find_one({"_id": "migration_2026_08_reindex"}):
    # ...do the heavy one-time work...
    await db.meta.insert_one({"_id": "migration_2026_08_reindex", "at": datetime.now(timezone.utc)})
```

## 5. Definition of done for a DB change

A DB-affecting change is only "done" when **all** of these hold:

- [ ] The change is a spec (`specs/NNN-*`) with a `data-model.md` describing before/after.
- [ ] The migration is implemented in `bootstrap()` in the correct phase, appended at the end.
- [ ] It is **idempotent** — proven by running the backend twice against the same DB (see §6).
- [ ] Pydantic models + web + mobile type shapes are updated to match (Constitution Art. V).
- [ ] Destructive steps (if any) are called out in bold and have Security + QA sign-off.
- [ ] A test in `backend/tests/` exercises the new shape/behavior.

## 6. How to prove idempotency locally

With a local Mongo and a populated DB:

```bash
cd backend
# Boot once — migration applies
uvicorn server:app --port 8001   # watch logs: "Migrated N ...", then Ctrl-C
# Boot again — migration should report ZERO changes / no duplicate seeds
uvicorn server:app --port 8001   # logs must show no "Migrated"/"Seeded" counts
```

If the second boot logs any migration/seed activity, the step is **not** idempotent — fix it before pushing.

## 7. What Emergent handles vs. what you handle

| Emergent handles | You handle |
|---|---|
| Pulling the commit, rebuilding the image, restarting the process | Making `bootstrap()` idempotent |
| Injecting env vars (`MONGO_URL`, `DB_NAME`, secrets) | Reading them via `os.environ` only |
| Running webhook-crons (`.emergent/cron`) with `WEBHOOK_CRON_SECRET` | Any endpoint a cron calls (auth via that Bearer) |
| Persisting the MongoDB data across deploys | Forward-only, non-destructive schema evolution |

> **Bottom line:** if your DB change is not an idempotent step inside `bootstrap()`, it will
> **not** apply automatically on Emergent. Put it there, prove it re-runs cleanly, and the
> pull-to-deploy loop updates the database for you.
