# Step 3: Repository Query Updates

This document details the code changes required in `src/database/repositories/*.ts` for **Step 3** of the PostgreSQL migration plan. We must refactor all repositories to use `Bun.sql` instead of the `@libsql/client` `execute` method, as well as update SQLite-specific syntax.

## 1. Query Execution (`Bun.sql`)

All repository files currently perform database operations using `client.execute({ sql: string, args: [] })`. Since `PgClient` provides a `Bun.sql` instance, this must be refactored to use tagged template literals. 

**Example Change (any Repository):**

*Old:*
```typescript
yield* Effect.tryPromise({
  try: () => client.execute({
    sql: "SELECT * FROM cmdr WHERE name = ?",
    args: [name]
  }),
  catch: (e) => new DatabaseError({ message: `Failed: ${e}` })
});
```

*New:*
```typescript
yield* Effect.tryPromise({
  try: () => client`SELECT * FROM cmdr WHERE name = ${name}`,
  catch: (e) => new DatabaseError({ message: `Failed: ${e}` })
});
```
*Note: Make sure to check the return types of `Bun.sql`. It returns an array of rows by default instead of an object with a `.rows` array like `@libsql/client` does.*

## 2. Case-Insensitive Matches (`ILIKE`)

SQLite uses `COLLATE NOCASE` to achieve case-insensitive string matching. In PostgreSQL, we should use the `ILIKE` operator. You will find many occurrences of this in `src/database/repositories/EddnRepository.ts`.

**Example Change (`EddnRepository.ts`):**

*Old:*
```typescript
client.execute({
  sql: "SELECT * FROM eddn_system_info WHERE system_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1",
  args: [systemName]
})
```

*New:*
```typescript
client`SELECT * FROM eddn_system_info WHERE system_name ILIKE ${systemName} ORDER BY updated_at DESC LIMIT 1`
```

## 3. JSON Functions

SQLite JSON function calls must be replaced with PostgreSQL's JSONB operators. Specifically, `json_extract` needs to be updated.

**Example Change (`EddnRepository.ts`):**

*Old:*
```typescript
client.execute({
  sql: "SELECT DISTINCT system_name FROM eddn_powerplay WHERE json_extract(power, '$[0]') = ? COLLATE NOCASE OR power LIKE ?",
  args: [power, `%${power}%`]
})
```

*New:*
```typescript
client`SELECT DISTINCT system_name FROM eddn_powerplay WHERE power->>0 ILIKE ${power} OR power::text ILIKE ${`%${power}%`}`
```

## 4. Conflict Handling (`ON CONFLICT`)

The SQLite `ON CONFLICT(id) DO UPDATE SET...` syntax is mostly compatible with PostgreSQL. However, PostgreSQL requires that the `ON CONFLICT` target column(s) have a unique constraint or primary key index. Since our schema properly defines primary keys (e.g., `id`) and unique columns (e.g., `tickid`), the existing `ON CONFLICT` statements should work without modification when ported to the tagged template literal syntax.
