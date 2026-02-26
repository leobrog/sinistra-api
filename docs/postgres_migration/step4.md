# Step 4: Testing Strategy

This document details the code changes required in the `*.test.ts` files for **Step 4** of the PostgreSQL migration plan. Moving to PostgreSQL means we can no longer rely on SQLite's unique, per-connection, in-memory database feature (`:memory:`).

## 1. Database Client in Tests

Currently, the test setup uses `@libsql/client` with `url: "file::memory:"`. We need to provide a real PostgreSQL test database URL.

**Change across all `src/database/repositories/*.test.ts`:**

*Old:*
```typescript
const TestPgClientLive = Layer.succeed(
    TursoClient,
    createClient({
        url: "file::memory:",
    })
);
```

*New:*
```typescript
import { SQL } from "bun";

const TestPgClientLive = Layer.succeed(
    PgClient,
    new SQL("postgres://postgres:password@localhost:5432/sinistra_test")
);
```
*(Make sure to replace `TursoClient` with `PgClient` and update imports accordingly).*

## 2. Managing Test State and Isolation

Because we are now using a persistent database for testing, we must ensure test isolation so that database records from one test do not affect others. 

You have two primary options:

### Option A: Truncate Tables Before/After Tests
Run a `TRUNCATE TABLE` command in an `afterEach` or `beforeEach` hook to clear all data. This is simple but can be slightly slower.

```typescript
import { afterEach } from "bun:test";

afterEach(async () => {
    // You must truncate all tables involved in the test suite
    // CASCADE ensures foreign key constraints don't block the truncation
    await client`TRUNCATE TABLE cmdr, event, activity CASCADE`;
});
```

### Option B: Transaction Rollbacks
Wrap tests in a transaction and roll back at the end of each test. This is faster and generally safer for concurrent test execution.

```typescript
// Example using Bun.sql transactions
test("creates a new commander", async () => {
    await client.begin(async (tx) => {
        // Run your repository logic using the `tx` instance
        // ...
        
        // Throw or manually rollback to prevent commit
        tx.rollback();
    });
});
```
*Note: Depending on how the repository gets its client instance in your Effect context, option A (Truncation) might be far easier to implement without significant dependency injection refactoring.*

## 3. Test Database Preparation

Before running `bun test`, the `sinistra_test` database must exist and have the latest schema applied to it. 

You should update your `package.json` test script or create a new `test:setup` script that runs the migrations against the test database:

```json
"scripts": {
  "test:setup": "DATABASE_URL=postgres://postgres:password@localhost:5432/sinistra_test bun src/database/migrate.ts",
  "test": "bun test"
}
```
*(You may need to create the database manually via `psql` or a setup script if it doesn't exist).*
