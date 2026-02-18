# Flask + SQLite to Bun + Effect-TS + Turso Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the entire Sinistra Flask Server backend from Flask + SQLAlchemy + SQLite to Bun + Effect-TS + Turso/LibSQL.

**Progress:** Phase 5 complete ✅ | Phase 1: 13/13 ✅ | Phase 2: 7/7 ✅ | Phase 3: 3/3 ✅ | Phase 4: 13/13 ✅ | Phase 4c: 10/10 ✅ | Phase 5: 6/6 ✅

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

### ✅ Task 33: Commanders API [DONE]

- Files: `src/api/commanders/{api.ts,dtos.ts,handlers.ts}`
- Endpoint: POST /api/sync/cmdrs
- Logic: Sync commanders with Inara API or add from events only
- Query param: `?inara=true` (default) or `?inara=false`
- Extended EventRepository with `getDistinctCmdrNames()` method
- Commit: "feat(api): add Commanders API"

### ✅ Task 34: Discovery API [DONE]

- Files: `src/api/discovery/{api.ts,dtos.ts,handlers.ts}`
- Endpoint: GET /discovery
- Logic: Return server capabilities, available endpoints, and required headers
- Commit: "feat(api): add Discovery API"

### ✅ Task 35: Compose API [DONE]

- Files: `src/api/index.ts`, `src/main.ts`
- Combined all 11 API groups (Events, Activities, Objectives, Summary, Colonies, ProtectedFactions, System, Auth, DiscordSummary, Commanders, Discovery)
- Wired all handlers and repository dependencies in main.ts
- Commit: "feat(api): compose all API groups"

---

## Phase 4b: Code Core Review ✅

**Objective:** Systematically fix TypeScript errors introduced during rapid API implementation (600+ errors → 0 errors)

**Key Patterns Established:**

1. **Service Pattern**: All services extend `Context.Tag("ServiceName")<ServiceName, ShapeType>()`
2. **Repository Pattern**: Use local repo variable pattern, cast branded IDs, handle Option types properly
3. **HttpApiBuilder Pattern**: Use composed `Api` from `src/api/index.ts`, exports named `*ApiLive`
4. **Option Handling**: Manual `Option.isNone()` checks with `Effect.fail()` for error cases
5. **Schema Patterns**: Use `Schema.optional()` for optional fields, apply defaults in handlers
6. **Error Types**: All API errors must be `Schema.TaggedError` to work with `.addError()`
7. **Type Imports**: Use `import type` for pure type imports (`verbatimModuleSyntax` requirement)
8. **LibSQL Client**: Always import as `type { Client }` from `@libsql/client`
9. **Test Assertions**: Use `!` for non-null assertions after length checks

**Production Status:** All core APIs now compile without errors and are ready for integration testing.

---

## Phase 4c: API Integration Testing

**Objective:** Verify each API endpoint matches Flask behavior and dashboard client expectations by writing integration tests that simulate real-world usage.

**Strategy:** For each API endpoint:

1. **Study Flask implementation** - Understand exact request/response format, validation, error handling
2. **Study dashboard client** - Check `[...]/VALKFlaskServer/dashboard/src/services` to see how the dashboard actually uses the API
3. **Write integration test** - Create test that mimics dashboard usage pattern, verifying production-ready behavior

**API Endpoints to Test:**

### ✅ Task 36: Events API Integration Test

- **Flask**: `POST /events` - Ingests journal events with type-specific sub-events
- **Dashboard**: Used by EDJournalWatcher service to stream journal events
- **Test**: Submit various event types (MarketBuy, MissionCompleted, FactionKillBond, etc.), verify sub-event creation
- File: `src/api/events/handlers.test.ts`
- Commit: "test(api): add Events API integration test"

### ✅ Task 37: Activities API Integration Test

- **Flask**: `PUT /activities` (upsert), `GET /api/activities` (query with date filters)
- **Dashboard**: BGS activity tracking with tick-based filtering
- **Test**: Upsert nested activities, query by tick/date filters, verify system/faction relationships
- File: `src/api/activities/handlers.test.ts`
- Commit: "test(api): add Activities API integration test"

### ✅ Task 38: Objectives API Integration Test [DONE]

- **Flask**: Full CRUD on `/objectives` and `/api/objectives`, active filtering
- **Dashboard**: Objective management UI with targets/settlements
- **Test**: CRUD operations with nested targets, verify active filtering, deletion cascades (13 tests)
- File: `src/api/objectives/handlers.test.ts`
- Commit: "test(api): add Objectives API integration test"

### ✅ Task 38d: Objectives progressDetail [DONE]

- **Flask**: GET `/objectives` now returns a `progressDetail` field per target, calculated dynamically from event data (synthetic_cz, redeem_voucher_event, etc.) rather than stored values. The `progress` field on targets and settlements is also overridden with the calculated value.
- **Change**: Added `ProgressDetailSchema` (overallProgress, overallTarget, overallPercentage, cmdrProgress[], settlementProgress[]) to `dtos.ts`; `GetObjectivesResponse` now uses new `ObjectiveResponseSchema` that includes `progressDetail` on each target
- **Logic**: Period is auto-determined from objective dates (custom range if startdate set, current tick otherwise); `?period=` param overrides; all 9 target types supported (space_cz, ground_cz, bv, cb, inf, expl, trade_prof, mission_fail, murder); graceful fallback to zero progress if tables unavailable
- Files: `src/api/objectives/dtos.ts`, `src/api/objectives/handlers.ts`

