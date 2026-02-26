# Step 1: Database Client & Configuration

This document details the exact code changes and terminal commands required to complete **Step 1** of the PostgreSQL migration plan.

## 1. Remove Turso Dependency

Run the following command to remove the SQLite client dependency and update `package.json` and `bun.lock`:

```bash
bun remove @libsql/client
```

## 2. Update the Database Client Layer (`src/database/client.ts`)

Replace the entirety of `src/database/client.ts` with the new PostgreSQL client implementation. 

**Changes made:**
- Removed `@libsql/client` imports.
- Imported `SQL` from `"bun"`.
- Renamed `TursoClient` and `TursoClientLive` to `PgClient` and `PgClientLive`.
- Removed the SQLite `PRAGMA busy_timeout` execution.
- Switched configuration from `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to `DATABASE_URL`.

**New `src/database/client.ts`:**

```typescript
import { SQL } from "bun";
import { Config, Context, Effect, Layer } from "effect";

export class PgClient extends Context.Tag("PgClient")<
    PgClient,
    SQL
>() {}

export const PgClientLive = Layer.effect(
    PgClient,
    Effect.gen(function* () {
        const url = yield* Config.string("DATABASE_URL");
        const client = new SQL(url);

        return PgClient.of(client);
    })
);
```

## 3. Update Environment Variables (`.env.example`)

Add the PostgreSQL connection string variable. You should also update your local `.env` file accordingly.

**Add to `.env.example`:**

```env
# PostgreSQL Database URL
DATABASE_URL=postgres://postgres:password@localhost:5432/sinistra
```

## 4. Update Docker Configuration (`docker-compose.yml`)

Add a new `postgres` service for local development and testing, and ensure it shares the `sinistra_network`.

**Changes to `docker-compose.yml`:**

```yaml
services:
  # ... existing services ...

  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: sinistra
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - sinistra_network

# ... existing networks ...

# Add volumes at the bottom of the file
volumes:
  pgdata:
```

*Note: You may also want to add `depends_on: postgres` to the `backend` service definition in `docker-compose.yml` to ensure the database starts first.*
