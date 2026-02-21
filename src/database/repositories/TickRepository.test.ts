import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { TickRepository } from "../../domain/repositories.ts"
import { TickRepositoryLive } from "./TickRepository.ts"
import { TursoClient } from "../client.ts"
import { createClient } from "@libsql/client"
import { TickId } from "../../domain/ids.ts"

// Helper to provide a fresh Test Layer for each test
const ClientLayer = Layer.effect(
  TursoClient,
  Effect.gen(function* () {
    const client = createClient({
      url: "file::memory:",
    })

    // Initialize Schema
    yield* Effect.tryPromise(() =>
      client.executeMultiple(`
        CREATE TABLE IF NOT EXISTS tick_state (
          id TEXT PRIMARY KEY,
          tickid TEXT NOT NULL UNIQUE,
          ticktime TEXT NOT NULL,
          last_updated TEXT NOT NULL
        );
      `)
    )

    return client
  })
)

const TestLayer = TickRepositoryLive.pipe(
    Layer.provide(ClientLayer)
)

describe("TickRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, TickRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer))

  it("should upsert and retrieve a tick state by ID", async () => {
    const tick = {
      id: TickId.make("tick_1"),
      tickid: "12345",
      ticktime: "2024-01-15T10:00:00Z",
      lastUpdated: new Date("2024-01-15T10:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* TickRepository

        // Upsert
        yield* repo.upsert(tick)

        // Find by ID
        const result = yield* repo.findById(tick.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.id).toBe(tick.id)
            expect(result.value.tickid).toBe("12345")
            expect(result.value.ticktime).toBe("2024-01-15T10:00:00Z")
        }
      })
    )
  })

  it("should update existing tick on conflict", async () => {
    const tick1 = {
      id: TickId.make("tick_conflict_1"),
      tickid: "conflict_tick",
      ticktime: "2024-01-15T10:00:00Z",
      lastUpdated: new Date("2024-01-15T10:00:00Z"),
    }

    const tick2 = {
      id: TickId.make("tick_conflict_2"), // Different ID
      tickid: "conflict_tick", // Same tickid (UNIQUE constraint)
      ticktime: "2024-01-15T11:00:00Z", // Updated time
      lastUpdated: new Date("2024-01-15T11:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* TickRepository

        // First upsert
        yield* repo.upsert(tick1)

        // Second upsert with same tickid should update
        yield* repo.upsert(tick2)

        // Should have the updated data, not create a duplicate
        const result = yield* repo.findById(tick1.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.tickid).toBe("conflict_tick")
            // Should have updated ticktime
            expect(result.value.ticktime).toBe("2024-01-15T11:00:00Z")
        }
      })
    )
  })

  it("should get the current tick state (most recent)", async () => {
    const tick1 = {
      id: TickId.make("tick_current_1"),
      tickid: "old_tick",
      ticktime: "2024-01-14T10:00:00Z",
      lastUpdated: new Date("2024-01-14T10:00:00Z"),
    }

    const tick2 = {
      id: TickId.make("tick_current_2"),
      tickid: "recent_tick",
      ticktime: "2024-01-15T10:00:00Z",
      lastUpdated: new Date("2024-01-15T10:00:00Z"),
    }

    const tick3 = {
      id: TickId.make("tick_current_3"),
      tickid: "newest_tick",
      ticktime: "2024-01-16T10:00:00Z",
      lastUpdated: new Date("2024-01-16T10:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* TickRepository

        yield* repo.upsert(tick1)
        yield* repo.upsert(tick2)
        yield* repo.upsert(tick3)

        const result = yield* repo.getCurrent()
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            // Should get the newest tick
            expect(result.value.tickid).toBe("newest_tick")
        }
      })
    )
  })

  it("should return None for non-existent tick", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* TickRepository
        const result = yield* repo.findById(TickId.make("ghost"))
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  it("should return None for getCurrent when no ticks exist", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* TickRepository
        const result = yield* repo.getCurrent()
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  it("should handle Date serialization correctly", async () => {
    const now = new Date()
    const tick = {
      id: TickId.make("tick_date"),
      tickid: "date_test",
      ticktime: "2024-01-15T10:00:00Z",
      lastUpdated: now,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* TickRepository
        yield* repo.upsert(tick)

        const result = yield* repo.findById(tick.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            // Dates should be properly serialized/deserialized
            expect(result.value.lastUpdated).toBeInstanceOf(Date)
            // Should match within a second (accounting for serialization)
            expect(Math.abs(result.value.lastUpdated.getTime() - now.getTime())).toBeLessThan(1000)
        }
      })
    )
  })
})
