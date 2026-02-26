import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"

import { PgClient } from "../../database/client.js"
import { ObjectiveRepository } from "../../domain/repositories.js"
import { ObjectiveRepositoryLive } from "../../database/repositories/ObjectiveRepository.js"
import { AppConfig } from "../../lib/config.js"
import { Objective, ObjectiveTarget, ObjectiveTargetSettlement } from "../../domain/models.js"
import { ObjectiveId, ObjectiveTargetId, ObjectiveTargetSettlementId } from "../../domain/ids.js"
import { v4 as uuid } from "uuid"


describe("Objectives API Integration", () => {
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
    PgClient,
    Effect.gen(function* () {
      const client = new SQL('postgres://postgres:password@localhost:5432/sinistra')

      // Initialize schema
      yield* Effect.tryPromise(() =>
        client(`
          CREATE TABLE IF NOT EXISTS objective (
            id TEXT PRIMARY KEY,
            title TEXT,
            priority INTEGER,
            type TEXT,
            system TEXT,
            faction TEXT,
            description TEXT,
            startdate TEXT,
            enddate TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_objective_priority ON objective(priority);
          CREATE INDEX IF NOT EXISTS idx_objective_type ON objective(type);
          CREATE INDEX IF NOT EXISTS idx_objective_system ON objective(system);
          CREATE INDEX IF NOT EXISTS idx_objective_faction ON objective(faction);

          CREATE TABLE IF NOT EXISTS objective_target (
            id TEXT PRIMARY KEY,
            objective_id TEXT NOT NULL,
            type TEXT,
            station TEXT,
            system TEXT,
            faction TEXT,
            progress INTEGER,
            targetindividual INTEGER,
            targetoverall INTEGER,
            FOREIGN KEY (objective_id) REFERENCES objective(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_objective_target_objective_id ON objective_target(objective_id);
          CREATE INDEX IF NOT EXISTS idx_objective_target_system ON objective_target(system);
          CREATE INDEX IF NOT EXISTS idx_objective_target_faction ON objective_target(faction);

          CREATE TABLE IF NOT EXISTS objective_target_settlement (
            id TEXT PRIMARY KEY,
            target_id TEXT NOT NULL,
            name TEXT,
            targetindividual INTEGER,
            targetoverall INTEGER,
            progress INTEGER,
            FOREIGN KEY (target_id) REFERENCES objective_target(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_objective_target_settlement_target_id ON objective_target_settlement(target_id);
        `)
      )

      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfig, testConfig)

  const TestLayer = ObjectiveRepositoryLive.pipe(
    Layer.provide(ClientLayer),
    Layer.provide(TestConfigLayer)
  )

  const FullLayer = Layer.merge(TestLayer, ClientLayer).pipe(
    Layer.provide(TestConfigLayer)
  )

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, FullLayer))

  /**
   * Test 1: POST /objectives - Create objective with nested target and settlement
   * Simulates dashboard creating a new BGS objective with ground CZ targets
   */
  it("should create objective with nested targets and settlements", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const objectiveId = uuid() as ObjectiveId
        const targetId = uuid() as ObjectiveTargetId
        const settlementId = uuid() as ObjectiveTargetSettlementId

        const settlement = new ObjectiveTargetSettlement({
          id: settlementId,
          targetId,
          name: Option.some("Settlement Alpha"),
          targetindividual: Option.some(100),
          targetoverall: Option.some(500),
          progress: Option.some(25),
        })

        const target = new ObjectiveTarget({
          id: targetId,
          objectiveId,
          type: Option.some("GroundCZ"),
          station: Option.none(),
          system: Option.some("Sol"),
          faction: Option.some("Federation Navy"),
          progress: Option.some(150),
          targetindividual: Option.some(500),
          targetoverall: Option.some(2000),
          settlements: [settlement],
        })

        const objective = new Objective({
          id: objectiveId,
          title: Option.some("Defend Sol"),
          priority: Option.some(1),
          type: Option.some("GroundCZ"),
          system: Option.some("Sol"),
          faction: Option.some("Federation Navy"),
          description: Option.some("Defend Federation territory in Sol"),
          startdate: Option.some(new Date("2026-02-01T00:00:00Z")),
          enddate: Option.some(new Date("2026-02-28T23:59:59Z")),
          targets: [target],
        })

        yield* objectiveRepo.create(objective)

        // Verify objective was saved
        const saved = yield* objectiveRepo.findById(objectiveId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedObjective = saved.value
          expect(Option.getOrNull(savedObjective.title)).toBe("Defend Sol")
          expect(Option.getOrNull(savedObjective.priority)).toBe(1)
          expect(Option.getOrNull(savedObjective.system)).toBe("Sol")
          expect(savedObjective.targets.length).toBe(1)

          const savedTarget = savedObjective.targets[0]!
          expect(Option.getOrNull(savedTarget.type)).toBe("GroundCZ")
          expect(Option.getOrNull(savedTarget.system)).toBe("Sol")
          expect(Option.getOrNull(savedTarget.progress)).toBe(150)
          expect(savedTarget.settlements.length).toBe(1)

          const savedSettlement = savedTarget.settlements[0]!
          expect(Option.getOrNull(savedSettlement.name)).toBe("Settlement Alpha")
          expect(Option.getOrNull(savedSettlement.progress)).toBe(25)
        }
      })
    )
  })

  /**
   * Test 2: POST /objectives - Multiple targets and settlements
   * Simulates complex objective with multiple target systems
   */
  it("should create objective with multiple targets and settlements", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const objectiveId = uuid() as ObjectiveId

        // Target 1: Sol with 2 settlements
        const target1Id = uuid() as ObjectiveTargetId
        const settlement1 = new ObjectiveTargetSettlement({
          id: uuid() as ObjectiveTargetSettlementId,
          targetId: target1Id,
          name: Option.some("Mars High"),
          targetindividual: Option.some(100),
          targetoverall: Option.some(500),
          progress: Option.some(50),
        })
        const settlement2 = new ObjectiveTargetSettlement({
          id: uuid() as ObjectiveTargetSettlementId,
          targetId: target1Id,
          name: Option.some("Luna Base"),
          targetindividual: Option.some(150),
          targetoverall: Option.some(600),
          progress: Option.some(75),
        })
        const target1 = new ObjectiveTarget({
          id: target1Id,
          objectiveId,
          type: Option.some("SpaceCZ"),
          station: Option.none(),
          system: Option.some("Sol"),
          faction: Option.some("Federation Navy"),
          progress: Option.some(300),
          targetindividual: Option.some(1000),
          targetoverall: Option.some(5000),
          settlements: [settlement1, settlement2],
        })

        // Target 2: Achenar with no settlements
        const target2Id = uuid() as ObjectiveTargetId
        const target2 = new ObjectiveTarget({
          id: target2Id,
          objectiveId,
          type: Option.some("Trade"),
          station: Option.some("Dawes Hub"),
          system: Option.some("Achenar"),
          faction: Option.some("Empire Assembly"),
          progress: Option.some(5000000),
          targetindividual: Option.some(10000000),
          targetoverall: Option.some(50000000),
          settlements: [],
        })

        const objective = new Objective({
          id: objectiveId,
          title: Option.some("Multi-System Campaign"),
          priority: Option.some(2),
          type: Option.some("Mixed"),
          system: Option.none(),
          faction: Option.none(),
          description: Option.some("Coordinate operations across multiple systems"),
          startdate: Option.some(new Date("2026-02-10T00:00:00Z")),
          enddate: Option.some(new Date("2026-03-10T23:59:59Z")),
          targets: [target1, target2],
        })

        yield* objectiveRepo.create(objective)

        const saved = yield* objectiveRepo.findById(objectiveId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedObjective = saved.value
          expect(savedObjective.targets.length).toBe(2)

          // Verify Sol target
          const solTarget = savedObjective.targets.find((t) =>
            Option.getOrNull(t.system) === "Sol"
          )
          expect(solTarget).toBeDefined()
          expect(solTarget!.settlements.length).toBe(2)

          // Verify Achenar target
          const achenarTarget = savedObjective.targets.find((t) =>
            Option.getOrNull(t.system) === "Achenar"
          )
          expect(achenarTarget).toBeDefined()
          expect(achenarTarget!.settlements.length).toBe(0)
        }
      })
    )
  })

  /**
   * Test 3: GET /objectives - Query all objectives
   * Simulates dashboard loading all objectives
   */
  it("should query all objectives without filters", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* PgClient

        // Create 3 objectives
        const objectives = [
          new Objective({
            id: uuid() as ObjectiveId,
            title: Option.some("Objective 1"),
            priority: Option.some(1),
            type: Option.some("SpaceCZ"),
            system: Option.some("Sol"),
            faction: Option.some("Federation"),
            description: Option.none(),
            startdate: Option.some(new Date("2026-02-01T00:00:00Z")),
            enddate: Option.some(new Date("2026-02-28T23:59:59Z")),
            targets: [],
          }),
          new Objective({
            id: uuid() as ObjectiveId,
            title: Option.some("Objective 2"),
            priority: Option.some(2),
            type: Option.some("Trade"),
            system: Option.some("Achenar"),
            faction: Option.some("Empire"),
            description: Option.none(),
            startdate: Option.some(new Date("2026-02-05T00:00:00Z")),
            enddate: Option.some(new Date("2026-03-05T23:59:59Z")),
            targets: [],
          }),
          new Objective({
            id: uuid() as ObjectiveId,
            title: Option.some("Objective 3"),
            priority: Option.some(3),
            type: Option.some("GroundCZ"),
            system: Option.some("Deciat"),
            faction: Option.some("Independent"),
            description: Option.none(),
            startdate: Option.some(new Date("2026-02-10T00:00:00Z")),
            enddate: Option.some(new Date("2026-03-10T23:59:59Z")),
            targets: [],
          }),
        ]

        for (const obj of objectives) {
          yield* objectiveRepo.create(obj)
        }

        // Query all objectives
        const result = yield* Effect.tryPromise({
          try: () => client`SELECT id FROM objective`,
          catch: () => new Error("Query failed"),
        })

        expect((result as any).length).toBe(3)
      })
    )
  })

  /**
   * Test 4: GET /objectives?system=Sol - Filter by system
   * Simulates dashboard filtering objectives by system
   */
  it("should filter objectives by system", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* PgClient

        // Create objectives in different systems
        const objective1 = new Objective({
          id: uuid() as ObjectiveId,
          title: Option.some("Sol Objective"),
          priority: Option.none(),
          type: Option.none(),
          system: Option.some("Sol"),
          faction: Option.none(),
          description: Option.none(),
          startdate: Option.none(),
          enddate: Option.none(),
          targets: [],
        })

        const objective2 = new Objective({
          id: uuid() as ObjectiveId,
          title: Option.some("Achenar Objective"),
          priority: Option.none(),
          type: Option.none(),
          system: Option.some("Achenar"),
          faction: Option.none(),
          description: Option.none(),
          startdate: Option.none(),
          enddate: Option.none(),
          targets: [],
        })

        yield* objectiveRepo.create(objective1)
        yield* objectiveRepo.create(objective2)

        // Query objectives in Sol
        const result = yield* Effect.tryPromise({
          try: () =>
            client`SELECT id FROM objective WHERE system = ${"Sol"}`,
          catch: () => new Error("Query failed"),
        })

        expect((result as any).length).toBe(1)
      })
    )
  })

  /**
   * Test 5: GET /objectives?faction=Federation - Filter by faction
   * Simulates dashboard filtering by faction
   */
  it("should filter objectives by faction", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* PgClient

        const objectives = [
          new Objective({
            id: uuid() as ObjectiveId,
            title: Option.some("Fed Objective 1"),
            priority: Option.none(),
            type: Option.none(),
            system: Option.none(),
            faction: Option.some("Federation Navy"),
            description: Option.none(),
            startdate: Option.none(),
            enddate: Option.none(),
            targets: [],
          }),
          new Objective({
            id: uuid() as ObjectiveId,
            title: Option.some("Fed Objective 2"),
            priority: Option.none(),
            type: Option.none(),
            system: Option.none(),
            faction: Option.some("Federation Navy"),
            description: Option.none(),
            startdate: Option.none(),
            enddate: Option.none(),
            targets: [],
          }),
          new Objective({
            id: uuid() as ObjectiveId,
            title: Option.some("Empire Objective"),
            priority: Option.none(),
            type: Option.none(),
            system: Option.none(),
            faction: Option.some("Empire Assembly"),
            description: Option.none(),
            startdate: Option.none(),
            enddate: Option.none(),
            targets: [],
          }),
        ]

        for (const obj of objectives) {
          yield* objectiveRepo.create(obj)
        }

        const result = yield* Effect.tryPromise({
          try: () =>
            client`SELECT id FROM objective WHERE faction = ${"Federation Navy"}`,
          catch: () => new Error("Query failed"),
        })

        expect((result as any).length).toBe(2)
      })
    )
  })

  /**
   * Test 6: GET /objectives?active=true - Filter by active date range
   * Simulates dashboard showing only active objectives
   */
  it("should filter objectives by active date range", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* PgClient

        const now = new Date("2026-02-17T12:00:00Z").toISOString()

        // Active objective (dates include current time)
        const activeObjective = new Objective({
          id: uuid() as ObjectiveId,
          title: Option.some("Active Objective"),
          priority: Option.none(),
          type: Option.none(),
          system: Option.none(),
          faction: Option.none(),
          description: Option.none(),
          startdate: Option.some(new Date("2026-02-01T00:00:00Z")),
          enddate: Option.some(new Date("2026-02-28T23:59:59Z")),
          targets: [],
        })

        // Past objective (ended before current time)
        const pastObjective = new Objective({
          id: uuid() as ObjectiveId,
          title: Option.some("Past Objective"),
          priority: Option.none(),
          type: Option.none(),
          system: Option.none(),
          faction: Option.none(),
          description: Option.none(),
          startdate: Option.some(new Date("2026-01-01T00:00:00Z")),
          enddate: Option.some(new Date("2026-01-31T23:59:59Z")),
          targets: [],
        })

        // Future objective (starts after current time)
        const futureObjective = new Objective({
          id: uuid() as ObjectiveId,
          title: Option.some("Future Objective"),
          priority: Option.none(),
          type: Option.none(),
          system: Option.none(),
          faction: Option.none(),
          description: Option.none(),
          startdate: Option.some(new Date("2026-03-01T00:00:00Z")),
          enddate: Option.some(new Date("2026-03-31T23:59:59Z")),
          targets: [],
        })

        yield* objectiveRepo.create(activeObjective)
        yield* objectiveRepo.create(pastObjective)
        yield* objectiveRepo.create(futureObjective)

        // Query active objectives
        const result = yield* Effect.tryPromise({
          try: () =>
            client`SELECT id FROM objective WHERE startdate <= ${now} AND enddate >= ${now}`,
          catch: () => new Error("Query failed"),
        })

        expect((result as any).length).toBe(1)
        expect(String((result as any)[0]![0])).toBe(activeObjective.id)
      })
    )
  })

  /**
   * Test 7: POST /api/objectives/:id - Update objective (partial update)
   * Simulates dashboard updating objective priority and description
   */
  it("should update objective with partial changes", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const objectiveId = uuid() as ObjectiveId
        const original = new Objective({
          id: objectiveId,
          title: Option.some("Original Title"),
          priority: Option.some(5),
          type: Option.some("SpaceCZ"),
          system: Option.some("Sol"),
          faction: Option.some("Federation"),
          description: Option.some("Original description"),
          startdate: Option.some(new Date("2026-02-01T00:00:00Z")),
          enddate: Option.some(new Date("2026-02-28T23:59:59Z")),
          targets: [],
        })

        yield* objectiveRepo.create(original)

        // Update only priority and description
        const updated = new Objective({
          id: objectiveId,
          title: original.title,
          priority: Option.some(1), // Updated
          type: original.type,
          system: original.system,
          faction: original.faction,
          description: Option.some("Updated description"), // Updated
          startdate: original.startdate,
          enddate: original.enddate,
          targets: [],
        })

        yield* objectiveRepo.update(updated)

        const saved = yield* objectiveRepo.findById(objectiveId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedObjective = saved.value
          expect(Option.getOrNull(savedObjective.title)).toBe("Original Title")
          expect(Option.getOrNull(savedObjective.priority)).toBe(1)
          expect(Option.getOrNull(savedObjective.description)).toBe("Updated description")
          expect(Option.getOrNull(savedObjective.system)).toBe("Sol")
        }
      })
    )
  })

  /**
   * Test 8: POST /api/objectives/:id - Update with new targets
   * Simulates replacing targets on an objective
   */
  it("should update objective with new targets", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const objectiveId = uuid() as ObjectiveId

        // Original with one target
        const originalTargetId = uuid() as ObjectiveTargetId
        const originalTarget = new ObjectiveTarget({
          id: originalTargetId,
          objectiveId,
          type: Option.some("Trade"),
          station: Option.some("Old Station"),
          system: Option.some("Sol"),
          faction: Option.none(),
          progress: Option.some(1000),
          targetindividual: Option.some(5000),
          targetoverall: Option.some(10000),
          settlements: [],
        })

        const original = new Objective({
          id: objectiveId,
          title: Option.some("Trade Objective"),
          priority: Option.some(3),
          type: Option.some("Trade"),
          system: Option.some("Sol"),
          faction: Option.none(),
          description: Option.none(),
          startdate: Option.none(),
          enddate: Option.none(),
          targets: [originalTarget],
        })

        yield* objectiveRepo.create(original)

        // Update with different target
        const newTargetId = uuid() as ObjectiveTargetId
        const newTarget = new ObjectiveTarget({
          id: newTargetId,
          objectiveId,
          type: Option.some("SpaceCZ"),
          station: Option.none(),
          system: Option.some("Achenar"),
          faction: Option.some("Empire"),
          progress: Option.some(500),
          targetindividual: Option.some(2000),
          targetoverall: Option.some(8000),
          settlements: [],
        })

        const updated = new Objective({
          id: objectiveId,
          title: original.title,
          priority: original.priority,
          type: original.type,
          system: original.system,
          faction: original.faction,
          description: original.description,
          startdate: original.startdate,
          enddate: original.enddate,
          targets: [newTarget],
        })

        yield* objectiveRepo.update(updated)

        const saved = yield* objectiveRepo.findById(objectiveId)
        expect(Option.isSome(saved)).toBe(true)

        if (Option.isSome(saved)) {
          const savedObjective = saved.value
          expect(savedObjective.targets.length).toBe(1)
          expect(Option.getOrNull(savedObjective.targets[0]!.type)).toBe("SpaceCZ")
          expect(Option.getOrNull(savedObjective.targets[0]!.system)).toBe("Achenar")
        }
      })
    )
  })

  /**
   * Test 9: DELETE /api/objectives/:id - Delete objective with cascade
   * Verifies that deleting objective also deletes targets and settlements
   */
  it("should delete objective and cascade to targets and settlements", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* PgClient

        const objectiveId = uuid() as ObjectiveId
        const targetId = uuid() as ObjectiveTargetId
        const settlementId = uuid() as ObjectiveTargetSettlementId

        const settlement = new ObjectiveTargetSettlement({
          id: settlementId,
          targetId,
          name: Option.some("Test Settlement"),
          targetindividual: Option.some(100),
          targetoverall: Option.some(500),
          progress: Option.some(50),
        })

        const target = new ObjectiveTarget({
          id: targetId,
          objectiveId,
          type: Option.some("GroundCZ"),
          station: Option.none(),
          system: Option.some("Sol"),
          faction: Option.some("Federation"),
          progress: Option.some(200),
          targetindividual: Option.some(1000),
          targetoverall: Option.some(5000),
          settlements: [settlement],
        })

        const objective = new Objective({
          id: objectiveId,
          title: Option.some("To Be Deleted"),
          priority: Option.some(1),
          type: Option.none(),
          system: Option.none(),
          faction: Option.none(),
          description: Option.none(),
          startdate: Option.none(),
          enddate: Option.none(),
          targets: [target],
        })

        yield* objectiveRepo.create(objective)

        // Verify created
        const created = yield* objectiveRepo.findById(objectiveId)
        expect(Option.isSome(created)).toBe(true)

        // Delete objective
        yield* objectiveRepo.delete(objectiveId)

        // Verify deleted
        const deleted = yield* objectiveRepo.findById(objectiveId)
        expect(Option.isNone(deleted)).toBe(true)

        // Verify targets also deleted (cascade)
        const targetsResult = yield* Effect.tryPromise({
          try: () =>
            client`SELECT id FROM objective_target WHERE objective_id = ${objectiveId}`,
          catch: () => new Error("Query failed"),
        })
        expect(targetsResult.rows.length).toBe(0)

        // Verify settlements also deleted (cascade)
        const settlementsResult = yield* Effect.tryPromise({
          try: () =>
            client`SELECT id FROM objective_target_settlement WHERE target_id = ${targetId}`,
          catch: () => new Error("Query failed"),
        })
        expect(settlementsResult.rows.length).toBe(0)
      })
    )
  })

  /**
   * Test 10: Combined filters - system + faction + active
   * Simulates complex dashboard query with multiple filters
   */
  it("should handle combined filters (system + faction + active)", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* PgClient

        const now = new Date("2026-02-17T12:00:00Z").toISOString()

        // Matching objective
        const matching = new Objective({
          id: uuid() as ObjectiveId,
          title: Option.some("Matching Objective"),
          priority: Option.none(),
          type: Option.none(),
          system: Option.some("Sol"),
          faction: Option.some("Federation Navy"),
          description: Option.none(),
          startdate: Option.some(new Date("2026-02-01T00:00:00Z")),
          enddate: Option.some(new Date("2026-02-28T23:59:59Z")),
          targets: [],
        })

        // Non-matching (different system)
        const wrongSystem = new Objective({
          id: uuid() as ObjectiveId,
          title: Option.some("Wrong System"),
          priority: Option.none(),
          type: Option.none(),
          system: Option.some("Achenar"),
          faction: Option.some("Federation Navy"),
          description: Option.none(),
          startdate: Option.some(new Date("2026-02-01T00:00:00Z")),
          enddate: Option.some(new Date("2026-02-28T23:59:59Z")),
          targets: [],
        })

        // Non-matching (inactive)
        const inactive = new Objective({
          id: uuid() as ObjectiveId,
          title: Option.some("Inactive"),
          priority: Option.none(),
          type: Option.none(),
          system: Option.some("Sol"),
          faction: Option.some("Federation Navy"),
          description: Option.none(),
          startdate: Option.some(new Date("2026-01-01T00:00:00Z")),
          enddate: Option.some(new Date("2026-01-31T23:59:59Z")),
          targets: [],
        })

        yield* objectiveRepo.create(matching)
        yield* objectiveRepo.create(wrongSystem)
        yield* objectiveRepo.create(inactive)

        // Query with all filters
        const result = yield* Effect.tryPromise({
          try: () =>
            client`
                SELECT id FROM objective
                WHERE system = ${"Sol"}
                  AND faction = ${"Federation Navy"}
                  AND startdate <= ${now}
                  AND enddate >= ${now}
              `,
          catch: () => new Error("Query failed"),
        })

        expect((result as any).length).toBe(1)
        expect(String((result as any)[0]![0])).toBe(matching.id)
      })
    )
  })

  /**
   * Test 11: Empty results handling
   * Verifies graceful handling when no objectives match filters
   */
  it("should return empty array when no objectives match filters", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* PgClient

        // Query non-existent system
        const result = yield* Effect.tryPromise({
          try: () =>
            client`SELECT id FROM objective WHERE system = ${"NonExistentSystem"}`,
          catch: () => new Error("Query failed"),
        })

        expect((result as any).length).toBe(0)
      })
    )
  })

  /**
   * Test 12: Query by objective ID
   * Verifies finding specific objective by ID
   */
  it("should find objective by ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const objectiveId = uuid() as ObjectiveId
        const objective = new Objective({
          id: objectiveId,
          title: Option.some("Find Me"),
          priority: Option.some(1),
          type: Option.none(),
          system: Option.none(),
          faction: Option.none(),
          description: Option.none(),
          startdate: Option.none(),
          enddate: Option.none(),
          targets: [],
        })

        yield* objectiveRepo.create(objective)

        const found = yield* objectiveRepo.findById(objectiveId)
        expect(Option.isSome(found)).toBe(true)

        if (Option.isSome(found)) {
          expect(Option.getOrNull(found.value.title)).toBe("Find Me")
        }
      })
    )
  })

  /**
   * Test 13: Not found when querying non-existent ID
   * Verifies proper Option.none() return for missing objectives
   */
  it("should return Option.none() for non-existent objective ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const nonExistentId = uuid() as ObjectiveId
        const result = yield* objectiveRepo.findById(nonExistentId)

        expect(Option.isNone(result)).toBe(true)
      })
    )
  })
})
