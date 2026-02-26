# PostgreSQL Migration Plan

This document outlines the detailed steps required to migrate the Sinistra API from Turso (SQLite) to PostgreSQL, leveraging `Bun.sql` as requested.

## 1. Database Client & Configuration
- **Remove Turso**: Uninstall `@libsql/client`.
- **Update Client Layer**: Modify `src/database/client.ts` to use `import { SQL } from "bun"`. 
- **Context Tag**: Rename `TursoClient` to `PgClient` and provide the `Bun.sql` instance.
- **Remove Pragmas**: Remove `PRAGMA busy_timeout = 3000` which is SQLite specific.
- **Docker Compose**: Add a PostgreSQL container to `docker-compose.yml` for local development and testing.

## 2. Schema Migrations (`migrations/*.sql`)
PostgreSQL enforces stricter typing than SQLite. The following schema adjustments are required across the 15 migration files:
- **64-bit Integers (`BIGINT`)**: SQLite's `INTEGER` holds up to 64-bit numbers automatically. In PostgreSQL, `INTEGER` is 32-bit. We must update columns expecting large numbers to `BIGINT`:
  - `systemaddress` (Event tables)
  - `credits`, `assets` (Commander table)
  - `population` (EDDN system info)
  - `reward`, `fine`, `value`, `earnings`, `total_earnings`, `bounty` (Activity/Event financial values)
- **JSON Fields (`JSONB`)**: Fields storing JSON (currently `TEXT`) should be changed to `JSONB` to enable powerful querying:
  - `raw_json` (Event table)
  - `recovering_states`, `active_states`, `pending_states` (EDDN faction)
  - `power` (EDDN powerplay)
- **Booleans**: Currently mapped as `INTEGER DEFAULT 1`. While valid in Postgres, converting them to `BOOLEAN DEFAULT TRUE` is more idiomatic. (e.g., `protected` in `protected_factions`, `is_admin`, `active` in `flask_users`).

## 3. Repository Query Updates (`src/database/repositories/*.ts`)
- **Query Execution**: Refactor `client.execute({ sql: string, args: [] })` to use `Bun.sql` tagged template literals (e.g., \`sql\`SELECT * FROM users WHERE id = \${id}\`\`). This is safer and native to Bun.
- **Case-Insensitive Matches**: Replace `COLLATE NOCASE` with the `ILIKE` operator or `LOWER()` function.
  - *Example (`EddnRepository.ts`)*: `system_name = ? COLLATE NOCASE` -> `system_name ILIKE \${systemName}`
- **JSON Functions**: Replace SQLite JSON functions with PostgreSQL JSON operators.
  - *Example (`EddnRepository.ts`)*: `json_extract(power, '$[0]')` -> `power->>0` (assuming `power` is JSONB).
- **Conflict Handling**: The existing `ON CONFLICT(id) DO UPDATE SET...` syntax is mostly valid in Postgres. However, Postgres requires explicit matching against a unique constraint or primary key. All our `ON CONFLICT` clauses target primary keys or unique columns (like `tickid`), which will translate perfectly.

## 4. Testing Strategy (`*.test.ts`)
- **Loss of `:memory:` Database**: SQLite allows spinning up a fresh in-memory database per test suite via `file::memory:`. PostgreSQL does not.
- **New Test ClientLayer**: The test `ClientLayer` must be updated to connect to a real PostgreSQL instance (e.g., `postgres://postgres:postgres@localhost:5432/test_db`).
- **State Isolation**: To ensure test isolation, implement a teardown step that truncates all tables after each test suite, or wrap tests in database transactions that are rolled back.

## 5. Execution Steps
1. Update `docker-compose.yml` to include a PostgreSQL 16+ service.
2. Update `.env.example` with `DATABASE_URL=postgres://...`.
3. Rewrite `client.ts` and `migrate.ts` to utilize `Bun.sql`.
4. Perform find-and-replace across `migrations/*.sql` to update data types (`BIGINT`, `JSONB`).
5. Iterate through each `*Repository.ts` file, refactoring `client.execute` to `Bun.sql` queries and adjusting `COLLATE NOCASE`/`json_extract`.
6. Update the `ClientLayer` in all `*Repository.test.ts` files to point to the test PostgreSQL instance and implement table truncation.