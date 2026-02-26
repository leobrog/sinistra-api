# Step 5: Execution Overview

This document serves as a high-level checklist for executing the PostgreSQL migration plan from start to finish. Once you have made the code changes described in Steps 1 through 4, use this guide to apply the changes and verify the migration.

## Migration Checklist

### 1. Environment Setup
- [ ] Add the `postgres` service and `pgdata` volume to `docker-compose.yml` (from Step 1).
- [ ] Update your local `.env` and `.env.example` with the new `DATABASE_URL` (from Step 1).
- [ ] Run `docker compose up -d postgres` to start the local database.
- [ ] Ensure you have a test database created (e.g., `CREATE DATABASE sinistra_test;` via `psql`) if following the testing strategy in Step 4.

### 2. Dependency Updates
- [ ] Run `bun remove @libsql/client` to drop Turso/SQLite (from Step 1).
- [ ] Ensure `@types/bun` and `bun` are up to date for native `Bun.sql` support.

### 3. Apply Code Modifications
- [ ] **Client Layer:** Rewrite `src/database/client.ts` to use `PgClient` and `Bun.sql` (from Step 1).
- [ ] **Migrations:** Update the `migrations/*.sql` files for `BIGINT`, `JSONB`, and `BOOLEAN` types (from Step 2).
- [ ] **Repositories:** Refactor all instances of `client.execute()` to `client\`...\`` tagged template literals in `src/database/repositories/*.ts` (from Step 3).
- [ ] **SQL Syntax:** Fix `COLLATE NOCASE` and `json_extract` usages in your queries (from Step 3).
- [ ] **Tests:** Update all `*.test.ts` files to use the `sinistra_test` database and implement table truncation or transactions to ensure test isolation (from Step 4).
- [ ] **Migrate Script:** Verify that `src/database/migrate.ts` is updated to utilize `Bun.sql` instead of `@libsql/client`. *(You will need to rewrite the execution of the `.sql` files using `client\`...\`` or `client.run(...)` based on the Bun documentation).*

### 4. Run Migrations
Execute your updated migration script to build the schema in the local PostgreSQL database:

```bash
bun run migrate
```
*Check for any SQL syntax errors. If errors occur, adjust your `migrations/*.sql` files accordingly.*

### 5. Validate & Test
Run the test suite to ensure the repositories interact with PostgreSQL correctly:

```bash
# If you created a setup script in Step 4
bun run test:setup
bun test
```
*If tests fail due to state bleed, double-check your `TRUNCATE` or transaction rollback logic in the test hooks.*

### 6. Start the API
Start the development server and manually verify key endpoints (like authentication, event creation, and data retrieval):

```bash
bun run dev
```
