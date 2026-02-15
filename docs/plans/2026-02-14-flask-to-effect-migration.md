# Flask + SQLite to Bun + Effect-TS + Turso Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the entire Sinistra Flask Server backend from Flask + SQLAlchemy + SQLite to Bun + Effect-TS + Turso/LibSQL.

**Progress:** Tasks 1-32 complete (32/47) | Phase 1: 13/13 tasks ✅ | Phase 2: 7/7 tasks ✅ | Phase 3: 3/3 tasks ✅ | Phase 4: 10/13 tasks ✅

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

### ✅ Task 13: EventRepository [DONE]
- File: `src/database/repositories/EventRepository.ts`
- Logic: createEvent with sub-events (MarketBuy, MissionCompleted, etc.)
- Tests: EventRepository.test.ts (7 tests, 23 assertions)
- Commit: "feat(db): add EventRepository"

### ✅ Task 14: ActivityRepository [DONE]
- File: `src/database/repositories/ActivityRepository.ts`
- Logic: Upsert activity with nested systems/factions
- Tests: ActivityRepository.test.ts (8 tests)
- Commit: "feat(db): add ActivityRepository"

### ✅ Task 15: ObjectiveRepository [DONE]
- File: `src/database/repositories/ObjectiveRepository.ts`
- Logic: CRUD with nested targets/settlements
- Tests: ObjectiveRepository.test.ts (8 tests)
- Commit: "feat(db): add ObjectiveRepository"

### ✅ Task 16-19: Simple CRUD Repositories [DONE]
- Files: CmdrRepository, ColonyRepository, ProtectedFactionRepository, TickRepository, EddnRepository
- Tests: *.test.ts for each (38 tests total across 5 repositories)
- Commit: "feat(db): add remaining repositories"

---

## Phase 3: Service Layer

### ✅ Task 20: Date Filter Service [DONE]
- File: `src/services/date-filters.ts`
- Port: Flask's _date_filters.py logic (cw, lw, cm, ct, lt, etc.)
- Tests: date-filters.test.ts
- Commit: "feat(services): add date filter service"

### ✅ Task 21: Discord Service [DONE]
- File: `src/services/discord.ts`
- Methods: sendWebhook, getUserRoles, OAuth exchange
- Tests: discord.test.ts
- Commit: "feat(services): add Discord service"

### ✅ Task 22: Inara Service [DONE]
- File: `src/services/inara.ts`
- Methods: fetchCmdrProfile
- Tests: inara.test.ts
- Commit: "feat(services): add Inara service"

---

## Phase 4: API Layer

### ✅ Task 23: API Key Middleware [DONE]
- File: `src/api/middleware/apikey.ts`
- Logic: Validate apikey + apiversion headers using HttpApiMiddleware pattern
- Commit: "feat(api): add Events API endpoint group" (included middleware refactor)

### ✅ Task 24: Events API [DONE]
- Files: `src/api/events/{api.ts,dtos.ts,handlers.ts}`
- Endpoint: POST /events
- Logic: Ingest Elite Dangerous journal events with sub-events
- Commit: "feat(api): add Events API endpoint group"

### ✅ Task 25: Activities API [DONE]
- Files: `src/api/activities/{api.ts,dtos.ts,handlers.ts}`
- Endpoints: PUT /activities, GET /api/activities
- Logic: Upsert/query BGS activities with nested systems/factions, tick filtering
- Commit: "feat(api): add Activities API endpoint group"

### ✅ Task 26: Objectives API [DONE]
- Files: `src/api/objectives/{api.ts,dtos.ts,handlers.ts}`
- Endpoints: POST/GET/UPDATE/DELETE /objectives and /api/objectives
- Logic: Full CRUD with nested targets/settlements, active filtering
- Commit: "feat(api): add Objectives API endpoint group"

### ✅ Task 27: Summary API [DONE]
- Files: `src/api/summary/{api.ts,dtos.ts,handlers.ts}`
- Endpoints:
  - GET /api/summary/:key (9 query types with date/tick filtering)
  - GET /api/summary/top5/:key (top 5 results)
  - GET /api/summary/leaderboard (comprehensive commander stats)
  - GET /api/summary/recruits (recruit progression tracking)
- Logic: Aggregated event statistics with date filters (ct, lt, cw, lw, cm, lm, 2m, y, cd, ld)
- Note: Added FACTION_NAME to AppConfig for tenant-specific filtering
- Commit: "feat(api): add Summary API endpoint group"

### ✅ Task 28: Colonies API [DONE]
- Files: `src/api/colonies/{api.ts,dtos.ts,handlers.ts}`
- Endpoints: Full CRUD + search + priority management (8 endpoints)
  - GET/POST /api/colonies
  - GET/PUT/DELETE /api/colonies/:id
  - GET /api/colonies/search (by cmdr, system, or address)
  - GET /api/colonies/priority (ordered by priority level)
  - POST /api/colonies/:id/priority (set priority)
