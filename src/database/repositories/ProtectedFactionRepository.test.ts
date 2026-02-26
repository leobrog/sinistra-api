import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { ProtectedFactionRepository } from "../../domain/repositories.ts"
import { ProtectedFactionRepositoryLive } from "./ProtectedFactionRepository.ts"
import { PgClient } from "../client.ts"

import { ProtectedFactionId } from "../../domain/ids.ts"
import { ProtectedFaction } from "../../domain/models.ts"

// Helper to provide a fresh Test Layer for each test
const ClientLayer = Layer.effect(
  PgClient,
  Effect.gen(function* () {
    const client = new SQL("postgres://postgres:password@localhost:5432/sinistra");
    return PgClient.of(client);
  })
)

const TestLayer = ProtectedFactionRepositoryLive.pipe(
    Layer.provide(ClientLayer)
)

describe("ProtectedFactionRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, ProtectedFactionRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer))

  it("should create and retrieve a protected faction by ID", async () => {
    const faction = {
      id: ProtectedFactionId.make("faction_1"),
      name: "Test Faction",
      webhookUrl: Option.some("https://discord.com/webhook/123"),
      description: Option.some("A test faction"),
      protected: true,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ProtectedFactionRepository

        // Create
        yield* repo.create(faction)

        // Find by ID
        const result = yield* repo.findById(faction.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.id).toBe(faction.id)
            expect(result.value.name).toBe("Test Faction")
            expect(result.value.protected).toBe(true)
        }
      })
    )
  })

  it("should retrieve a protected faction by name", async () => {
    const faction = {
      id: ProtectedFactionId.make("faction_2"),
      name: "Find By Name Faction",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: false,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ProtectedFactionRepository
        yield* repo.create(faction)

        const result = yield* repo.findByName("Find By Name Faction")
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.id).toBe(faction.id)
            expect(result.value.protected).toBe(false)
        }
      })
    )
  })

  it("should retrieve all protected factions", async () => {
    const faction1 = {
      id: ProtectedFactionId.make("faction_all_1"),
      name: "Alpha Faction",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: true,
    }

    const faction2 = {
      id: ProtectedFactionId.make("faction_all_2"),
      name: "Beta Faction",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: false,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ProtectedFactionRepository
        yield* repo.create(faction1)
        yield* repo.create(faction2)

        const result = yield* repo.findAll()
        expect((result as any).length).toBeGreaterThanOrEqual(2)
        const names = result.map(f => f.name)
        expect(names).toContain("Alpha Faction")
        expect(names).toContain("Beta Faction")
      })
    )
  })

  it("should retrieve only protected factions", async () => {
    const faction1 = {
      id: ProtectedFactionId.make("faction_prot_1"),
      name: "Protected Faction 1",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: true,
    }

    const faction2 = {
      id: ProtectedFactionId.make("faction_prot_2"),
      name: "Protected Faction 2",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: true,
    }

    const faction3 = {
      id: ProtectedFactionId.make("faction_unprot"),
      name: "Unprotected Faction",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: false,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ProtectedFactionRepository
        yield* repo.create(faction1)
        yield* repo.create(faction2)
        yield* repo.create(faction3)

        const result: ProtectedFaction[] = yield* repo.findProtected()
        const ids = result.map(f => f.id as string)
        expect(ids).toContain("faction_prot_1")
        expect(ids).toContain("faction_prot_2")
        expect(ids).not.toContain("faction_unprot")
      })
    )
  })

  it("should update a protected faction", async () => {
    const faction = {
      id: ProtectedFactionId.make("faction_update"),
      name: "Original Name",
      webhookUrl: Option.none(),
      description: Option.some("Original description"),
      protected: false,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ProtectedFactionRepository
        yield* repo.create(faction)

        const updatedFaction = {
            ...faction,
            name: "Updated Name",
            webhookUrl: Option.some("https://new-webhook.com"),
            protected: true,
        }

        yield* repo.update(updatedFaction)

        const result = yield* repo.findById(faction.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.name).toBe("Updated Name")
            expect(Option.getOrNull(result.value.webhookUrl)).toBe("https://new-webhook.com")
            expect(result.value.protected).toBe(true)
        }
      })
    )
  })

  it("should delete a protected faction", async () => {
    const faction = {
      id: ProtectedFactionId.make("faction_del"),
      name: "To Delete Faction",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: true,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ProtectedFactionRepository
        yield* repo.create(faction)

        // Verify exists
        let result = yield* repo.findById(faction.id)
        expect(Option.isSome(result)).toBe(true)

        // Delete
        yield* repo.delete(faction.id)

        // Verify gone
        result = yield* repo.findById(faction.id)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  it("should return None for non-existent faction", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* ProtectedFactionRepository
        const result = yield* repo.findById(ProtectedFactionId.make("ghost"))
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  it("should handle boolean protected field correctly", async () => {
    const faction1 = {
      id: ProtectedFactionId.make("faction_bool_true"),
      name: "Boolean True Faction",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: true,
    }

    const faction2 = {
      id: ProtectedFactionId.make("faction_bool_false"),
      name: "Boolean False Faction",
      webhookUrl: Option.none(),
      description: Option.none(),
      protected: false,
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ProtectedFactionRepository
        yield* repo.create(faction1)
        yield* repo.create(faction2)

        const result1 = yield* repo.findById(faction1.id)
        expect(Option.isSome(result1)).toBe(true)
        if (Option.isSome(result1)) {
            expect(result1.value.protected).toBe(true)
        }

        const result2 = yield* repo.findById(faction2.id)
        expect(Option.isSome(result2)).toBe(true)
        if (Option.isSome(result2)) {
            expect(result2.value.protected).toBe(false)
        }
      })
    )
  })
})
