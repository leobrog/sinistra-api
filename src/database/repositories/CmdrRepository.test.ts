import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { CmdrRepository } from "../../domain/repositories.ts"
import { CmdrRepositoryLive } from "./CmdrRepository.ts"
import { TursoClient } from "../client.ts"
import { createClient } from "@libsql/client"
import { CmdrId } from "../../domain/ids.ts"

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
        CREATE TABLE IF NOT EXISTS cmdr (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          rank_combat TEXT,
          rank_trade TEXT,
          rank_explore TEXT,
          rank_cqc TEXT,
          rank_empire TEXT,
          rank_federation TEXT,
          rank_power TEXT,
          credits INTEGER,
          assets INTEGER,
          inara_url TEXT,
          squadron_name TEXT,
          squadron_rank TEXT
        );
      `)
    )

    return client
  })
)

const TestLayer = CmdrRepositoryLive.pipe(
    Layer.provide(ClientLayer)
)

describe("CmdrRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, CmdrRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer))

  it("should create and retrieve a commander by ID", async () => {
    const cmdr = {
      id: CmdrId.make("cmdr_1"),
      name: "CMDR Test",
      rankCombat: Option.some("Elite"),
      rankTrade: Option.some("Tycoon"),
      rankExplore: Option.some("Pioneer"),
      rankCqc: Option.none(),
      rankEmpire: Option.none(),
      rankFederation: Option.none(),
      rankPower: Option.none(),
      credits: Option.some(1000000),
      assets: Option.some(5000000),
      inaraUrl: Option.some("https://inara.cz/cmdr/123"),
      squadronName: Option.some("Test Squadron"),
      squadronRank: Option.some("Captain"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* CmdrRepository

        // Create
        yield* repo.create(cmdr)

        // Find by ID
        const result = yield* repo.findById(cmdr.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.id).toBe(cmdr.id)
            expect(result.value.name).toBe(cmdr.name)
            expect(Option.getOrNull(result.value.rankCombat)).toBe("Elite")
        }
      })
    )
  })

  it("should retrieve a commander by name", async () => {
    const cmdr = {
      id: CmdrId.make("cmdr_2"),
      name: "CMDR FindMe",
      rankCombat: Option.none(),
      rankTrade: Option.none(),
      rankExplore: Option.none(),
      rankCqc: Option.none(),
      rankEmpire: Option.none(),
      rankFederation: Option.none(),
      rankPower: Option.none(),
      credits: Option.none(),
      assets: Option.none(),
      inaraUrl: Option.none(),
      squadronName: Option.none(),
      squadronRank: Option.none(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* CmdrRepository
        yield* repo.create(cmdr)

        const result = yield* repo.findByName("CMDR FindMe")
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.id).toBe(cmdr.id)
            expect(result.value.name).toBe("CMDR FindMe")
        }
      })
    )
  })

  it("should retrieve all commanders", async () => {
    const cmdr1 = {
      id: CmdrId.make("cmdr_all_1"),
      name: "Alpha Commander",
      rankCombat: Option.none(),
      rankTrade: Option.none(),
      rankExplore: Option.none(),
      rankCqc: Option.none(),
      rankEmpire: Option.none(),
      rankFederation: Option.none(),
      rankPower: Option.none(),
      credits: Option.none(),
      assets: Option.none(),
      inaraUrl: Option.none(),
      squadronName: Option.none(),
      squadronRank: Option.none(),
    }

    const cmdr2 = {
      id: CmdrId.make("cmdr_all_2"),
      name: "Beta Commander",
      rankCombat: Option.none(),
      rankTrade: Option.none(),
      rankExplore: Option.none(),
      rankCqc: Option.none(),
      rankEmpire: Option.none(),
      rankFederation: Option.none(),
      rankPower: Option.none(),
      credits: Option.none(),
      assets: Option.none(),
      inaraUrl: Option.none(),
      squadronName: Option.none(),
      squadronRank: Option.none(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* CmdrRepository
        yield* repo.create(cmdr1)
        yield* repo.create(cmdr2)

        const result = yield* repo.findAll()
        expect(result.length).toBeGreaterThanOrEqual(2)
        const names = result.map(c => c.name)
        expect(names).toContain("Alpha Commander")
        expect(names).toContain("Beta Commander")
      })
    )
  })

  it("should update a commander", async () => {
    const cmdr = {
      id: CmdrId.make("cmdr_update"),
      name: "CMDR Original",
      rankCombat: Option.some("Competent"),
      rankTrade: Option.none(),
      rankExplore: Option.none(),
      rankCqc: Option.none(),
      rankEmpire: Option.none(),
      rankFederation: Option.none(),
      rankPower: Option.none(),
      credits: Option.some(100),
      assets: Option.none(),
      inaraUrl: Option.none(),
      squadronName: Option.none(),
      squadronRank: Option.none(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* CmdrRepository
        yield* repo.create(cmdr)

        const updatedCmdr = {
            ...cmdr,
            name: "CMDR Updated",
            rankCombat: Option.some("Elite"),
            credits: Option.some(999999),
        }

        yield* repo.update(updatedCmdr)

        const result = yield* repo.findById(cmdr.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.name).toBe("CMDR Updated")
            expect(Option.getOrNull(result.value.rankCombat)).toBe("Elite")
            expect(Option.getOrNull(result.value.credits)).toBe(999999)
        }
      })
    )
  })

  it("should delete a commander", async () => {
    const cmdr = {
      id: CmdrId.make("cmdr_del"),
      name: "CMDR ToDelete",
      rankCombat: Option.none(),
      rankTrade: Option.none(),
      rankExplore: Option.none(),
      rankCqc: Option.none(),
      rankEmpire: Option.none(),
      rankFederation: Option.none(),
      rankPower: Option.none(),
      credits: Option.none(),
      assets: Option.none(),
      inaraUrl: Option.none(),
      squadronName: Option.none(),
      squadronRank: Option.none(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* CmdrRepository

        yield* repo.create(cmdr)

        // Verify exists
        let result = yield* repo.findById(cmdr.id)
        expect(Option.isSome(result)).toBe(true)

        // Delete
        yield* repo.delete(cmdr.id)

        // Verify gone
        result = yield* repo.findById(cmdr.id)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  it("should return None for non-existent commander", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* CmdrRepository
        const result = yield* repo.findById(CmdrId.make("ghost"))
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  it("should handle large integer values correctly", async () => {
    const cmdr = {
      id: CmdrId.make("cmdr_bigint"),
      name: "CMDR BigInt",
      rankCombat: Option.none(),
      rankTrade: Option.none(),
      rankExplore: Option.none(),
      rankCqc: Option.none(),
      rankEmpire: Option.none(),
      rankFederation: Option.none(),
      rankPower: Option.none(),
      credits: Option.some(9007199254740991), // Number.MAX_SAFE_INTEGER
      assets: Option.some(1000000000000),
      inaraUrl: Option.none(),
      squadronName: Option.none(),
      squadronRank: Option.none(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* CmdrRepository
        yield* repo.create(cmdr)

        const result = yield* repo.findById(cmdr.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(Option.getOrNull(result.value.credits)).toBe(9007199254740991)
            expect(Option.getOrNull(result.value.assets)).toBe(1000000000000)
        }
      })
    )
  })
})
