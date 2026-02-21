# Code Review — Flask → Effect-TS Migration

**Date:** 2026-02-21
**Scope:** Complete review of the Bun + Effect-TS + Turso migration (all phases complete, 214 tests passing)

---

## Summary

The migration is architecturally sound. The Effect-TS patterns are applied correctly throughout — branded IDs, `Schema.TaggedError`, `Context.Tag` services, and `HttpApiBuilder` groups all follow the established conventions. The domain layer is clean and the repository abstraction is well-defined.

There are two bugs that silently return wrong data, one security issue, and several code-quality findings worth addressing before production traffic switches over.

---

## Critical Bugs

### 1. Wrong JOIN in all influence queries

**Files:** `src/api/summary/handlers.ts:63–66`, `src/api/objectives/handlers.ts:113`

The `mission_completed_influence` table has a FK `mission_id` that references `mission_completed_event(id)` (see `migrations/0004_create_events.sql:72`). Both the Summary API and the Objectives progress-calculation handler join on the wrong column:

```sql
-- WRONG (current)
JOIN mission_completed_event mce ON mce.event_id = mci.mission_id
JOIN event e ON e.id = mce.event_id

-- CORRECT
JOIN mission_completed_event mce ON mce.id = mci.mission_id
JOIN event e ON e.id = mce.event_id
```

`mce.event_id` is the UUID of the parent `event` row. `mci.mission_id` is the UUID of the `mission_completed_event` row. These two UUIDs never match, so every influence query returns an empty result set.

For comparison, the shoutout scheduler (`src/schedulers/shoutout-scheduler.ts:79`) has this join correct.

**Affected queries:**
- `summary/handlers.ts` — `influence-by-faction` and `influence-eic` key queries
- `objectives/handlers.ts` — `inf` target type in `computeTargetProgress`

---

### 2. SQL injection via string interpolation in Summary API

**File:** `src/api/summary/handlers.ts:137–158`

`buildDateFilterSql` and `buildDateFilterSqlSub` concatenate values directly into SQL strings:

```ts
// Line 139
return `e.tickid = '${filter.tickId}'`;

// Line 142
return `e.timestamp BETWEEN '${filter.startDate}' AND '${filter.endDate}'`;
```

`startDate` and `endDate` are fed directly from HTTP query parameters (`queryParams.start_date`, `queryParams.end_date` at lines 178–185), meaning a request like `?start_date=2025-01-01' OR '1'='1` can manipulate the query. `tickId` comes from a DB read so the risk there is lower, but the pattern is still wrong.

The fix is to move these values into the parameterized `args` array and use `?` placeholders in the SQL, the same way `system_name` is handled at lines 202–205.

---

## Security

### 3. `valk_user` cookie missing `Secure` flag

**File:** `src/api/auth/oauth-callback.ts:105`

```ts
const cookieHeader = `valk_user=${cookieValue}; Path=/; Max-Age=604800; SameSite=Lax`
```

The cookie is missing `Secure`, meaning it will be transmitted over plain HTTP in development and, if misconfigured, in production. Since this cookie carries the auth state used by the dashboard, it should include `Secure` for any HTTPS-only deployment.

The cookie is intentionally not `HttpOnly` (the dashboard reads it via JS), but that design choice should be documented with a comment.

---

## Code Quality

### 4. Duplicated handler bodies in Objectives API

**File:** `src/api/objectives/handlers.ts`

`createObjective`/`createObjectiveAlt`, `updateObjective`/`updateObjectiveAlt`, and `deleteObjective`/`deleteObjectiveAlt` each have a completely duplicated implementation body. The GET handlers correctly share logic via `buildGetObjectivesEffect`, but the others do not. The `Alt` variants exist only to serve a second URL path — they should call a shared helper function, identical to how `getObjectives` and `getObjectivesAlt` both call `buildGetObjectivesEffect`.

### 5. `any` types in `computeTargetProgress`

**File:** `src/api/objectives/handlers.ts:52–54, 166, 194`

```ts
client: any,           // should be: Client from @libsql/client
const rows: any[] = result.rows
const enrichedObjectives: any[] = []
const enrichedTargets: any[] = []
```

These widen the types away from what Effect and LibSQL provide. `client` should be typed as `Client`, and the enriched arrays could be typed as the DTO output shape used in the response.

### 6. Fragile `LIMIT 5` injection in `BASE_QUERIES`

**File:** `src/api/summary/handlers.ts:122–132`

