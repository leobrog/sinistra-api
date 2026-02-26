import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { ColonyRepository } from "../../domain/repositories.ts"
import { ColonyRepositoryLive } from "./ColonyRepository.ts"
import { PgClient } from "../client.ts"

import { ColonyId } from "../../domain/ids.ts"
import { Colony } from "../../domain/models.ts"

// Helper to provide a fresh Test Layer for each test
const ClientLayer = Layer.effect(
  PgClient,
  Effect.gen(function* () {
    const client = new SQL("postgres://postgres:password@localhost:5432/sinistra");
    return PgClient.of(client);
  })
)

const TestLayer = ColonyRepositoryLive.pipe(
    Layer.provide(ClientLayer)
)

describe("ColonyRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, ColonyRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer))

  it("should create and retrieve a colony by ID", async () => {
    const colony = {
      id: ColonyId.make("colony_1"),
      cmdr: Option.some("CMDR Test"),
      starsystem: Option.some("Sol"),
      ravenurl: Option.some("https://example.com/raven"),
      priority: 5,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ColonyRepository

        // Create
        yield* repo.create(colony)

        // Find by ID
        const result = yield* repo.findById(colony.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.id).toBe(colony.id)
            expect(Option.getOrNull(result.value.cmdr)).toBe("CMDR Test")
            expect(Option.getOrNull(result.value.starsystem)).toBe("Sol")
            expect(result.value.priority).toBe(5)
        }
      })
    )
  })

  it("should retrieve all colonies", async () => {
    const colony1 = {
      id: ColonyId.make("colony_all_1"),
      cmdr: Option.some("CMDR Alpha"),
      starsystem: Option.some("System A"),
      ravenurl: Option.none(),
      priority: 10,
    }

    const colony2 = {
      id: ColonyId.make("colony_all_2"),
      cmdr: Option.some("CMDR Beta"),
      starsystem: Option.some("System B"),
      ravenurl: Option.none(),
      priority: 3,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ColonyRepository
        yield* repo.create(colony1)
        yield* repo.create(colony2)

        const result: Colony[] = yield* repo.findAll()
        expect((result as any).length).toBeGreaterThanOrEqual(2)
        // Should be ordered by priority DESC
        const ids = result.map(c => c.id as string)
        expect(ids).toContain("colony_all_1")
        expect(ids).toContain("colony_all_2")
      })
    )
  })

  it("should find colonies by commander", async () => {
    const colony1 = {
      id: ColonyId.make("colony_cmdr_1"),
      cmdr: Option.some("CMDR Specific"),
      starsystem: Option.some("System X"),
      ravenurl: Option.none(),
      priority: 7,
    }

    const colony2 = {
      id: ColonyId.make("colony_cmdr_2"),
      cmdr: Option.some("CMDR Specific"),
      starsystem: Option.some("System Y"),
      ravenurl: Option.none(),
      priority: 4,
    }

    const colony3 = {
      id: ColonyId.make("colony_cmdr_3"),
      cmdr: Option.some("CMDR Other"),
      starsystem: Option.some("System Z"),
      ravenurl: Option.none(),
      priority: 8,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ColonyRepository
        yield* repo.create(colony1)
        yield* repo.create(colony2)
        yield* repo.create(colony3)

        const result: Colony[] = yield* repo.findByCmdr("CMDR Specific")
        expect((result as any).length).toBe(2)
        const ids = result.map(c => c.id as string)
        expect(ids).toContain("colony_cmdr_1")
        expect(ids).toContain("colony_cmdr_2")
        expect(ids).not.toContain("colony_cmdr_3")
      })
    )
  })

  it("should find colonies by system", async () => {
    const colony1 = {
      id: ColonyId.make("colony_sys_1"),
      cmdr: Option.some("CMDR A"),
      starsystem: Option.some("Common System"),
      ravenurl: Option.none(),
      priority: 5,
    }

    const colony2 = {
      id: ColonyId.make("colony_sys_2"),
      cmdr: Option.some("CMDR B"),
      starsystem: Option.some("Common System"),
      ravenurl: Option.none(),
      priority: 6,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ColonyRepository
        yield* repo.create(colony1)
        yield* repo.create(colony2)

        const result: Colony[] = yield* repo.findBySystem("Common System")
        expect((result as any).length).toBe(2)
        const ids = result.map(c => c.id as string)
        expect(ids).toContain("colony_sys_1")
        expect(ids).toContain("colony_sys_2")
      })
    )
  })

  it("should find priority colonies", async () => {
    const colony1 = {
      id: ColonyId.make("colony_pri_1"),
      cmdr: Option.some("CMDR Priority"),
      starsystem: Option.some("Important System"),
      ravenurl: Option.none(),
      priority: 10,
    }

    const colony2 = {
      id: ColonyId.make("colony_pri_2"),
      cmdr: Option.some("CMDR NoPriority"),
      starsystem: Option.some("Unimportant System"),
      ravenurl: Option.none(),
      priority: 0,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ColonyRepository
        yield* repo.create(colony1)
        yield* repo.create(colony2)

        const result: Colony[] = yield* repo.findPriority()
        const ids = result.map(c => c.id as string)
        expect(ids).toContain("colony_pri_1")
        expect(ids).not.toContain("colony_pri_2") // priority 0 should be excluded
      })
    )
  })

  it("should update a colony", async () => {
    const colony = {
      id: ColonyId.make("colony_update"),
      cmdr: Option.some("CMDR Original"),
      starsystem: Option.some("Original System"),
      ravenurl: Option.none(),
      priority: 3,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ColonyRepository
        yield* repo.create(colony)

        const updatedColony = {
            ...colony,
            cmdr: Option.some("CMDR Updated"),
            priority: 9,
        }

        yield* repo.update(updatedColony)

        const result = yield* repo.findById(colony.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(Option.getOrNull(result.value.cmdr)).toBe("CMDR Updated")
            expect(result.value.priority).toBe(9)
        }
      })
    )
  })

  it("should delete a colony", async () => {
    const colony = {
      id: ColonyId.make("colony_del"),
      cmdr: Option.some("CMDR ToDelete"),
      starsystem: Option.some("Delete System"),
      ravenurl: Option.none(),
      priority: 1,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ColonyRepository
        yield* repo.create(colony)

        // Verify exists
        let result = yield* repo.findById(colony.id)
        expect(Option.isSome(result)).toBe(true)

        // Delete
        yield* repo.delete(colony.id)

        // Verify gone
        result = yield* repo.findById(colony.id)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  it("should return None for non-existent colony", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* ColonyRepository
        const result = yield* repo.findById(ColonyId.make("ghost"))
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })
})
