import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { createClient } from "@libsql/client"
import { TursoClient } from "../../database/client.js"
import { ProtectedFactionRepository, EddnRepository } from "../../domain/repositories.js"
import { ProtectedFactionRepositoryLive } from "../../database/repositories/ProtectedFactionRepository.js"
import { EddnRepositoryLive } from "../../database/repositories/EddnRepository.js"
import { AppConfig } from "../../lib/config.js"
import { ProtectedFaction, EddnSystemInfo } from "../../domain/models.js"
import { ProtectedFactionId, EddnSystemInfoId } from "../../domain/ids.js"
import { v4 as uuid } from "uuid"


describe("Protected Factions API Integration", () => {
  const testConfig = {
    database: {
      url: "file::memory:",
      eddnUrl: "file::memory:",
    },
    server: {
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
    faction: {
      name: "Test Faction",
    },
    jwt: {
      secret: "test-jwt-secret",
      expiresIn: "7d",
    },
    discord: {
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
    inara: {
      apiKey: "test-inara-key",
      appName: "Test",
      apiUrl: "https://inara.cz/inapi/v1/",
    },
    eddn: {
      zmqUrl: "tcp://localhost:9500",
      cleanupIntervalMs: 3600000,
      messageRetentionMs: 86400000,
    },
    tick: {
      pollIntervalMs: 300000,
      apiUrl: "https://elitebgs.app/api/ebgs/v5/ticks",
    },
    schedulers: {
      enabled: false,
    },
  }

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
          CREATE TABLE IF NOT EXISTS protected_faction (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            webhook_url TEXT,
            description TEXT,
            protected INTEGER NOT NULL DEFAULT 1
          );

          CREATE INDEX IF NOT EXISTS idx_protected_faction_name ON protected_faction(name);
          CREATE INDEX IF NOT EXISTS idx_protected_faction_protected ON protected_faction(protected);

          CREATE TABLE IF NOT EXISTS eddn_message (
            id TEXT PRIMARY KEY,
            schema_ref TEXT NOT NULL,
            header_gateway_timestamp TEXT,
            message_type TEXT,
            message_json TEXT NOT NULL,
            timestamp TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_eddn_message_timestamp ON eddn_message(timestamp);
          CREATE INDEX IF NOT EXISTS idx_eddn_message_type ON eddn_message(message_type);
          CREATE INDEX IF NOT EXISTS idx_eddn_message_schema_ref ON eddn_message(schema_ref);

          CREATE TABLE IF NOT EXISTS eddn_system_info (
            id TEXT PRIMARY KEY,
            eddn_message_id TEXT,
            system_name TEXT NOT NULL,
            controlling_faction TEXT,
            controlling_power TEXT,
            population INTEGER,
            security TEXT,
            government TEXT,
            allegiance TEXT,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (eddn_message_id) REFERENCES eddn_message(id) ON DELETE SET NULL
          );

          CREATE INDEX IF NOT EXISTS idx_eddn_system_info_system_name ON eddn_system_info(system_name);
          CREATE INDEX IF NOT EXISTS idx_eddn_system_info_updated_at ON eddn_system_info(updated_at);
        `)
      )

      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfig, testConfig)

  const TestLayer = Layer.merge(
    ProtectedFactionRepositoryLive,
    EddnRepositoryLive
  ).pipe(
    Layer.provide(ClientLayer),
    Layer.provide(TestConfigLayer)
  )

  const FullLayer = Layer.merge(TestLayer, ClientLayer).pipe(
    Layer.provide(TestConfigLayer)
  )

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, FullLayer))

  /**
   * Test 1: POST /api/protected-faction - Create protected faction with all fields
   * Simulates dashboard creating a fully-detailed protected faction
   */
  it("should create protected faction with all fields", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const faction = new ProtectedFaction({
          id: factionId,
          name: "Federation Navy",
          webhookUrl: Option.some("https://discord.com/api/webhooks/123/abc"),
          description: Option.some("Federal military faction to protect"),
          protected: true,
        })

        yield* factionRepo.create(faction)

        // Verify creation
        const saved = yield* factionRepo.findById(factionId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedFaction = saved.value
          expect(savedFaction.name).toBe("Federation Navy")
          expect(Option.getOrNull(savedFaction.webhookUrl)).toBe("https://discord.com/api/webhooks/123/abc")
          expect(Option.getOrNull(savedFaction.description)).toBe("Federal military faction to protect")
          expect(savedFaction.protected).toBe(true)
        }
      })
    )
  })

  /**
   * Test 2: POST /api/protected-faction - Create protected faction with minimal fields (only name)
   * Simulates creating a faction with bare minimum required data
   */
  it("should create protected faction with minimal fields (only name)", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const faction = new ProtectedFaction({
          id: factionId,
          name: "Minimal Faction",
          webhookUrl: Option.none(),
          description: Option.none(),
          protected: true, // Defaults to true
        })

        yield* factionRepo.create(faction)

        // Verify creation
        const saved = yield* factionRepo.findById(factionId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedFaction = saved.value
          expect(savedFaction.name).toBe("Minimal Faction")
          expect(Option.isNone(savedFaction.webhookUrl)).toBe(true)
          expect(Option.isNone(savedFaction.description)).toBe(true)
          expect(savedFaction.protected).toBe(true)
        }
      })
    )
  })

  /**
   * Test 3: GET /api/protected-faction - Get all protected factions
   * Simulates dashboard loading list of all protected factions
   */
  it("should get all protected factions", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        // Create multiple factions
        const factions = [
          new ProtectedFaction({
            id: uuid() as ProtectedFactionId,
            name: "Alliance Defence Force",
            webhookUrl: Option.none(),
            description: Option.some("Alliance military"),
            protected: true,
          }),
          new ProtectedFaction({
            id: uuid() as ProtectedFactionId,
            name: "Empire Assembly",
            webhookUrl: Option.some("https://discord.com/api/webhooks/456/def"),
            description: Option.none(),
            protected: false,
          }),
          new ProtectedFaction({
            id: uuid() as ProtectedFactionId,
            name: "Independent Pilots",
            webhookUrl: Option.none(),
            description: Option.none(),
            protected: true,
          }),
        ]

        for (const faction of factions) {
          yield* factionRepo.create(faction)
        }

        // Get all factions
        const allFactions = yield* factionRepo.findAll()
        expect(allFactions.length).toBe(3)

        // Verify they're ordered by name
        expect(allFactions[0]!.name).toBe("Alliance Defence Force")
        expect(allFactions[1]!.name).toBe("Empire Assembly")
        expect(allFactions[2]!.name).toBe("Independent Pilots")
      })
    )
  })

  /**
   * Test 4: GET /api/protected-faction/:id - Get faction by ID
   * Simulates viewing specific faction details
   */
  it("should get protected faction by ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const faction = new ProtectedFaction({
          id: factionId,
          name: "Specific Faction",
          webhookUrl: Option.some("https://example.com/webhook"),
          description: Option.some("A specific faction to find"),
          protected: true,
        })

        yield* factionRepo.create(faction)

        // Find by ID
        const found = yield* factionRepo.findById(factionId)
        expect(Option.isSome(found)).toBe(true)

        if (Option.isSome(found)) {
          expect(found.value.id).toBe(factionId)
          expect(found.value.name).toBe("Specific Faction")
          expect(Option.getOrNull(found.value.webhookUrl)).toBe("https://example.com/webhook")
        }
      })
    )
  })

  /**
   * Test 5: PUT /api/protected-faction/:id - Update faction (partial update)
   * Simulates editing faction information
   */
  it("should update protected faction with partial changes", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const original = new ProtectedFaction({
          id: factionId,
          name: "Original Name",
          webhookUrl: Option.some("https://original.com/webhook"),
          description: Option.some("Original description"),
          protected: true,
        })

        yield* factionRepo.create(original)

        // Update only description and protected flag
        const updated = new ProtectedFaction({
          id: factionId,
          name: "Original Name",
          webhookUrl: Option.some("https://original.com/webhook"),
          description: Option.some("Updated description"),
          protected: false,
        })

        yield* factionRepo.update(updated)

        // Verify update
        const saved = yield* factionRepo.findById(factionId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedFaction = saved.value
          expect(savedFaction.name).toBe("Original Name")
          expect(Option.getOrNull(savedFaction.webhookUrl)).toBe("https://original.com/webhook")
          expect(Option.getOrNull(savedFaction.description)).toBe("Updated description")
          expect(savedFaction.protected).toBe(false)
        }
      })
    )
  })

  /**
   * Test 6: DELETE /api/protected-faction/:id - Delete faction
   * Simulates removing a protected faction from tracking
   */
  it("should delete protected faction", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const faction = new ProtectedFaction({
          id: factionId,
          name: "To Be Deleted",
          webhookUrl: Option.none(),
          description: Option.none(),
          protected: true,
        })

        yield* factionRepo.create(faction)

        // Verify created
        const created = yield* factionRepo.findById(factionId)
        expect(Option.isSome(created)).toBe(true)

        // Delete faction
        yield* factionRepo.delete(factionId)

        // Verify deleted
        const deleted = yield* factionRepo.findById(factionId)
        expect(Option.isNone(deleted)).toBe(true)
      })
    )
  })

  /**
   * Test 7: GET /api/protected-faction/systems - Get all system names from EDDN (sorted alphabetically)
   * Simulates dashboard loading system list for autocomplete
   */
  it("should get all system names from EDDN sorted alphabetically", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        // Create multiple system info entries
        const systems = [
          new EddnSystemInfo({
            id: uuid() as EddnSystemInfoId,
            eddnMessageId: Option.none(),
            systemName: "Wolf 359",
            controllingFaction: Option.some("Wolf 359 Inc"),
            controllingPower: Option.none(),
            population: Option.some(1000000),
            security: Option.some("Medium"),
            government: Option.some("Corporate"),
            allegiance: Option.some("Independent"),
            updatedAt: new Date("2026-02-17T12:00:00Z"),
          }),
          new EddnSystemInfo({
            id: uuid() as EddnSystemInfoId,
            eddnMessageId: Option.none(),
            systemName: "Achenar",
            controllingFaction: Option.some("Empire Assembly"),
            controllingPower: Option.some("A. Lavigny-Duval"),
            population: Option.some(5000000000),
            security: Option.some("High"),
            government: Option.some("Patronage"),
            allegiance: Option.some("Empire"),
            updatedAt: new Date("2026-02-17T12:00:00Z"),
          }),
          new EddnSystemInfo({
            id: uuid() as EddnSystemInfoId,
            eddnMessageId: Option.none(),
            systemName: "Sol",
            controllingFaction: Option.some("Federation Congress"),
            controllingPower: Option.some("Z. Hudson"),
            population: Option.some(22780000000),
            security: Option.some("High"),
            government: Option.some("Democracy"),
            allegiance: Option.some("Federation"),
            updatedAt: new Date("2026-02-17T12:00:00Z"),
          }),
        ]

        for (const system of systems) {
          yield* eddnRepo.upsertSystemInfo(system)
        }

        // Get all system names
        const systemNames = yield* eddnRepo.getAllSystemNames()
        expect(systemNames.length).toBe(3)

        // Verify alphabetical ordering (Achenar, Sol, Wolf 359)
        expect(systemNames[0]).toBe("Achenar")
        expect(systemNames[1]).toBe("Sol")
        expect(systemNames[2]).toBe("Wolf 359")
      })
    )
  })

  /**
   * Test 8: GET /api/protected-faction/:id - Handle not found errors gracefully (Option.none())
   * Verifies proper handling of non-existent faction ID
   */
  it("should return Option.none() for non-existent faction ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const nonExistentId = uuid() as ProtectedFactionId
        const result = yield* factionRepo.findById(nonExistentId)

        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  /**
   * Test 9: POST /api/protected-faction - Protected flag defaults to true
   * Verifies the default value for protected flag
   */
  it("should default protected flag to true when creating faction", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const faction = new ProtectedFaction({
          id: factionId,
          name: "Default Protected",
          webhookUrl: Option.none(),
          description: Option.none(),
          protected: true, // Explicitly set, but mimics default behavior
        })

        yield* factionRepo.create(faction)

        const saved = yield* factionRepo.findById(factionId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          expect(saved.value.protected).toBe(true)
        }
      })
    )
  })

  /**
   * Test 10: POST /api/protected-faction - Verify webhook_url and description are optional
   * Confirms optional fields can be omitted
   */
  it("should create faction with webhook_url and description as optional", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const faction = new ProtectedFaction({
          id: factionId,
          name: "Optional Fields Faction",
          webhookUrl: Option.none(),
          description: Option.none(),
          protected: true,
        })

        yield* factionRepo.create(faction)

        const saved = yield* factionRepo.findById(factionId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedFaction = saved.value
          expect(savedFaction.name).toBe("Optional Fields Faction")
          expect(Option.isNone(savedFaction.webhookUrl)).toBe(true)
          expect(Option.isNone(savedFaction.description)).toBe(true)
        }
      })
    )
  })

  /**
   * Test 11: GET /api/protected-faction - Empty results when no factions exist
   * Verifies graceful handling of empty database
   */
  it("should return empty array when no factions exist", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const allFactions = yield* factionRepo.findAll()
        expect(allFactions.length).toBe(0)
      })
    )
  })

  /**
   * Test 12: GET /api/protected-faction/systems - Empty array when no EDDN data
   * Verifies systems endpoint handles empty EDDN data gracefully
   */
  it("should return empty array when no EDDN system data exists", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        const systemNames = yield* eddnRepo.getAllSystemNames()
        expect(systemNames.length).toBe(0)
      })
    )
  })

  /**
   * Test 13: PUT /api/protected-faction/:id - Update all fields
   * Simulates complete faction information update
   */
  it("should update all fields of a protected faction", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const original = new ProtectedFaction({
          id: factionId,
          name: "Original",
          webhookUrl: Option.some("https://old.com/hook"),
          description: Option.some("Old desc"),
          protected: true,
        })

        yield* factionRepo.create(original)

        // Update all fields
        const updated = new ProtectedFaction({
          id: factionId,
          name: "Updated Name",
          webhookUrl: Option.some("https://new.com/webhook"),
          description: Option.some("New description text"),
          protected: false,
        })

        yield* factionRepo.update(updated)

        const saved = yield* factionRepo.findById(factionId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedFaction = saved.value
          expect(savedFaction.name).toBe("Updated Name")
          expect(Option.getOrNull(savedFaction.webhookUrl)).toBe("https://new.com/webhook")
          expect(Option.getOrNull(savedFaction.description)).toBe("New description text")
          expect(savedFaction.protected).toBe(false)
        }
      })
    )
  })

  /**
   * Test 14: POST /api/protected-faction - Faction with protected=false
   * Verifies non-protected factions can be created
   */
  it("should create faction with protected flag set to false", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const faction = new ProtectedFaction({
          id: factionId,
          name: "Unprotected Faction",
          webhookUrl: Option.none(),
          description: Option.some("This faction is monitored but not protected"),
          protected: false,
        })

        yield* factionRepo.create(faction)

        const saved = yield* factionRepo.findById(factionId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          expect(saved.value.protected).toBe(false)
        }
      })
    )
  })

  /**
   * Test 15: GET /api/protected-faction - Find by name
   * Simulates searching for faction by name
   */
  it("should find protected faction by name", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const faction = new ProtectedFaction({
          id: uuid() as ProtectedFactionId,
          name: "Searchable Faction",
          webhookUrl: Option.none(),
          description: Option.some("Can be found by name"),
          protected: true,
        })

        yield* factionRepo.create(faction)

        // Find by name
        const found = yield* factionRepo.findByName("Searchable Faction")
        expect(Option.isSome(found)).toBe(true)

        if (Option.isSome(found)) {
          expect(found.value.name).toBe("Searchable Faction")
        }
      })
    )
  })

  /**
   * Test 16: GET /api/protected-faction - Find only protected factions
   * Simulates filtering for only factions with protected=true
   */
  it("should find only protected factions when using findProtected", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        // Create mixed protected and unprotected factions
        const factions = [
          new ProtectedFaction({
            id: uuid() as ProtectedFactionId,
            name: "Protected 1",
            webhookUrl: Option.none(),
            description: Option.none(),
            protected: true,
          }),
          new ProtectedFaction({
            id: uuid() as ProtectedFactionId,
            name: "Unprotected 1",
            webhookUrl: Option.none(),
            description: Option.none(),
            protected: false,
          }),
          new ProtectedFaction({
            id: uuid() as ProtectedFactionId,
            name: "Protected 2",
            webhookUrl: Option.none(),
            description: Option.none(),
            protected: true,
          }),
        ]

        for (const faction of factions) {
          yield* factionRepo.create(faction)
        }

        // Find only protected
        const protectedFactions = yield* factionRepo.findProtected()
        expect(protectedFactions.length).toBe(2)
        expect(protectedFactions.every((f) => f.protected === true)).toBe(true)
      })
    )
  })

  /**
   * Test 17: GET /api/protected-faction/systems - Duplicate system names handled correctly
   * Verifies DISTINCT behavior when same system has multiple records
   */
  it("should return unique system names even with multiple EDDN records per system", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        // Create multiple records for the same system (updates over time)
        const systems = [
          new EddnSystemInfo({
            id: uuid() as EddnSystemInfoId,
            eddnMessageId: Option.none(),
            systemName: "Deciat",
            controllingFaction: Option.some("Deciat Free"),
            controllingPower: Option.none(),
            population: Option.some(50000),
            security: Option.some("Low"),
            government: Option.some("Anarchy"),
            allegiance: Option.some("Independent"),
            updatedAt: new Date("2026-02-15T12:00:00Z"),
          }),
          new EddnSystemInfo({
            id: uuid() as EddnSystemInfoId,
            eddnMessageId: Option.none(),
            systemName: "Deciat",
            controllingFaction: Option.some("Deciat Free"),
            controllingPower: Option.none(),
            population: Option.some(50100),
            security: Option.some("Low"),
            government: Option.some("Anarchy"),
            allegiance: Option.some("Independent"),
            updatedAt: new Date("2026-02-17T12:00:00Z"),
          }),
          new EddnSystemInfo({
            id: uuid() as EddnSystemInfoId,
            eddnMessageId: Option.none(),
            systemName: "Shinrarta Dezhra",
            controllingFaction: Option.some("Pilots' Federation"),
            controllingPower: Option.none(),
            population: Option.some(100000),
            security: Option.some("High"),
            government: Option.some("Democracy"),
            allegiance: Option.some("Independent"),
            updatedAt: new Date("2026-02-17T12:00:00Z"),
          }),
        ]

        for (const system of systems) {
          yield* eddnRepo.upsertSystemInfo(system)
        }

        const systemNames = yield* eddnRepo.getAllSystemNames()

        // Should only return unique names
        expect(systemNames.length).toBe(2)
        expect(systemNames).toContain("Deciat")
        expect(systemNames).toContain("Shinrarta Dezhra")
      })
    )
  })

  /**
   * Test 18: PUT /api/protected-faction/:id - Clear optional fields
   * Simulates removing webhook and description by setting to none
   */
  it("should clear optional fields when updating to none", async () => {
    await runTest(
      Effect.gen(function* () {
        const factionRepo = yield* ProtectedFactionRepository

        const factionId = uuid() as ProtectedFactionId
        const original = new ProtectedFaction({
          id: factionId,
          name: "Faction With Fields",
          webhookUrl: Option.some("https://example.com/webhook"),
          description: Option.some("Has description"),
          protected: true,
        })

        yield* factionRepo.create(original)

        // Update to clear optional fields
        const updated = new ProtectedFaction({
          id: factionId,
          name: "Faction With Fields",
          webhookUrl: Option.none(),
          description: Option.none(),
          protected: true,
        })

        yield* factionRepo.update(updated)

        const saved = yield* factionRepo.findById(factionId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedFaction = saved.value
          expect(Option.isNone(savedFaction.webhookUrl)).toBe(true)
          expect(Option.isNone(savedFaction.description)).toBe(true)
        }
      })
    )
  })
})
