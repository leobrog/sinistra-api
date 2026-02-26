# PostgreSQL Migration Status

**Current Branch:** `postgres-migration`
**Last Updated:** February 26, 2026

## What has been completed:

### 1. Database Client & Configuration (Step 1 - DONE)
- Removed Turso / `@libsql/client` dependency.
- Completely rewrote `src/database/client.ts` to use `Bun.sql` and expose a `PgClient` Effect tag.
- Updated environment variables in `.env` and `.env.example` to `DATABASE_URL` formatted for Postgres.
- Added a `postgres:16` service to `docker-compose.yml` along with a local `pgdata` volume.

### 2. Schema Migrations (Step 2 - DONE)
- Updated all SQLite `INTEGER` columns storing IDs, timestamps, or large financial values (e.g., `credits`, `assets`, `systemaddress`, `reward`, `fine`) to `BIGINT` in `migrations/*.sql`.
- Updated all SQLite `TEXT` columns representing JSON data (e.g., `raw_json`, `recovering_states`, `power`) to `JSONB`.
- Updated SQLite boolean implementations (`INTEGER DEFAULT 1`) to native Postgres `BOOLEAN` in `flask_users` and `protected_factions`.

### 3. Repository Query Updates (Step 3 - WIP / MOSTLY DONE)
- Mass-refactored `src/database/repositories/*.ts`, `src/api/**/*.ts`, `src/schedulers/**/*.ts`, and `src/services/**/*.ts` to replace `TursoClient` with `PgClient`.
- Converted SQLite's `client.execute({ sql: "...", args: [...] })` syntax to native Bun `client\`SELECT ...\`` tagged template literals.
- Replaced `COLLATE NOCASE` with `ILIKE` for case-insensitive matches across queries.
- Replaced SQLite's `json_extract(...)` functions with Postgres's `->>` JSONB operator (specifically in `EddnRepository`).
- Adjusted `result.rows` to just `result` and `result.rowsAffected` to `result.length` (or similar appropriate checks based on `bun:sql` returning arrays).
- **Status:** The logic is fully migrated, but there are ~42 remaining strict TypeScript compiler errors (`bun run tsc --noEmit`) primarily relating to:
  - Missing or incorrect type casts where the `client\`` response (which returns an array) needs to be correctly cast or mapped.
  - A few dynamic SQL string calls using `client.unsafe(...)` instead of tagged templates.
  - Test files having leftover `@libsql/client` imports or `createClient` calls.

## Where to resume:

**Begin by fixing the remaining TypeScript errors from Step 3.**
Run `bun run tsc --noEmit` to see the list. 

Most errors involve:
1. `(result as any[]).map(...)` typing mismatches or dynamic SQL template substitutions.
2. `Effect.tryPromise` catch blocks needing proper typing or async closures.
3. Test files in `src/api/**/*.test.ts` and `src/database/repositories/*.test.ts` needing their `ClientLayer` updated to use `new SQL(...)` instead of `createClient(...)`.

**After TypeScript compilation is completely clean (exit code 0), move on to Step 4: Testing Strategy.**
This will involve implementing table truncation for isolation across tests and ensuring the `test:setup` script properly runs the Postgres migrations on a separate `sinistra_test` database.
