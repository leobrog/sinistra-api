# Flask + SQLite to Bun + Effect-TS + Turso Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the entire Sinistra Flask Server backend from Flask + SQLAlchemy + SQLite to Bun + Effect-TS + Turso/LibSQL.

**Progress:** Tasks 1-12b complete (12/48) | Phase 1: 13/13 tasks ✅ | Phase 2: 0/7 tasks

**Architecture:** Single-tenant Bun server using Effect HttpApi for endpoints, Turso/LibSQL for persistence, Effect Fibers for background schedulers.

**Tech Stack:** Bun, Effect-TS, Turso/LibSQL, jose (JWT), zeromq (EDDN), Discord REST API.

**Environment:** Bun installed at `~/.bun/bin/bun` | Working in git worktree `.worktrees/sinistra-migrations`

---

## Phase 1: Foundation (Domain Layer & Database)

### ✅ Task 1: Domain IDs [DONE]
- File: `src/domain/ids.ts`
- Add: EventId, ActivityId, CmdrId, ColonyId, ObjectiveId, etc.
- Commit: "feat(domain): add branded IDs for all entities"

### ✅ Task 2: Domain Models [DONE]
- File: `src/domain/models.ts`
- Add: Event, Activity, Objective, Cmdr, Colony, ProtectedFaction, EDDN models
- Commit: "feat(domain): add all domain entity models"

### ✅ Task 3: Domain Errors [DONE]
- File: `src/domain/errors.ts`
- Add: NotFoundError variants, DiscordApiError, InaraApiError, etc.
- Commit: "feat(domain): add error types"

### ✅ Task 4: Repository Interfaces [DONE]
- File: `src/domain/repositories.ts`
- Add: EventRepository, ActivityRepository, ObjectiveRepository, etc.
- Commit: "feat(domain): add repository interfaces"

### ✅ Task 5: Config Service [DONE]
- File: `src/lib/config.ts`
- Add: AppConfig with all env vars
- Commit: "feat(lib): add config service"

### ✅ Task 6-12b: Database Migrations [DONE]
Create new migrations to replace Flask INTEGER-ID tables with UUID-based tables:

**✅ Task 6**: `migrations/0004_create_events.sql`
- Tables: event, market_buy_event, market_sell_event, mission_completed_event, mission_completed_influence, faction_kill_bond_event, mission_failed_event, multi_sell_exploration_data_event, redeem_voucher_event, sell_exploration_data_event, commit_crime_event, synthetic_ground_cz, synthetic_cz
- All use TEXT UUIDs instead of INTEGER

**✅ Task 7**: `migrations/0005_create_activities.sql`
- Tables: activity, system, faction (for activity tracking)
- Nested structure with foreign keys

**✅ Task 8**: `migrations/0006_create_objectives.sql`
- Tables: objective, objective_target, objective_target_settlement
- Nested structure with foreign keys

**✅ Task 9**: `migrations/0007_create_cmdrs.sql`
- Table: cmdr

**✅ Task 10**: `migrations/0008_create_colonies.sql`
- Table: colony

**✅ Task 11**: `migrations/0009_create_protected_factions.sql`
- Table: protected_faction

**✅ Task 12**: `migrations/0010_create_eddn_tables.sql`
- Tables: eddn_message, eddn_system_info, eddn_faction, eddn_conflict, eddn_powerplay
- Note: Flask has separate db/bgs_data_eddn.db, we'll consolidate into single DB

**✅ Task 12b**: `migrations/0011_create_tick_state.sql`
- Table: tick_state

Commit: "feat(db): add all Sinistra domain migrations"

---

## Phase 2: Repository Implementations

### Task 13: EventRepository
- File: `src/database/repositories/EventRepository.ts`
- Logic: createEvent with sub-events (MarketBuy, MissionCompleted, etc.)
- Tests: EventRepository.test.ts
- Commit: "feat(db): add EventRepository"

### Task 14: ActivityRepository
- File: `src/database/repositories/ActivityRepository.ts`  
- Logic: Upsert activity with nested systems/factions
- Tests: ActivityRepository.test.ts
- Commit: "feat(db): add ActivityRepository"

### Task 15: ObjectiveRepository
- File: `src/database/repositories/ObjectiveRepository.ts`
- Logic: CRUD with nested targets/settlements
- Tests: ObjectiveRepository.test.ts
- Commit: "feat(db): add ObjectiveRepository"

### Task 16-19: Simple CRUD Repositories
- Files: CmdrRepository, ColonyRepository, ProtectedFactionRepository, TickRepository, EddnRepository
- Tests: *.test.ts for each
- Commit: "feat(db): add remaining repositories"

---

## Phase 3: Service Layer

### Task 20: Date Filter Service
- File: `src/services/date-filters.ts`
- Port: Flask's _date_filters.py logic (cw, lw, cm, ct, lt, etc.)
- Commit: "feat(services): add date filter service"

### Task 21: Discord Service
- File: `src/services/discord.ts`
- Methods: sendWebhook, getUserRoles, OAuth exchange
- Commit: "feat(services): add Discord service"

### Task 22: Inara Service
- File: `src/services/inara.ts`
- Methods: fetchCmdrProfile
- Commit: "feat(services): add Inara service"

---

## Phase 4: API Layer

### Task 23: API Key Middleware
- File: `src/api/middleware/apikey.ts`
- Logic: Validate apikey + apiversion headers
- Commit: "feat(api): add API key auth middleware"

### Task 24-35: API Endpoint Groups
Create for each:
- `src/api/<group>/api.ts` - Endpoint definitions
- `src/api/<group>/dtos.ts` - Request/response schemas
- `src/api/<group>/handlers.ts` - Handler implementations