```ts
"market-events": QUERIES["market-events"].replace("DESC", "DESC LIMIT 5"),
// ...
"influence-by-faction": QUERIES["influence-by-faction"].replace("e.cmdr", "e.cmdr LIMIT 5"),
```

Two different replacement strategies are used because `DESC` appears in the wrong position for the influence queries. This is fragile — any future change to a query string could silently break the limit. Defining the base queries with `LIMIT 5` directly, or using a wrapper like `SELECT * FROM (...) LIMIT 5`, is safer.

### 7. Stale SaaS template artifacts in domain

**Files:** `src/domain/ids.ts:7–8`, `src/domain/errors.ts:58–63`, `src/domain/models.ts:41–65`

`RateId`, `RateNotFoundError`, `User.planTier`, `User.company`, and the entire `PlanTier` schema are unused in Sinistra's single-tenant domain. They appear to be leftover from the project template. They don't cause runtime errors but they inflate the domain and could mislead contributors. Consider moving them to a separate `src/domain/saas/` namespace or removing them.

### 8. `ApiKeyRepository.find()` returns `Option<ApiKey>` not `Option<UserApiKey>`

**File:** `src/domain/repositories.ts:85`

```ts
find(apiKey: ApiKey): Effect.Effect<Option.Option<ApiKey>, DatabaseError>
```

The method returns the raw API key string it was passed, not the associated `UserApiKey` record. This makes it impossible to retrieve the `userId` or `name` of the caller for audit logging. Changing the return type to `Option.Option<UserApiKey>` would enable proper attribution.

### 9. `MissionCompletedInfluence` model field vs DB column mismatch

**Files:** `src/domain/models.ts:127`, `migrations/0004_create_events.sql:64`

The model field is:
```ts
systemAddress: Schema.optionalWith(Schema.Number, { as: "Option" }),
```

The DB column is:
```sql
system TEXT
```

The column is named `system` (a text system name, not an address integer). The model field name `systemAddress` and its `Schema.Number` type don't match the actual column. The `MissionCompletedInfluence` repository's `mapRow` helper should be checked; any attempt to decode this column as a Number will fail silently.

### 10. TOCTOU in username collision handling

**Files:** `src/api/auth/oauth-callback.ts:67–70`, `src/api/auth/handlers.ts:53–56`

```ts
const usernameExists = yield* flaskUserRepo.findByUsername(sanitizedUsername)
const finalUsername = Option.isSome(usernameExists)
  ? `${sanitizedUsername}_${Math.floor(Math.random() * 9000 + 1000)}`
  : sanitizedUsername
```

There's a check-then-act race: two simultaneous new-user registrations with the same Discord username could both pass `findByUsername`, both pick the same `finalUsername`, and one will fail the `create` call with a unique constraint violation. In a single-tenant app with low concurrent registrations this is unlikely, but the error is unhandled and will surface as a 500. Wrapping the `create` call with a retry-on-conflict would be sufficient.

---

## Minor Notes

- `src/database/client.ts` reads `TURSO_AUTH_TOKEN` via `Config.string` with no fallback. For local development with a file URL this will throw unless the variable is set. A `Config.withDefault(Config.string("TURSO_AUTH_TOKEN"), "")` or a conditional check would improve the dev experience.

- `src/services/date-filters.ts` exports `dateFilterToSqlConditions` but it returns a single `{field, operator, value}` object that callers can't easily turn into a `BETWEEN` clause (the value is an array for date ranges). None of the handlers use it — they call `buildDateFilterSql` in `summary/handlers.ts` instead. The export can be removed.

- `src/schedulers/eddn-client.ts` uses `inflateSync` from `node:zlib`. Bun ships with `node:zlib` compatibility, so this works, but `Bun.gunzipSync` is the native equivalent.

---

## What's Working Well

- **Branded IDs throughout** — mixing up an `ActivityId` and an `ObjectiveId` is a compile error, not a runtime bug.
- **All errors are typed** — the `Effect` channel accurately reflects every failure mode; callers can't silently swallow an `ObjectiveNotFoundError`.
- **Test coverage** — 214 tests across 26 files with in-memory SQLite give fast, reliable CI. The integration tests mirror Flask's actual request/response shapes.
- **Scheduler isolation** — all five background fibers are `forkDaemon`-ed, so a scheduler panic can't take down the HTTP server.
- **OAuth flow** — moving the Discord callback out of `HttpApiBuilder` into a raw `HttpApp` middleware to return a proper `302 + Set-Cookie` was the right call; the alternative would have required exposing the cookie-writing logic through the JSON response layer.
