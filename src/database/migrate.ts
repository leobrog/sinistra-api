import { Effect } from "effect"
import { PgClient, PgClientLive } from "./client.ts"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const runMigrations = Effect.gen(function* () {
  const client = yield* PgClient
  console.log("🚀 Starting database migrations...")

  // 1. Create the migrations tracking table
  yield* Effect.tryPromise(() =>
    client`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `
  )

  // 2. Get list of applied migrations
  const existingMigrationsResult = yield* Effect.tryPromise(() =>
    client`SELECT name FROM _migrations`
  )
  const appliedMigrationNames = new Set(
    existingMigrationsResult.rows.map((row) => row.name as string)
  )

  // 3. Read migration files from disk
  const migrationsDir = path.join(process.cwd(), "migrations")
  const files = yield* Effect.tryPromise(() => fs.readdir(migrationsDir))
  const migrationFiles = files.filter((f) => f.endsWith(".sql")).sort()

  // 4. Apply new migrations
  for (const file of migrationFiles) {
    if (appliedMigrationNames.has(file)) {
      continue
    }

    console.log(`Applying migration: ${file}`)
    const filePath = path.join(migrationsDir, file)
    const sql = yield* Effect.tryPromise(() => fs.readFile(filePath, "utf-8"))

    // Execute the migration
    // Note: LibSQL/Turso supports multiple statements in one execute call if using the HTTP client?
    // Often it requires splitting or using a transaction method. 
    // For simplicity with the standard client, we'll try executeMultiple if available or split by semicolon.
    // The standard @libsql/client 'execute' allows multiple statements for some drivers, but let's be safe.
    
    // Simple split strategy for this script (robust parsers are better for complex SQL)
    const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    for (const statement of statements) {
        yield* Effect.tryPromise(() => client(statement))
    }

    // Record the migration
    yield* Effect.tryPromise(() =>
      client`INSERT INTO _migrations (name, applied_at) VALUES (${file}, ${Date.now()})`
    )
    console.log(`✅ Applied: ${file}`)
  }

  console.log("✨ All migrations applied successfully.")
})

// Run the effect
const program = runMigrations.pipe(
  Effect.provide(PgClientLive),
  Effect.catchAll((error) => {
    console.error("❌ Migration failed:", error)
    return Effect.fail(error)
  })
)

Effect.runPromise(program).catch(() => process.exit(1))