**Groups:**
- events (POST /events)
- activities (PUT /activities, GET /api/activities)
- objectives (CRUD /objectives)
- summary (GET /api/summary/:key with date filters)
- colonies (CRUD /api/colonies)
- protected-factions (CRUD /api/protected-faction)
- system (GET /api/system-summary)
- auth (POST /api/login, Discord OAuth)
- discord (POST /api/summary/discord/*)
- commanders (POST /api/sync/cmdrs)
- discovery (GET /discovery)

Commit after each: "feat(api): add <group> API"

### Task 36: Compose API
- Files: `src/api/index.ts`, `src/api/handlers.ts`
- Combine all API groups
- Commit: "feat(api): compose all API groups"

---

## Phase 5: Background Schedulers

### Task 37: EDDN Client Fiber
- File: `src/schedulers/eddn-client.ts`
- Logic: ZMQ consumer, upsert EDDN data, cleanup job
- Commit: "feat(schedulers): add EDDN client"

### Task 38: Tick Monitor Fiber
- File: `src/schedulers/tick-monitor.ts`
- Logic: Poll tick, detect changes, notify Discord
- Commit: "feat(schedulers): add tick monitor"

### Task 39: Shoutout Scheduler Fiber
- File: `src/schedulers/shoutout-scheduler.ts`
- Logic: Run queries on tick change, send to Discord
- Commit: "feat(schedulers): add shoutout scheduler"

### Task 40: Conflict Scheduler Fiber
- File: `src/schedulers/conflict-scheduler.ts`
- Logic: Monitor conflicts, send notifications
- Commit: "feat(schedulers): add conflict scheduler"

### Task 41: Inara Sync Scheduler Fiber
- File: `src/schedulers/inara-sync.ts`
- Logic: Periodic cmdr sync with Inara API
- Commit: "feat(schedulers): add Inara sync"

### Task 42: Compose Schedulers
- File: `src/schedulers/index.ts`
- Fork all scheduler fibers
- Commit: "feat(schedulers): compose all schedulers"

---

## Phase 6: Server Composition

### Task 43: Main Server
- File: `src/main.ts`
- Wire all layers together
- Commit: "feat: compose full server"

### Task 44: Static Dashboard Serving
- File: `src/main.ts` or `src/api/static.ts`
- Serve React SPA from ../dashboard/dist
- Commit: "feat: add dashboard serving"

### Task 45: Environment Config
- File: `.env.example`
- Document all required env vars
- Commit: "docs: add env example"

---

## Phase 7: Testing & Verification

### Task 46: Integration Tests
- Files: `src/api/*/handlers.test.ts`
- Test: Full API flows with in-memory DB
- Commit: "test: add integration tests"

### Task 47: Data Migration Script
- File: `scripts/migrate-from-flask.ts`
- **Challenge**: Flask uses INTEGER auto-increment IDs, we use UUID TEXT IDs
- **Strategy**:
  1. Create ID mapping table (old INTEGER → new UUID)
  2. Read from Flask DB (/app/db/bgs_data.db and /app/db/bgs_data_eddn.db)
  3. Generate UUIDs for all entities
  4. Insert into new tables with new UUIDs
  5. Update foreign key references using mapping table
  6. Preserve all data relationships
- **Tables to migrate**:
  - Flask users (username, discord_id, cmdr_id) → Keep separate, different auth system
  - event + all event sub-tables (~13 tables)
  - activity, system, faction (~3 tables)
  - objective, objective_target, objective_target_settlement (~3 tables)
  - cmdr, colony, protected_faction (~3 tables)
  - EDDN tables from separate DB (~5 tables)
- Commit: "feat(scripts): add Flask data migration with ID conversion"

### Task 48: Full Verification
- Run: typecheck, test, build, manual verification
- Commit: "chore: verify full system"

---

## Key Implementation Notes

**Database:**
- IDs: UUIDs as TEXT
- Timestamps: ISO 8601 TEXT (not milliseconds)
- Booleans: INTEGER 0/1
- JSON: Stringified in TEXT columns

**Repository Patterns:**
- Effect.tryPromise for all DB calls
- Map snake_case → camelCase in mapRow helpers
- Schema.decodeUnknown for validation
- Option.fromNullable for nullable columns

**API Patterns:**
- Separate request/response DTOs
- Schema validation on all inputs
- Map domain errors to HTTP status codes
- ApiKeyAuth middleware for external clients

**Testing:**
- Repository: In-memory SQLite
- Handlers: Full layer stack
- Integration: Complete flows

**Migration Path:**
- Phase 1: Build complete Bun + Effect-TS system alongside Flask
- Phase 2: Run migration script to copy Flask data → new UUID-based tables
- Phase 3: Test Bun API endpoints against migrated data
- Phase 4: Run both systems in parallel (Flask + Bun on different ports)
- Phase 5: Switch traffic from Flask → Bun (update nginx/docker-compose)
- Phase 6: Monitor for issues, keep Flask as backup
- Phase 7: Decommission Flask once stable

**Flask Schema Reference** (current state):
- All tables use INTEGER auto-increment primary keys
- Timestamps stored as VARCHAR(64) strings
- Existing tables: event, activity, cmdr, objective, colony, protected_faction, system, faction, + 11 event sub-types
- Separate EDDN database at /app/db/bgs_data_eddn.db with eddn_* tables
- Users table has: username, password_hash, discord_id, cmdr_id (different from API users)

---

## Success Criteria

- [ ] All TypeScript compiles
- [ ] All tests pass
- [ ] All Flask endpoints ported
- [ ] All schedulers running
- [ ] Dashboard loads
- [ ] EDDN client connects
- [ ] Discord webhooks work
- [ ] Inara sync works
- [ ] Data migration successful
- [ ] Performance ≥ Flask
