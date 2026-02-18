import { describe, it, expect } from "bun:test"
import { Context, Effect, Layer, Option } from "effect"
import { createClient } from "@libsql/client"
import { TursoClient } from "../../database/client.js"
import { ColonyRepository } from "../../domain/repositories.js"
import { ColonyRepositoryLive } from "../../database/repositories/ColonyRepository.js"
import { AppConfig } from "../../lib/config.js"
import { Colony } from "../../domain/models.js"
import { ColonyId } from "../../domain/ids.js"
import { v4 as uuid } from "uuid"

// Create the same Tag as used in the config layer
const AppConfigTag = Context.GenericTag<AppConfig>("AppConfig")

describe("Colonies API Integration", () => {
  const testConfig = new AppConfig(
    {
      url: "file::memory:",
      eddnUrl: "file::memory:",
    },
    {
      port: 3000,
      host: "localhost",
      nodeEnv: "test",
      name: "Sinistra Test Server",
      description: "Test server for Sinistra API",
      url: "http://localhost:3000",
      apiVersion: "2.0.0",
      apiKey: "test-api-key",
      frontendUrl: "http://localhost:5000",
    },
    {
      name: "Test Faction",
    },
    {
      secret: "test-jwt-secret",
      expiresIn: "7d",
    },
    {
      oauth: {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      },
      bot: {
        token: "test-bot-token",
        serverId: "test-server-id",
      },
      webhooks: {
        bgs: Option.none(),
        shoutout: Option.none(),
        conflict: Option.none(),
        debug: Option.none(),
      },
    },
    {
      apiKey: "test-inara-key",
      appName: "Test",
      apiUrl: "https://inara.cz/inapi/v1/",
    },
    {
      zmqUrl: "tcp://localhost:9500",
      cleanupIntervalMs: 3600000,
      messageRetentionMs: 86400000,
    },
    {
      pollIntervalMs: 300000,
      apiUrl: "https://elitebgs.app/api/ebgs/v5/ticks",
    },
    {
      enabled: false,
    }
  )

  // Helper to create a fresh test database for each test
  const ClientLayer = Layer.effect(
    TursoClient,
    Effect.gen(function* () {
      const client = createClient({
        url: "file::memory:",
      })

      // Initialize schema
      yield* Effect.tryPromise(() =>
        client.executeMultiple(`
          CREATE TABLE IF NOT EXISTS colony (
            id TEXT PRIMARY KEY,
            cmdr TEXT,
            starsystem TEXT,
            ravenurl TEXT,
            priority INTEGER NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_colony_cmdr ON colony(cmdr);
          CREATE INDEX IF NOT EXISTS idx_colony_starsystem ON colony(starsystem);
          CREATE INDEX IF NOT EXISTS idx_colony_priority ON colony(priority);
        `)
      )

      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfigTag, testConfig)

  const TestLayer = ColonyRepositoryLive.pipe(
    Layer.provide(ClientLayer),
    Layer.provide(TestConfigLayer)
  )

  const FullLayer = Layer.merge(TestLayer, ClientLayer).pipe(
    Layer.provide(TestConfigLayer)
  )

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, FullLayer))

  /**
   * Test 1: POST /api/colonies - Create colony
   * Simulates dashboard adding a new colony to track
   */
  it("should create a new colony", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        const colonyId = uuid() as ColonyId
        const colony = new Colony({
          id: colonyId,
          cmdr: Option.some("CMDR Explorer"),
          starsystem: Option.some("Sol"),
          ravenurl: Option.some("https://raven.example.com/colony/123"),
          priority: 1,
        })

        yield* colonyRepo.create(colony)

        // Verify creation
        const saved = yield* colonyRepo.findById(colonyId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedColony = saved.value
          expect(Option.getOrNull(savedColony.cmdr)).toBe("CMDR Explorer")
          expect(Option.getOrNull(savedColony.starsystem)).toBe("Sol")
          expect(Option.getOrNull(savedColony.ravenurl)).toBe("https://raven.example.com/colony/123")
          expect(savedColony.priority).toBe(1)
        }
      })
    )
  })

  /**
   * Test 2: GET /api/colonies - Get all colonies
   * Simulates dashboard loading all tracked colonies
   */
  it("should get all colonies", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        // Create multiple colonies
        const colonies = [
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Alpha"),
            starsystem: Option.some("Sol"),
            ravenurl: Option.none(),
            priority: 1,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Beta"),
            starsystem: Option.some("Achenar"),
            ravenurl: Option.none(),
            priority: 2,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Gamma"),
            starsystem: Option.some("Deciat"),
            ravenurl: Option.none(),
            priority: 0,
          }),
        ]

        for (const colony of colonies) {
          yield* colonyRepo.create(colony)
        }

        // Get all colonies
        const allColonies = yield* colonyRepo.findAll()
        expect(allColonies.length).toBe(3)
      })
    )
  })

  /**
   * Test 3: GET /api/colonies/:id - Get colony by ID
   * Simulates viewing specific colony details
   */
  it("should get colony by ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        const colonyId = uuid() as ColonyId
        const colony = new Colony({
          id: colonyId,
          cmdr: Option.some("CMDR Finder"),
          starsystem: Option.some("Wolf 359"),
          ravenurl: Option.some("https://raven.example.com/wolf359"),
          priority: 3,
        })

        yield* colonyRepo.create(colony)

        // Find by ID
        const found = yield* colonyRepo.findById(colonyId)
        expect(Option.isSome(found)).toBe(true)

        if (Option.isSome(found)) {
          expect(found.value.id).toBe(colonyId)
          expect(Option.getOrNull(found.value.cmdr)).toBe("CMDR Finder")
          expect(Option.getOrNull(found.value.starsystem)).toBe("Wolf 359")
        }
      })
    )
  })

  /**
   * Test 4: PUT /api/colonies/:id - Update colony
   * Simulates editing colony information
   */
  it("should update colony", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        const colonyId = uuid() as ColonyId
        const original = new Colony({
          id: colonyId,
          cmdr: Option.some("CMDR Original"),
          starsystem: Option.some("Original System"),
          ravenurl: Option.none(),
          priority: 1,
        })

        yield* colonyRepo.create(original)

        // Update colony
        const updated = new Colony({
          id: colonyId,
          cmdr: Option.some("CMDR Updated"),
          starsystem: Option.some("Updated System"),
          ravenurl: Option.some("https://raven.example.com/updated"),
          priority: 5,
        })

        yield* colonyRepo.update(updated)

        // Verify update
        const saved = yield* colonyRepo.findById(colonyId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedColony = saved.value
          expect(Option.getOrNull(savedColony.cmdr)).toBe("CMDR Updated")
          expect(Option.getOrNull(savedColony.starsystem)).toBe("Updated System")
          expect(Option.getOrNull(savedColony.ravenurl)).toBe("https://raven.example.com/updated")
          expect(savedColony.priority).toBe(5)
        }
      })
    )
  })

  /**
   * Test 5: DELETE /api/colonies/:id - Delete colony
   * Simulates removing a colony from tracking
   */
  it("should delete colony", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        const colonyId = uuid() as ColonyId
        const colony = new Colony({
          id: colonyId,
          cmdr: Option.some("CMDR ToDelete"),
          starsystem: Option.some("Delete System"),
          ravenurl: Option.none(),
          priority: 0,
        })

        yield* colonyRepo.create(colony)

        // Verify created
        const created = yield* colonyRepo.findById(colonyId)
        expect(Option.isSome(created)).toBe(true)

        // Delete colony
        yield* colonyRepo.delete(colonyId)

        // Verify deleted
        const deleted = yield* colonyRepo.findById(colonyId)
        expect(Option.isNone(deleted)).toBe(true)
      })
    )
  })

  /**
   * Test 6: GET /api/colonies/search?cmdr=X - Search by commander
   * Simulates filtering colonies by commander name
   */
  it("should search colonies by commander", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        // Create colonies for different commanders
        const colonies = [
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Alpha"),
            starsystem: Option.some("Sol"),
            ravenurl: Option.none(),
            priority: 1,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Alpha"),
            starsystem: Option.some("Achenar"),
            ravenurl: Option.none(),
            priority: 1,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Beta"),
            starsystem: Option.some("Deciat"),
            ravenurl: Option.none(),
            priority: 2,
          }),
        ]

        for (const colony of colonies) {
          yield* colonyRepo.create(colony)
        }

        // Search by commander
        const alphaColonies = yield* colonyRepo.findByCmdr("CMDR Alpha")
        expect(alphaColonies.length).toBe(2)
        expect(alphaColonies.every((c) => Option.getOrNull(c.cmdr) === "CMDR Alpha")).toBe(true)

        const betaColonies = yield* colonyRepo.findByCmdr("CMDR Beta")
        expect(betaColonies.length).toBe(1)
        expect(Option.getOrNull(betaColonies[0]!.cmdr)).toBe("CMDR Beta")
      })
    )
  })

  /**
   * Test 7: GET /api/colonies/search?starsystem=X - Search by system
   * Simulates filtering colonies by star system
   */
  it("should search colonies by star system", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        // Create colonies in different systems
        const colonies = [
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Alpha"),
            starsystem: Option.some("Sol"),
            ravenurl: Option.none(),
            priority: 1,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Beta"),
            starsystem: Option.some("Sol"),
            ravenurl: Option.none(),
            priority: 2,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Gamma"),
            starsystem: Option.some("Achenar"),
            ravenurl: Option.none(),
            priority: 3,
          }),
        ]

        for (const colony of colonies) {
          yield* colonyRepo.create(colony)
        }

        // Search by system
        const solColonies = yield* colonyRepo.findBySystem("Sol")
        expect(solColonies.length).toBe(2)
        expect(solColonies.every((c) => Option.getOrNull(c.starsystem) === "Sol")).toBe(true)

        const achenarColonies = yield* colonyRepo.findBySystem("Achenar")
        expect(achenarColonies.length).toBe(1)
        expect(Option.getOrNull(achenarColonies[0]!.starsystem)).toBe("Achenar")
      })
    )
  })

  /**
   * Test 8: GET /api/colonies/priority - Get priority colonies ordered
   * Simulates dashboard showing high-priority colonies first
   */
  it("should get priority colonies ordered by priority descending", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        // Create colonies with different priorities
        const colonies = [
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Low"),
            starsystem: Option.some("System Low"),
            ravenurl: Option.none(),
            priority: 1,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR High"),
            starsystem: Option.some("System High"),
            ravenurl: Option.none(),
            priority: 10,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Zero"),
            starsystem: Option.some("System Zero"),
            ravenurl: Option.none(),
            priority: 0,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR Med"),
            starsystem: Option.some("System Med"),
            ravenurl: Option.none(),
            priority: 5,
          }),
        ]

        for (const colony of colonies) {
          yield* colonyRepo.create(colony)
        }

        // Get priority colonies (only returns priority > 0)
        const priorityColonies = yield* colonyRepo.findPriority()
        expect(priorityColonies.length).toBe(3)

        // Verify ordering (highest priority first, excludes 0)
        expect(priorityColonies[0]!.priority).toBe(10)
        expect(priorityColonies[1]!.priority).toBe(5)
        expect(priorityColonies[2]!.priority).toBe(1)
      })
    )
  })

  /**
   * Test 9: POST /api/colonies/:id/priority - Set colony priority
   * Simulates changing priority level of a colony
   */
  it("should set colony priority", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        const colonyId = uuid() as ColonyId
        const colony = new Colony({
          id: colonyId,
          cmdr: Option.some("CMDR Priority"),
          starsystem: Option.some("Priority System"),
          ravenurl: Option.none(),
          priority: 1,
        })

        yield* colonyRepo.create(colony)

        // Update priority
        const updated = new Colony({
          ...colony,
          priority: 8,
        })

        yield* colonyRepo.update(updated)

        // Verify priority changed
        const saved = yield* colonyRepo.findById(colonyId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          expect(saved.value.priority).toBe(8)
        }
      })
    )
  })

  /**
   * Test 10: Colony with minimal fields (no cmdr, no ravenurl)
   * Verifies optional fields can be omitted
   */
  it("should create colony with minimal required fields", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        const colonyId = uuid() as ColonyId
        const colony = new Colony({
          id: colonyId,
          cmdr: Option.none(),
          starsystem: Option.some("Minimal System"),
          ravenurl: Option.none(),
          priority: 0,
        })

        yield* colonyRepo.create(colony)

        const saved = yield* colonyRepo.findById(colonyId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedColony = saved.value
          expect(Option.isNone(savedColony.cmdr)).toBe(true)
          expect(Option.getOrNull(savedColony.starsystem)).toBe("Minimal System")
          expect(Option.isNone(savedColony.ravenurl)).toBe(true)
          expect(savedColony.priority).toBe(0)
        }
      })
    )
  })

  /**
   * Test 11: Search returns empty when no matches
   * Verifies graceful handling of empty search results
   */
  it("should return empty array when no colonies match search", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        // Create a colony
        const colony = new Colony({
          id: uuid() as ColonyId,
          cmdr: Option.some("CMDR Exists"),
          starsystem: Option.some("Existing System"),
          ravenurl: Option.none(),
          priority: 1,
        })

        yield* colonyRepo.create(colony)

        // Search for non-existent commander
        const notFoundCmdr = yield* colonyRepo.findByCmdr("CMDR NonExistent")
        expect(notFoundCmdr.length).toBe(0)

        // Search for non-existent system
        const notFoundSystem = yield* colonyRepo.findBySystem("NonExistent System")
        expect(notFoundSystem.length).toBe(0)
      })
    )
  })

  /**
   * Test 12: Get by ID returns none for non-existent colony
   * Verifies proper Option.none() return for missing colonies
   */
  it("should return Option.none() for non-existent colony ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        const nonExistentId = uuid() as ColonyId
        const result = yield* colonyRepo.findById(nonExistentId)

        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  /**
   * Test 13: Multiple colonies with same priority
   * Verifies handling of equal priority values
   */
  it("should handle multiple colonies with same priority", async () => {
    await runTest(
      Effect.gen(function* () {
        const colonyRepo = yield* ColonyRepository

        const colonies = [
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR 1"),
            starsystem: Option.some("System 1"),
            ravenurl: Option.none(),
            priority: 5,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR 2"),
            starsystem: Option.some("System 2"),
            ravenurl: Option.none(),
            priority: 5,
          }),
          new Colony({
            id: uuid() as ColonyId,
            cmdr: Option.some("CMDR 3"),
            starsystem: Option.some("System 3"),
            ravenurl: Option.none(),
            priority: 5,
          }),
        ]

        for (const colony of colonies) {
          yield* colonyRepo.create(colony)
        }

        const priorityColonies = yield* colonyRepo.findPriority()
        expect(priorityColonies.length).toBe(3)
        expect(priorityColonies.every((c) => c.priority === 5)).toBe(true)
      })
    )
  })
})
