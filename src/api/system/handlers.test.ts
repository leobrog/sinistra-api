import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { createClient } from "@libsql/client"
import { TursoClient } from "../../database/client.js"
import { EddnRepository } from "../../domain/repositories.js"
import { EddnRepositoryLive } from "../../database/repositories/EddnRepository.js"
import { AppConfig } from "../../lib/config.js"
import {
  EddnSystemInfo,
  EddnFaction,
  EddnConflict,
  EddnPowerplay,
} from "../../domain/models.js"
import {
  EddnSystemInfoId,
  EddnFactionId,
  EddnConflictId,
  EddnPowerplayId,
} from "../../domain/ids.js"
import { handleGetSystemSummary } from "./handlers.js"
import { SystemDetailResponse, SystemListResponse, SystemSearchErrorResponse } from "./dtos.js"
import { v4 as uuid } from "uuid"


describe("System API Integration", () => {
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
        bgs: [],
        shoutout: [],
        conflict: [],
        debug: [],
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

  const ClientLayer = Layer.effect(
    TursoClient,
    Effect.gen(function* () {
      const client = createClient({ url: "file::memory:" })

      yield* Effect.tryPromise(() =>
        client.executeMultiple(`
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
            updated_at TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_eddn_system_info_system_name ON eddn_system_info(system_name);

          CREATE TABLE IF NOT EXISTS eddn_faction (
            id TEXT PRIMARY KEY,
            eddn_message_id TEXT,
            system_name TEXT NOT NULL,
            name TEXT NOT NULL,
            influence REAL,
            state TEXT,
            allegiance TEXT,
            government TEXT,
            recovering_states TEXT,
            active_states TEXT,
            pending_states TEXT,
            updated_at TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_eddn_faction_system_name ON eddn_faction(system_name);
          CREATE INDEX IF NOT EXISTS idx_eddn_faction_name ON eddn_faction(name);

          CREATE TABLE IF NOT EXISTS eddn_conflict (
            id TEXT PRIMARY KEY,
            eddn_message_id TEXT,
            system_name TEXT NOT NULL,
            faction1 TEXT,
            faction2 TEXT,
            stake1 TEXT,
            stake2 TEXT,
            won_days1 INTEGER,
            won_days2 INTEGER,
            status TEXT,
            war_type TEXT,
            updated_at TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_eddn_conflict_system_name ON eddn_conflict(system_name);

          CREATE TABLE IF NOT EXISTS eddn_powerplay (
            id TEXT PRIMARY KEY,
            eddn_message_id TEXT,
            system_name TEXT NOT NULL,
            power TEXT,
            powerplay_state TEXT,
            control_progress INTEGER,
            reinforcement INTEGER,
            undermining INTEGER,
            updated_at TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_eddn_powerplay_system_name ON eddn_powerplay(system_name);
        `)
      )

      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfig, testConfig)

  const TestLayer = EddnRepositoryLive.pipe(
    Layer.provide(ClientLayer),
    Layer.provide(TestConfigLayer)
  )

  const FullLayer = Layer.merge(TestLayer, ClientLayer).pipe(
    Layer.provide(TestConfigLayer)
  )

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, FullLayer))

  /**
   * Test 1: Single system lookup by path parameter
   * Simulates GET /api/system/Sol
   */
  it("should get system details by name", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        // Set up system info
        yield* eddnRepo.upsertSystemInfo(new EddnSystemInfo({
          id: uuid() as EddnSystemInfoId,
          eddnMessageId: Option.none(),
          systemName: "Sol",
          controllingFaction: Option.some("Federation Navy"),
          controllingPower: Option.some("Zachary Hudson"),
          population: Option.some(20000000000),
          security: Option.some("High"),
          government: Option.some("Democracy"),
          allegiance: Option.some("Federation"),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        // Set up a faction in Sol
        yield* eddnRepo.upsertFaction(new EddnFaction({
          id: uuid() as EddnFactionId,
          eddnMessageId: Option.none(),
          systemName: "Sol",
          name: "Federation Navy",
          influence: Option.some(0.65),
          state: Option.some("Boom"),
          allegiance: Option.some("Federation"),
          government: Option.some("Democracy"),
          recoveringStates: Option.none(),
          activeStates: Option.none(),
          pendingStates: Option.none(),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        const result = yield* handleGetSystemSummary(Option.some("Sol"), {})

        expect(result instanceof SystemDetailResponse).toBe(true)

        if (result instanceof SystemDetailResponse) {
          expect(result.system_info.system_name).toBe("Sol")
          expect(result.system_info.controlling_faction).toBe("Federation Navy")
          expect(result.factions.length).toBe(1)
          expect(result.factions[0]!.name).toBe("Federation Navy")
        }
      })
    )
  })

  /**
   * Test 2: System not found by name
   * Simulates GET /api/system/NonExistent
   */
  it("should return error when system not found", async () => {
    await runTest(
      Effect.gen(function* () {
        const result = yield* handleGetSystemSummary(Option.some("NonExistentSystem"), {})

        expect(result instanceof SystemSearchErrorResponse).toBe(true)

        if (result instanceof SystemSearchErrorResponse) {
          expect(result.error).toContain("not found")
          expect(result.count).toBe(0)
        }
      })
    )
  })

  /**
   * Test 3: No filters and no system name → error
   * Simulates GET /api/system with no params
   */
  it("should return error when no filters provided", async () => {
    await runTest(
      Effect.gen(function* () {
        const result = yield* handleGetSystemSummary(Option.none(), {})

        expect(result instanceof SystemSearchErrorResponse).toBe(true)

        if (result instanceof SystemSearchErrorResponse) {
          expect(result.error).toContain("search filter")
        }
      })
    )
  })

  /**
   * Test 4: Filter by faction name
   * Simulates GET /api/system?faction=FederationNavy
   */
  it("should filter systems by faction presence", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        // Set up Sol with Federation Navy
        yield* eddnRepo.upsertSystemInfo(new EddnSystemInfo({
          id: uuid() as EddnSystemInfoId,
          eddnMessageId: Option.none(),
          systemName: "Sol",
          controllingFaction: Option.some("Federation Navy"),
          controllingPower: Option.none(),
          population: Option.some(20000000000),
          security: Option.some("High"),
          government: Option.some("Democracy"),
          allegiance: Option.some("Federation"),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        yield* eddnRepo.upsertFaction(new EddnFaction({
          id: uuid() as EddnFactionId,
          eddnMessageId: Option.none(),
          systemName: "Sol",
          name: "Federation Navy",
          influence: Option.some(0.65),
          state: Option.some("Boom"),
          allegiance: Option.none(),
          government: Option.none(),
          recoveringStates: Option.none(),
          activeStates: Option.none(),
          pendingStates: Option.none(),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        // Set up Achenar with Empire Assembly (no Federation Navy)
        yield* eddnRepo.upsertSystemInfo(new EddnSystemInfo({
          id: uuid() as EddnSystemInfoId,
          eddnMessageId: Option.none(),
          systemName: "Achenar",
          controllingFaction: Option.some("Empire Assembly"),
          controllingPower: Option.none(),
          population: Option.some(5000000000),
          security: Option.some("High"),
          government: Option.some("Dictatorship"),
          allegiance: Option.some("Empire"),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        yield* eddnRepo.upsertFaction(new EddnFaction({
          id: uuid() as EddnFactionId,
          eddnMessageId: Option.none(),
          systemName: "Achenar",
          name: "Empire Assembly",
          influence: Option.some(0.75),
          state: Option.some("None"),
          allegiance: Option.none(),
          government: Option.none(),
          recoveringStates: Option.none(),
          activeStates: Option.none(),
          pendingStates: Option.none(),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        const result = yield* handleGetSystemSummary(Option.none(), { faction: "Federation Navy" })

        expect(result instanceof SystemListResponse).toBe(true)

        if (result instanceof SystemListResponse) {
          expect(result.count).toBe(1)
          expect(result.systems[0]!.system_info.system_name).toBe("Sol")
        }
      })
    )
  })

  /**
   * Test 5: Filter by controlling faction
   * Simulates GET /api/system?controlling_faction=FederationNavy
   */
  it("should filter systems by controlling faction", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        // Two systems with different controlling factions
        yield* eddnRepo.upsertSystemInfo(new EddnSystemInfo({
          id: uuid() as EddnSystemInfoId,
          eddnMessageId: Option.none(),
          systemName: "Sol",
          controllingFaction: Option.some("Federation Navy"),
          controllingPower: Option.none(),
          population: Option.some(20000000000),
          security: Option.some("High"),
          government: Option.some("Democracy"),
          allegiance: Option.some("Federation"),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        yield* eddnRepo.upsertSystemInfo(new EddnSystemInfo({
          id: uuid() as EddnSystemInfoId,
          eddnMessageId: Option.none(),
          systemName: "Achenar",
          controllingFaction: Option.some("Empire Assembly"),
          controllingPower: Option.none(),
          population: Option.some(5000000000),
          security: Option.some("High"),
          government: Option.some("Dictatorship"),
          allegiance: Option.some("Empire"),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        const result = yield* handleGetSystemSummary(Option.none(), { controlling_faction: "Empire Assembly" })

        expect(result instanceof SystemListResponse).toBe(true)

        if (result instanceof SystemListResponse) {
          expect(result.count).toBe(1)
          expect(result.systems[0]!.system_info.system_name).toBe("Achenar")
          expect(result.systems[0]!.system_info.controlling_faction).toBe("Empire Assembly")
        }
      })
    )
  })

  /**
   * Test 6: Filter returns no results
   * Simulates filter that matches nothing
   */
  it("should return error when filter matches no systems", async () => {
    await runTest(
      Effect.gen(function* () {
        const result = yield* handleGetSystemSummary(Option.none(), {
          controlling_faction: "NonExistentFaction",
        })

        expect(result instanceof SystemSearchErrorResponse).toBe(true)

        if (result instanceof SystemSearchErrorResponse) {
          expect(result.count).toBe(0)
        }
      })
    )
  })

  /**
   * Test 7: System with conflict data
   * Verifies conflict data is included in system detail
   */
  it("should include conflict data in system detail", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        yield* eddnRepo.upsertSystemInfo(new EddnSystemInfo({
          id: uuid() as EddnSystemInfoId,
          eddnMessageId: Option.none(),
          systemName: "Deciat",
          controllingFaction: Option.some("Deciat Gang"),
          controllingPower: Option.none(),
          population: Option.some(1000000),
          security: Option.some("Low"),
          government: Option.some("Anarchy"),
          allegiance: Option.some("Independent"),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        yield* eddnRepo.upsertConflict(new EddnConflict({
          id: uuid() as EddnConflictId,
          eddnMessageId: Option.none(),
          systemName: "Deciat",
          faction1: Option.some("Deciat Gang"),
          faction2: Option.some("Deciat Rebels"),
          stake1: Option.some("Starport Alpha"),
          stake2: Option.some("Outpost Beta"),
          wonDays1: Option.some(2),
          wonDays2: Option.some(1),
          status: Option.some("active"),
          warType: Option.some("civilwar"),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        const result = yield* handleGetSystemSummary(Option.some("Deciat"), {})

        expect(result instanceof SystemDetailResponse).toBe(true)

        if (result instanceof SystemDetailResponse) {
          expect(result.conflicts.length).toBe(1)
          expect(result.conflicts[0]!.faction1).toBe("Deciat Gang")
          expect(result.conflicts[0]!.faction2).toBe("Deciat Rebels")
          expect(result.conflicts[0]!.conflict_type).toBe("civilwar")
        }
      })
    )
  })

  /**
   * Test 8: System with powerplay data
   * Verifies powerplay data is included in system detail
   */
  it("should include powerplay data in system detail", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        yield* eddnRepo.upsertSystemInfo(new EddnSystemInfo({
          id: uuid() as EddnSystemInfoId,
          eddnMessageId: Option.none(),
          systemName: "Cubeo",
          controllingFaction: Option.some("Cubeo Patrons"),
          controllingPower: Option.some("Arissa Lavigny-Duval"),
          population: Option.some(12000000000),
          security: Option.some("High"),
          government: Option.some("Patronage"),
          allegiance: Option.some("Empire"),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        yield* eddnRepo.upsertPowerplay(new EddnPowerplay({
          id: uuid() as EddnPowerplayId,
          eddnMessageId: Option.none(),
          systemName: "Cubeo",
          power: Option.some("Arissa Lavigny-Duval"),
          powerplayState: Option.some("Controlled"),
          controlProgress: Option.none(),
          reinforcement: Option.none(),
          undermining: Option.none(),
          updatedAt: new Date("2026-02-17T10:00:00Z"),
        }))

        const result = yield* handleGetSystemSummary(Option.some("Cubeo"), {})

        expect(result instanceof SystemDetailResponse).toBe(true)

        if (result instanceof SystemDetailResponse) {
          expect(result.powerplays.length).toBe(1)
          expect(result.powerplays[0]!.powerplay_state).toBe("Controlled")
        }
      })
    )
  })

  /**
   * Test 9: Filter by system name pattern
   * Simulates search with partial system name
   */
  it("should filter systems by name pattern", async () => {
    await runTest(
      Effect.gen(function* () {
        const eddnRepo = yield* EddnRepository

        // Set up multiple systems with similar names
        const systems = ["Sol", "Solati", "Procyon"]
        for (const sysName of systems) {
          yield* eddnRepo.upsertSystemInfo(new EddnSystemInfo({
            id: uuid() as EddnSystemInfoId,
            eddnMessageId: Option.none(),
            systemName: sysName,
            controllingFaction: Option.none(),
            controllingPower: Option.none(),
            population: Option.some(1000000),
            security: Option.none(),
            government: Option.none(),
            allegiance: Option.none(),
            updatedAt: new Date("2026-02-17T10:00:00Z"),
          }))
        }

        const result = yield* handleGetSystemSummary(Option.none(), { system_name: "Sol" })

        expect(result instanceof SystemListResponse).toBe(true)

        if (result instanceof SystemListResponse) {
          // Should find Sol and Solati (LIKE pattern)
          expect(result.count).toBeGreaterThanOrEqual(1)
          const names = result.systems.map((s) => s.system_info.system_name)
          expect(names).toContain("Sol")
        }
      })
    )
  })
})