### ✅ Task 39: Summary API Integration Test [DONE]

- **Flask**: Multiple endpoints (`/api/summary/:key`, `/api/summary/top5/:key`, leaderboard, recruits)
- **Dashboard**: Leaderboard displays, top 5 cards, recruit progression
- **Test**: Query all summary types with date filters (ct, lt, cw, lw, cm, etc.), verify aggregations
- File: `src/api/summary/handlers.test.ts`
- Commit: "test(api): add Summary API integration test"

### ✅ Task 40: Colonies API Integration Test [DONE]

- **Flask**: Full CRUD + search + priority management (8 endpoints)
- **Dashboard**: Colony management UI with search and priority sorting
- **Test**: CRUD, search by cmdr/system/address, priority ordering and updates
- File: `src/api/colonies/handlers.test.ts`
- Commit: "test(api): add Colonies API integration test"

### ✅ Task 41: Protected Factions API Integration Test [DONE]

- **Flask**: CRUD + `/api/protected-faction/systems` (EDDN system lookup)
- **Dashboard**: Protected faction configuration
- **Test**: CRUD operations, system name listing from EDDN data
- File: `src/api/protected-factions/handlers.test.ts`
- Commit: "test(api): add Protected Factions API integration test"

### ✅ Task 42: System API Integration Test [DONE]

- **Flask**: `GET /api/system-summary/:systemName` with 14+ query filters
- **Dashboard**: System detail views with faction/state/conflict filters
- **Test**: Query with various filters (faction, state, government, population, conflict, power)
- File: `src/api/system/handlers.test.ts`
- Commit: "test(api): add System API integration test"

### ✅ Task 43: Auth API Integration Test [DONE]

- **Flask**: Discord OAuth flow (`POST /api/verify_discord`, `GET /api/auth/discord/callback`)
- **Dashboard**: Login flow, JWT management
- **Test**: Verify Discord user creation, OAuth callback handling, JWT generation
- File: `src/api/auth/handlers.test.ts`
- Commit: "test(api): add Auth API integration test"

### ✅ Task 44: Discord Summary API Integration Test [DONE]

- **Flask**: Discord webhook endpoints (top5all, tick, syntheticcz, syntheticgroundcz, custom-message)
- **Dashboard**: Not directly used by dashboard (scheduler-driven)
- **Test**: Generate Discord summaries with proper formatting, webhook payload validation
- File: `src/api/discord-summary/handlers.test.ts`
- Commit: "test(api): add Discord Summary API integration test"

### ✅ Task 45: Commanders API Integration Test [DONE]

- **Flask**: `POST /api/sync/cmdrs?inara=true|false`
- **Dashboard**: Commander sync UI
- **Test**: Sync with Inara API, sync from events only, verify deduplication
- File: `src/api/commanders/handlers.test.ts`
- Commit: "test(api): add Commanders API integration test"

**Testing Pattern (Established in Task 37 - see [handlers.test.ts](src/api/activities/handlers.test.ts:1-843)):**

```ts
import { describe, it, expect } from "bun:test"
import { Context, Effect, Layer, Option } from "effect"
import { createClient } from "@libsql/client"
import { TursoClient } from "../../database/client.js"
import { XxxRepository } from "../../domain/repositories.js"
import { XxxRepositoryLive } from "../../database/repositories/XxxRepository.js"
import { AppConfig } from "../../lib/config.js"

const AppConfigTag = Context.GenericTag<AppConfig>("AppConfig")

describe("Xxx API Integration", () => {
  const testConfig = new AppConfig(/* full config with all fields */)

  const ClientLayer = Layer.effect(
    TursoClient,
    Effect.gen(function* () {
      const client = createClient({ url: "file::memory:" }) // NO intMode!
      yield* Effect.tryPromise(() => client.executeMultiple(`/* schema */`))
      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfigTag, testConfig)
  const TestLayer = XxxRepositoryLive.pipe(
    Layer.provide(ClientLayer),
    Layer.provide(TestConfigLayer)
  )
  const FullLayer = Layer.merge(TestLayer, ClientLayer).pipe(
    Layer.provide(TestConfigLayer)
  )

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, FullLayer))

  it("should test endpoint behavior", async () => {
    await runTest(Effect.gen(function* () {
      const repo = yield* XxxRepository
      const client = yield* TursoClient // Available via FullLayer
      // Test logic here
    }))
  })
})
```

**Key Learnings from Task 37:**

