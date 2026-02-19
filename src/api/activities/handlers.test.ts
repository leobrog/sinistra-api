import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { createClient } from "@libsql/client"
import { TursoClient } from "../../database/client.js"
import { ActivityRepository } from "../../domain/repositories.js"
import { ActivityRepositoryLive } from "../../database/repositories/ActivityRepository.js"
import { AppConfig } from "../../lib/config.js"
import { Activity, System, Faction } from "../../domain/models.js"
import { ActivityId, SystemId, FactionId } from "../../domain/ids.js"
import { v4 as uuid } from "uuid"

describe("Activities API Integration", () => {
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
          CREATE TABLE IF NOT EXISTS activity (
            id TEXT PRIMARY KEY,
            tickid TEXT NOT NULL,
            ticktime TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            cmdr TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_activity_tickid ON activity(tickid);
          CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
          CREATE INDEX IF NOT EXISTS idx_activity_cmdr ON activity(cmdr);

          CREATE TABLE IF NOT EXISTS system (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            address INTEGER NOT NULL,
            activity_id TEXT NOT NULL,
            FOREIGN KEY (activity_id) REFERENCES activity(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_system_activity_id ON system(activity_id);
          CREATE INDEX IF NOT EXISTS idx_system_name ON system(name);

          CREATE TABLE IF NOT EXISTS faction (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            state TEXT NOT NULL,
            system_id TEXT NOT NULL,
            bvs INTEGER,
            cbs INTEGER,
            exobiology INTEGER,
            exploration INTEGER,
            scenarios INTEGER,
            infprimary INTEGER,
            infsecondary INTEGER,
            missionfails INTEGER,
            murdersground INTEGER,
            murdersspace INTEGER,
            tradebm INTEGER,
            FOREIGN KEY (system_id) REFERENCES system(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_faction_system_id ON faction(system_id);
          CREATE INDEX IF NOT EXISTS idx_faction_name ON faction(name);
        `)
      )

      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfig, testConfig)

  const TestLayer = ActivityRepositoryLive.pipe(
    Layer.provide(ClientLayer),
    Layer.provide(TestConfigLayer)
  )

  const FullLayer = Layer.merge(TestLayer, ClientLayer).pipe(
    Layer.provide(TestConfigLayer)
  )

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, FullLayer))

  /**
   * Test 1: PUT /activities - Basic upsert with single system and faction
   * Simulates real BGS tracking data from dashboard
   */
  it("should upsert activity with nested system and faction data", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository

        // Create activity from request (simulating handler logic)
        const activityId = uuid() as ActivityId
        const systemId = uuid() as SystemId
        const factionId = uuid() as FactionId

        const faction = new Faction({
          id: factionId,
          name: "Federation Navy",
          state: "Boom",
          systemId,
          bvs: Option.some(50),
          cbs: Option.some(30),
          exobiology: Option.none(),
          exploration: Option.some(25),
          scenarios: Option.none(),
          infprimary: Option.some(500),
          infsecondary: Option.some(200),
          missionfails: Option.none(),
          murdersground: Option.none(),
          murdersspace: Option.none(),
          tradebm: Option.some(150),
        })

        const system = new System({
          id: systemId,
          name: "Sol",
          address: BigInt(10477373803),
          activityId,
          factions: [faction],
        })

        const activity = new Activity({
          id: activityId,
          tickid: "tick_12345",
          ticktime: "2026-02-17T00:00:00Z",
          timestamp: "2026-02-17T10:30:00Z",
          cmdr: Option.some("CMDR TestPilot"),
          systems: [system],
        })

        // Upsert activity
        yield* activityRepo.upsert(activity)

        // Verify activity was saved
        const saved = yield* activityRepo.findById(activityId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedActivity = saved.value
          expect(savedActivity.tickid).toBe("tick_12345")
          expect(Option.getOrNull(savedActivity.cmdr)).toBe("CMDR TestPilot")
          expect(savedActivity.systems.length).toBe(1)

          const savedSystem = savedActivity.systems[0]!
          expect(savedSystem.name).toBe("Sol")
          expect(savedSystem.factions.length).toBe(1)

          const savedFaction = savedSystem.factions[0]!
          expect(savedFaction.name).toBe("Federation Navy")
          expect(Option.getOrNull(savedFaction.infprimary)).toBe(500)
          expect(Option.getOrNull(savedFaction.infsecondary)).toBe(200)
        }
      })
    )
  })

  /**
   * Test 2: PUT /activities - Multiple systems and factions (realistic BGS data)
   * Simulates tracking activity across multiple systems in one tick
   */
  it("should handle multiple systems with multiple factions", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository

        const activityId = uuid() as ActivityId

        // System 1: Sol with 2 factions
        const system1Id = uuid() as SystemId
        const faction1Id = uuid() as FactionId
        const faction2Id = uuid() as FactionId

        const faction1 = new Faction({
          id: faction1Id,
          name: "Federation Navy",
          state: "Boom",
          systemId: system1Id,
          bvs: Option.some(100),
          cbs: Option.some(50),
          exobiology: Option.none(),
          exploration: Option.none(),
          scenarios: Option.some(10),
          infprimary: Option.some(800),
          infsecondary: Option.some(300),
          missionfails: Option.none(),
          murdersground: Option.none(),
          murdersspace: Option.some(5),
          tradebm: Option.some(200),
        })

        const faction2 = new Faction({
          id: faction2Id,
          name: "Mother Gaia",
          state: "War",
          systemId: system1Id,
          bvs: Option.some(150),
          cbs: Option.some(100),
          exobiology: Option.none(),
          exploration: Option.none(),
          scenarios: Option.none(),
          infprimary: Option.some(600),
          infsecondary: Option.some(400),
          missionfails: Option.none(),
          murdersground: Option.some(3),
          murdersspace: Option.some(10),
          tradebm: Option.none(),
        })

        const system1 = new System({
          id: system1Id,
          name: "Sol",
          address: BigInt(10477373803),
          activityId,
          factions: [faction1, faction2],
        })

        // System 2: Achenar with 1 faction
        const system2Id = uuid() as SystemId
        const faction3Id = uuid() as FactionId

        const faction3 = new Faction({
          id: faction3Id,
          name: "Empire Assembly",
          state: "None",
          systemId: system2Id,
          bvs: Option.none(),
          cbs: Option.none(),
          exobiology: Option.some(50),
          exploration: Option.some(75),
          scenarios: Option.none(),
          infprimary: Option.some(400),
          infsecondary: Option.some(100),
          missionfails: Option.none(),
          murdersground: Option.none(),
          murdersspace: Option.none(),
          tradebm: Option.some(300),
        })

        const system2 = new System({
          id: system2Id,
          name: "Achenar",
          address: BigInt(3932277478106),
          activityId,
          factions: [faction3],
        })

        const activity = new Activity({
          id: activityId,
          tickid: "tick_999",
          ticktime: "2026-02-17T00:00:00Z",
          timestamp: "2026-02-17T12:00:00Z",
          cmdr: Option.some("CMDR Explorer"),
          systems: [system1, system2],
        })

        yield* activityRepo.upsert(activity)

        const saved = yield* activityRepo.findById(activityId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedActivity = saved.value
          expect(savedActivity.systems.length).toBe(2)

          // Verify Sol system
          const sol = savedActivity.systems.find((s) => s.name === "Sol")
          expect(sol).toBeDefined()
          expect(sol!.factions.length).toBe(2)

          // Verify Achenar system
          const achenar = savedActivity.systems.find((s) => s.name === "Achenar")
          expect(achenar).toBeDefined()
          expect(achenar!.factions.length).toBe(1)
        }
      })
    )
  })

  /**
   * Test 3: GET /api/activities with period=ct (current tick)
   * Simulates dashboard querying current tick activities
   */
  it("should query activities by current tick (ct)", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository

        // Create activities for different ticks
        const act1Id = uuid() as ActivityId
        const act1 = new Activity({
          id: act1Id,
          tickid: "tick_100",
          ticktime: "2026-02-16T00:00:00Z",
          timestamp: "2026-02-16T10:00:00Z",
          cmdr: Option.some("CMDR Old"),
          systems: [],
        })

        const act2Id = uuid() as ActivityId
        const act2 = new Activity({
          id: act2Id,
          tickid: "tick_101",
          ticktime: "2026-02-17T00:00:00Z",
          timestamp: "2026-02-17T10:00:00Z",
          cmdr: Option.some("CMDR Current"),
          systems: [],
        })

        yield* activityRepo.upsert(act1)
        yield* activityRepo.upsert(act2)

        // Query current tick (should be tick_101, the most recent)
        const client = yield* TursoClient
        const result = yield* Effect.tryPromise({
          try: () =>
            client.execute({
              sql: "SELECT tickid FROM activity ORDER BY timestamp DESC LIMIT 1",
              args: [],
            }),
          catch: () => new Error("Query failed"),
        })

        expect(result.rows.length).toBe(1)
        expect(String(result.rows[0]![0])).toBe("tick_101")

        // Now query activities with that tick
        const activities = yield* Effect.tryPromise({
          try: () =>
            client.execute({
              sql: "SELECT * FROM activity WHERE tickid = ? ORDER BY timestamp DESC",
              args: ["tick_101"],
            }),
          catch: () => new Error("Query failed"),
        })

        expect(activities.rows.length).toBe(1)
      })
    )
  })

  /**
   * Test 4: GET /api/activities with period=lt (last tick)
   * Verifies the "last tick" filter returns second-most-recent tick
   */
  it("should query activities by last tick (lt)", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository

        // Create 3 activities across 3 ticks
        const ticks = [
          { id: uuid() as ActivityId, tickid: "tick_100", timestamp: "2026-02-15T10:00:00Z" },
          { id: uuid() as ActivityId, tickid: "tick_101", timestamp: "2026-02-16T10:00:00Z" },
          { id: uuid() as ActivityId, tickid: "tick_102", timestamp: "2026-02-17T10:00:00Z" },
        ]

        for (const tick of ticks) {
          const activity = new Activity({
            id: tick.id,
            tickid: tick.tickid,
            ticktime: tick.timestamp,
            timestamp: tick.timestamp,
            cmdr: Option.none(),
            systems: [],
          })
          yield* activityRepo.upsert(activity)
        }

        // Query for last tick (should be tick_101, second most recent)
        const client = yield* TursoClient
        const result = yield* Effect.tryPromise({
          try: () =>
            client.execute({
              sql: "SELECT DISTINCT tickid FROM activity ORDER BY timestamp DESC LIMIT 2",
              args: [],
            }),
          catch: () => new Error("Query failed"),
        })

        expect(result.rows.length).toBe(2)
        const lastTickId = String(result.rows[1]![0])
        expect(lastTickId).toBe("tick_101")
      })
    )
  })

  /**
   * Test 5: GET /api/activities with cmdr filter
   * Simulates filtering activities by commander name
   */
  it("should filter activities by commander name", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository

        // Create activities for different commanders
        const cmdrs = [
          { name: "CMDR Alpha", tickid: "tick_200" },
          { name: "CMDR Beta", tickid: "tick_200" },
          { name: "CMDR Alpha", tickid: "tick_201" },
        ]

        for (const cmdr of cmdrs) {
          const activity = new Activity({
            id: uuid() as ActivityId,
            tickid: cmdr.tickid,
            ticktime: "2026-02-17T00:00:00Z",
            timestamp: "2026-02-17T10:00:00Z",
            cmdr: Option.some(cmdr.name),
            systems: [],
          })
          yield* activityRepo.upsert(activity)
        }

        // Query activities for CMDR Alpha
        const activities = yield* activityRepo.findByCmdr("CMDR Alpha")
        expect(activities.length).toBe(2)
        expect(activities.every((a) => Option.getOrNull(a.cmdr) === "CMDR Alpha")).toBe(true)
      })
    )
  })

  /**
   * Test 6: GET /api/activities with system filter
   * Verifies filtering by system name
   */
  it("should filter activities by system name", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository
        const client = yield* TursoClient

        // Create activity with multiple systems
        const activityId = uuid() as ActivityId

        const system1 = new System({
          id: uuid() as SystemId,
          name: "Sol",
          address: BigInt(10477373803),
          activityId,
          factions: [],
        })

        const system2 = new System({
          id: uuid() as SystemId,
          name: "Achenar",
          address: BigInt(3932277478106),
          activityId,
          factions: [],
        })

        const activity = new Activity({
          id: activityId,
          tickid: "tick_300",
          ticktime: "2026-02-17T00:00:00Z",
          timestamp: "2026-02-17T10:00:00Z",
          cmdr: Option.some("CMDR Test"),
          systems: [system1, system2],
        })

        yield* activityRepo.upsert(activity)

        // Query activities for Sol system
        const result = yield* Effect.tryPromise({
          try: () =>
            client.execute({
              sql: `
                SELECT DISTINCT a.id
                FROM activity a
                JOIN system s ON s.activity_id = a.id
                WHERE s.name = ?
              `,
              args: ["Sol"],
            }),
          catch: () => new Error("Query failed"),
        })

        expect(result.rows.length).toBe(1)
      })
    )
  })

  /**
   * Test 7: GET /api/activities with faction filter
   * Verifies filtering by faction name within systems
   */
  it("should filter activities by faction name", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository
        const client = yield* TursoClient

        // Create activity with system containing multiple factions
        const activityId = uuid() as ActivityId
        const systemId = uuid() as SystemId

        const faction1 = new Faction({
          id: uuid() as FactionId,
          name: "Federation Navy",
          state: "Boom",
          systemId,
          bvs: Option.some(100),
          cbs: Option.none(),
          exobiology: Option.none(),
          exploration: Option.none(),
          scenarios: Option.none(),
          infprimary: Option.some(500),
          infsecondary: Option.none(),
          missionfails: Option.none(),
          murdersground: Option.none(),
          murdersspace: Option.none(),
          tradebm: Option.none(),
        })

        const faction2 = new Faction({
          id: uuid() as FactionId,
          name: "Mother Gaia",
          state: "War",
          systemId,
          bvs: Option.some(200),
          cbs: Option.none(),
          exobiology: Option.none(),
          exploration: Option.none(),
          scenarios: Option.none(),
          infprimary: Option.some(600),
          infsecondary: Option.none(),
          missionfails: Option.none(),
          murdersground: Option.none(),
          murdersspace: Option.none(),
          tradebm: Option.none(),
        })

        const system = new System({
          id: systemId,
          name: "Sol",
          address: BigInt(10477373803),
          activityId,
          factions: [faction1, faction2],
        })

        const activity = new Activity({
          id: activityId,
          tickid: "tick_400",
          ticktime: "2026-02-17T00:00:00Z",
          timestamp: "2026-02-17T10:00:00Z",
          cmdr: Option.some("CMDR Test"),
          systems: [system],
        })

        yield* activityRepo.upsert(activity)

        // Query activities containing Federation Navy
        const result = yield* Effect.tryPromise({
          try: () =>
            client.execute({
              sql: `
                SELECT DISTINCT a.id
                FROM activity a
                JOIN system s ON s.activity_id = a.id
                JOIN faction f ON f.system_id = s.id
                WHERE f.name = ?
              `,
              args: ["Federation Navy"],
            }),
          catch: () => new Error("Query failed"),
        })

        expect(result.rows.length).toBe(1)
      })
    )
  })

  /**
   * Test 8: Upsert behavior - updating existing activity
   * Verifies that re-upserting with same tickid/cmdr updates the activity
   */
  it("should update existing activity on re-upsert (same tickid + cmdr)", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository

        const activityId = uuid() as ActivityId
        const tickid = "tick_500"
        const cmdr = "CMDR Updater"

        // First upsert
        const system1 = new System({
          id: uuid() as SystemId,
          name: "Sol",
          address: BigInt(10477373803),
          activityId,
          factions: [],
        })

        const activity1 = new Activity({
          id: activityId,
          tickid,
          ticktime: "2026-02-17T00:00:00Z",
          timestamp: "2026-02-17T10:00:00Z",
          cmdr: Option.some(cmdr),
          systems: [system1],
        })

        yield* activityRepo.upsert(activity1)

        // Second upsert with updated data
        const system2 = new System({
          id: uuid() as SystemId,
          name: "Achenar",
          address: BigInt(3932277478106),
          activityId,
          factions: [],
        })

        const activity2 = new Activity({
          id: activityId,
          tickid,
          ticktime: "2026-02-17T00:00:00Z",
          timestamp: "2026-02-17T11:00:00Z", // Updated timestamp
          cmdr: Option.some(cmdr),
          systems: [system2], // Different system
        })

        yield* activityRepo.upsert(activity2)

        // Verify only one activity exists with updated data
        const saved = yield* activityRepo.findById(activityId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedActivity = saved.value
          expect(savedActivity.timestamp).toBe("2026-02-17T11:00:00Z")
          expect(savedActivity.systems.length).toBe(1)
          expect(savedActivity.systems[0]!.name).toBe("Achenar")
        }
      })
    )
  })

  /**
   * Test 9: Combined filters - period + system + faction
   * Simulates complex query from dashboard with multiple filters
   */
  it("should handle combined filters (tick + system + faction)", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository
        const client = yield* TursoClient

        const tickid = "tick_600"

        // Create activity matching all filters
        const activityId1 = uuid() as ActivityId
        const systemId1 = uuid() as SystemId
        const factionId1 = uuid() as FactionId

        const faction1 = new Faction({
          id: factionId1,
          name: "Target Faction",
          state: "Boom",
          systemId: systemId1,
          bvs: Option.some(100),
          cbs: Option.none(),
          exobiology: Option.none(),
          exploration: Option.none(),
          scenarios: Option.none(),
          infprimary: Option.some(500),
          infsecondary: Option.none(),
          missionfails: Option.none(),
          murdersground: Option.none(),
          murdersspace: Option.none(),
          tradebm: Option.none(),
        })

        const system1 = new System({
          id: systemId1,
          name: "Target System",
          address: BigInt(12345),
          activityId: activityId1,
          factions: [faction1],
        })

        const activity1 = new Activity({
          id: activityId1,
          tickid,
          ticktime: "2026-02-17T00:00:00Z",
          timestamp: "2026-02-17T10:00:00Z",
          cmdr: Option.some("CMDR Target"),
          systems: [system1],
        })

        // Create activity NOT matching all filters (different tick)
        const activityId2 = uuid() as ActivityId
        const activity2 = new Activity({
          id: activityId2,
          tickid: "tick_601",
          ticktime: "2026-02-18T00:00:00Z",
          timestamp: "2026-02-18T10:00:00Z",
          cmdr: Option.some("CMDR Other"),
          systems: [],
        })

        yield* activityRepo.upsert(activity1)
        yield* activityRepo.upsert(activity2)

        // Query with all filters
        const result = yield* Effect.tryPromise({
          try: () =>
            client.execute({
              sql: `
                SELECT DISTINCT a.id
                FROM activity a
                JOIN system s ON s.activity_id = a.id
                JOIN faction f ON f.system_id = s.id
                WHERE a.tickid = ?
                  AND s.name = ?
                  AND f.name = ?
              `,
              args: [tickid, "Target System", "Target Faction"],
            }),
          catch: () => new Error("Query failed"),
        })

        expect(result.rows.length).toBe(1)
        expect(String(result.rows[0]![0])).toBe(activityId1)
      })
    )
  })

  /**
   * Test 10: Empty results handling
   * Verifies graceful handling when no activities match filters
   */
  it("should return empty array when no activities match filters", async () => {
    await runTest(
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository

        // Query non-existent commander
        const activities = yield* activityRepo.findByCmdr("CMDR NonExistent")
        expect(activities.length).toBe(0)
      })
    )
  })
})
