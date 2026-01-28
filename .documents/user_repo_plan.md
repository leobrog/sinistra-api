# User Repository Implementation Plan (Turso)

## Objective

Implement a robust `UserRepository` using Turso (LibSQL) as the database backend, integrating fully with the project's Effect ecosystem.

## Prerequisites

- [ ] Install `@libsql/client` for Turso connectivity.
- [ ] Ensure `bun` is used for package management.

## 1. Install Dependencies

```bash
bun add @libsql/client
```

## 2. Database Client Configuration

Create `src/database/client.ts` to manage the Turso connection.

- **Service Tag**: Define `TursoClient` using `Context.Tag`.
- **Layer**: Create a `TursoClientLive` layer that reads configuration (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) using `Effect.Config` and initializes the client.
- **Resource Management**: Ensure the client is closed properly (though LibSQL client is HTTP/stateless usually, it's good practice to wrap in `Effect.acquireRelease` if using a connectionful mode).

## 3. Define Repository Interface

Create `src/domain/repositories.ts`.

- **Service Tag**: Define `UserRepository` using `Context.Tag`.
- **Interface**:
  - `create(user: User): Effect.Effect<void, DatabaseError>`
  - `findById(id: UserId): Effect.Effect<Option.Option<User>, DatabaseError>`
  - `findByEmail(email: Email): Effect.Effect<Option.Option<User>, DatabaseError>`
  - `update(user: User): Effect.Effect<void, DatabaseError | UserNotFoundError>`
  - `delete(id: UserId): Effect.Effect<void, DatabaseError>`

## 4. Implement Repository

Create `src/database/repositories/UserRepository.ts`.

- **Implementation**: Create `UserRepositoryLive` layer that depends on `TursoClient`.
- **Mapping**: Use `Schema.decodeUnknown` (or `decodeUnknownOption`) to safely transform SQL results into domain `User` objects.
- **Error Handling**: Catch exceptions and wrap them in `DatabaseError`.

## 5. SQL Schema

The `users` table will be required. A utility script or SQL command will be needed to set this up.

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  company TEXT,
  plan_tier TEXT NOT NULL DEFAULT 'free',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

## 6. Integration

- Export the live layer in `src/database/index.ts` (if applicable) or prepare it for composition in `src/main.ts`.

## 7. Testing

- Create a test file `src/database/repositories/UserRepository.test.ts` to verify functionality using `bun test`.