1. **Research Flask first**: Read `~/Documents/personal/VALKFlaskServer/routes/<name>.py` for exact behavior
2. **Check scheduler usage**: Read `fac_shoutout_scheduler.py` to see real query patterns
3. **Dashboard may not use all endpoints**: Some APIs are scheduler-only (verify in dashboard/src)
4. **Client config**: Use `createClient({ url: "file::memory:" })` - NO `intMode: "bigint"` (causes decode errors)
5. **Layer pattern**: `FullLayer` merges `TestLayer` + `ClientLayer` so tests can `yield* TursoClient`
6. **Test realistic data**: Mirror Flask's actual usage patterns, not just schema validation
7. **Use Option properly**: Fields are `Option.some(value)` not raw values in domain models

**Success Criteria:**

- All 11 API endpoint groups have integration tests
- Tests verify exact Flask behavior and dashboard usage patterns
- Tests run against in-memory database (fast, isolated)
- All tests pass consistently

---

## Phase 5: Background Schedulers ✅

All schedulers use TursoClient directly (no repository abstraction). Each is
`Effect<never, never, AppConfig | TursoClient>`, catches all errors internally,
and is forked via `Effect.forkDaemon` so failures never propagate to the server.
Guarded by `ENABLE_SCHEDULERS` env var.

**Commit:** `1206f95` — `feat(schedulers): add Phase 5 background schedulers`

### ✅ Task EDDN Client Fiber

- File: `src/schedulers/eddn-client.ts`
- ZMQ subscriber on `tcp://eddn.edcd.io:9500`; decompresses zlib frames; saves
  raw message + system/faction/conflict/powerplay rows; periodic cleanup of old
  messages. Retries every 5s on disconnect.
- Bug fixed: `eddn_faction` INSERT had 12 columns but 11 `?` placeholders
  (missing `updated_at`).

### ✅ Task Tick Monitor Fiber

- File: `src/schedulers/tick-monitor.ts`
- Polls Zoy's `http://tick.infomancer.uk/galtick.json` every 5 min (default).
  On new `lastGalaxyTick`: saves to `tick_state`, posts to BGS webhook.
  Seed last known tick from DB on startup to avoid duplicate notifications.

### ✅ Task Shoutout Scheduler Fiber

- File: `src/schedulers/shoutout-scheduler.ts`
- Schedule: daily at 20:00, 20:01, 20:02 UTC (based on `fac_shoutout_scheduler.py`)
- Period: "lt" (last tick) = `SELECT DISTINCT tickid FROM event ORDER BY timestamp DESC LIMIT 2`, use `rows[1]`
- Three sequential jobs:
  - 20:00 — BGS tick summary (influence, missions, CZs, market) → BGS webhook
  - 20:01 — Space CZ summary per system/type → conflict webhook
  - 20:02 — Ground CZ summary per system/settlement/type → shoutout webhook
- Mission influence JOIN corrected to TS schema: `mce.id = mci.mission_id`

### ✅ Task Conflict Scheduler Fiber

- File: `src/schedulers/conflict-scheduler.ts`
- Schedule: every 6 hours at 00:00, 06:00, 12:00, 18:00 UTC (based on `fac_conflict_scheduler.py` + `fac_in_conflict.py`)
- Reads current tick's `raw_json` from `event` table; parses `Conflicts[]` array
  from FSDJump/Location events; deduplicates by system (keeps latest timestamp,
  accumulates CMDRs); posts to BGS webhook. No-op if no active conflicts.

### ✅ Task Inara Sync Scheduler Fiber

- File: `src/schedulers/inara-sync.ts`
- Schedule: daily at 01:00 UTC (based on `cmdr_sync_inara.py`)
- Raw SQL against `cmdr` table (no CmdrRepository); 60s sleep between each CMDR;
  aborts batch on `InaraRateLimitError`; converts numeric ranks to strings before
  storing (cmdr table stores ranks as TEXT).

### ✅ Task Compose Schedulers

- File: `src/schedulers/index.ts`
- `Layer.effectDiscard` that forks all 5 fibers; exits early if
  `config.schedulers.enabled` is false.
- Wired into `src/main.ts` as `SchedulerLayer` alongside `ServerLayer`:
  `Layer.launch(Layer.mergeAll(ServerLayer, SchedulerLayer))`

---

## Phase 6: Server Composition

### ✅ Task Main Server [DONE]

- File: `src/main.ts`
- Server + schedulers wired together via `Layer.mergeAll(ServerLayer, SchedulerLayer)`

### Task Static Dashboard Serving

- File: `src/main.ts` or `src/api/static.ts`
- Serve React SPA from ../dashboard/dist
- Commit: "feat: add dashboard serving"

### Task Environment Config

- File: `.env.example`
- Document all required env vars
- Commit: "docs: add env example"

---

## Phase 7: Testing & Verification

### Task Integration Tests

- Files: `src/api/*/handlers.test.ts`
- Test: Full API flows with in-memory DB
- Commit: "test: add integration tests"

### Task Data Migration Script

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

### Task Full Verification

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
- [x] All schedulers running
- [ ] Dashboard loads
- [ ] EDDN client connects
- [ ] Discord webhooks work
- [ ] Inara sync works
- [ ] Data migration successful
- [ ] Performance ≥ Flask