- Commit: "feat(api): add Colonies API endpoint group"

### ✅ Task 29: Protected Factions API [DONE]
- Files: `src/api/protected-factions/{api.ts,dtos.ts,handlers.ts}`
- Endpoints: Full CRUD + EDDN system lookup (6 endpoints)
  - GET/POST /api/protected-faction
  - GET/PUT/DELETE /api/protected-faction/:id
  - GET /api/protected-faction/systems (all EDDN system names)
- Note: Requires EddnRepository.getAllSystemNames() implementation
- Commit: "feat(api): add Protected Factions API endpoint group"

### ✅ Task 30: System API [DONE]
- Files: `src/api/system/{api.ts,dtos.ts,handlers.ts}`
- Endpoint: GET /api/system-summary/:systemName (with 14+ query filters)
- Logic: Query EDDN data by faction, state, government, population, conflict, power, powerplay
- Extended EddnRepository with 16 new query methods
- Migration: 0012_create_flask_users.sql (for auth compatibility)
- Commit: "feat(api): add System, Auth, and Discord API endpoint groups"

### ✅ Task 31: Auth API (Discord OAuth) [DONE]
- Files: `src/api/auth/{api.ts,dtos.ts,handlers.ts}`
- Endpoints:
  - POST /api/verify_discord (verify Discord user, return JWT)
  - GET /api/auth/discord/callback (OAuth callback)
- Created FlaskUser model and FlaskUserRepository for Discord-based auth
- Created JWT service using jose library
- Commit: "feat(api): add System, Auth, and Discord API endpoint groups"

### ✅ Task 32: Discord Summary API [DONE]
- Files: `src/api/discord-summary/{api.ts,dtos.ts,handlers.ts}`
- Endpoints:
  - POST /api/summary/discord/top5all (top 5 stats)
  - POST /api/summary/discord/tick (daily tick summary)
  - POST /api/summary/discord/syntheticcz (space CZ summary)
  - POST /api/summary/discord/syntheticgroundcz (ground CZ summary)
  - POST /api/discord/trigger/custom-message (custom Discord messages)
- Note: Query aggregation logic marked as TODO for future implementation
- Commit: "feat(api): add System, Auth, and Discord API endpoint groups"

### Task 33-34: Remaining API Endpoint Groups
Create for each remaining group:
- `src/api/<group>/api.ts` - Endpoint definitions
- `src/api/<group>/dtos.ts` - Request/response schemas
- `src/api/<group>/handlers.ts` - Handler implementations

**Remaining Groups:**
- commanders (POST /api/sync/cmdrs) - Task 33
- discovery (GET /discovery) - Task 34

Commit after each: "feat(api): add <group> API"

### Task 35: Compose API
- Files: `src/api/index.ts`, `src/api/handlers.ts`
- Combine all API groups
- Commit: "feat(api): compose all API groups"

---

## Phase 5: Background Schedulers

### Task 36: EDDN Client Fiber
- File: `src/schedulers/eddn-client.ts`
- Logic: ZMQ consumer, upsert EDDN data, cleanup job
- Commit: "feat(schedulers): add EDDN client"

### Task 37: Tick Monitor Fiber
- File: `src/schedulers/tick-monitor.ts`
- Logic: Poll tick, detect changes, notify Discord
- Commit: "feat(schedulers): add tick monitor"

### Task 38: Shoutout Scheduler Fiber
- File: `src/schedulers/shoutout-scheduler.ts`
- Logic: Run queries on tick change, send to Discord
- Commit: "feat(schedulers): add shoutout scheduler"

### Task 39: Conflict Scheduler Fiber
- File: `src/schedulers/conflict-scheduler.ts`
- Logic: Monitor conflicts, send notifications
- Commit: "feat(schedulers): add conflict scheduler"

### Task 40: Inara Sync Scheduler Fiber
- File: `src/schedulers/inara-sync.ts`
- Logic: Periodic cmdr sync with Inara API
- Commit: "feat(schedulers): add Inara sync"

### Task 41: Compose Schedulers
- File: `src/schedulers/index.ts`
- Fork all scheduler fibers
- Commit: "feat(schedulers): compose all schedulers"

---

## Phase 6: Server Composition

### Task 42: Main Server
- File: `src/main.ts`
- Wire all layers together
- Commit: "feat: compose full server"

### Task 43: Static Dashboard Serving
- File: `src/main.ts` or `src/api/static.ts`
- Serve React SPA from ../dashboard/dist
- Commit: "feat: add dashboard serving"

### Task 44: Environment Config
- File: `.env.example`
- Document all required env vars
- Commit: "docs: add env example"

---

## Phase 7: Testing & Verification

### Task 45: Integration Tests
- Files: `src/api/*/handlers.test.ts`
- Test: Full API flows with in-memory DB
- Commit: "test: add integration tests"

### Task 46: Data Migration Script
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

### Task 47: Full Verification
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
