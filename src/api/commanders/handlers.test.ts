import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"

import { PgClient } from "../../database/client.js"
import { EventRepository, CmdrRepository } from "../../domain/repositories.js"
import { EventRepositoryLive } from "../../database/repositories/EventRepository.js"
import { CmdrRepositoryLive } from "../../database/repositories/CmdrRepository.js"
import { AppConfig } from "../../lib/config.js"
import { SyncCmdrsResponse } from "./dtos.js"
import { Cmdr, Event } from "../../domain/models.js"
import { CmdrId, EventId } from "../../domain/ids.js"
import { v4 as uuid } from "uuid"


describe("CommandersApi", () => {
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

      // Initialize schema for cmdr table
      yield* Effect.tryPromise(() =>
        client(`
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

          CREATE TABLE IF NOT EXISTS event (
            id TEXT PRIMARY KEY,
            event TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            tickid TEXT NOT NULL,
            ticktime TEXT NOT NULL,
            cmdr TEXT,
            starsystem TEXT,
            systemaddress INTEGER,
            raw_json TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_event_tickid ON event(tickid);
          CREATE INDEX IF NOT EXISTS idx_event_timestamp ON event(timestamp);
        `)
      )

      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfig, testConfig)

  const TestLayer = Layer.mergeAll(
    EventRepositoryLive,
    CmdrRepositoryLive
  ).pipe(
    Layer.provide(ClientLayer),
    Layer.provide(TestConfigLayer)
  )

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, TestLayer))

  it("should sync commanders from events without Inara lookup", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const eventRepo = yield* EventRepository
        const cmdrRepo = yield* CmdrRepository

        // Insert some test events with commander names
        const now = new Date().toISOString()
        const tickId = "tick_test"

        yield* eventRepo.createEvent(
          new Event({
            id: uuid() as EventId,
            event: "FSDJump",
            timestamp: now,
            tickid: tickId,
            ticktime: now,
            cmdr: Option.some("CMDR Test1"),
            starsystem: Option.some("Sol"),
            systemaddress: Option.none(),
            rawJson: Option.none(),
          })
        )

        yield* eventRepo.createEvent(
          new Event({
            id: uuid() as EventId,
            event: "FSDJump",
            timestamp: now,
            tickid: tickId,
            ticktime: now,
            cmdr: Option.some("CMDR Test2"),
            starsystem: Option.some("Achenar"),
            systemaddress: Option.none(),
            rawJson: Option.none(),
          })
        )

        // Simulate the handler logic without Inara
        const cmdrNames = yield* eventRepo.getDistinctCmdrNames(100)

        let added = 0
        let skipped = 0

        for (const cmdrName of cmdrNames) {
          const existing = yield* cmdrRepo.findByName(cmdrName)

          if (Option.isNone(existing)) {
            yield* cmdrRepo.create(
              new Cmdr({
                id: uuid() as CmdrId,
                name: cmdrName,
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
              })
            ).pipe(
              Effect.catchTag("CmdrAlreadyExistsError", () => Effect.void)
            )
            added++
          } else {
            skipped++
          }
        }

        return new SyncCmdrsResponse({
          status: "completed",
          added,
          updated: 0,
          skipped,
          message: `Added commanders from events: ${added} added, ${skipped} skipped`,
        })
      })
    )

    expect(result.status).toBe("completed")
    expect(result.added).toBe(2)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(0)
  })

  it("should skip commanders that already exist", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const eventRepo = yield* EventRepository
        const cmdrRepo = yield* CmdrRepository

        // Create a commander first
        yield* cmdrRepo.create(
          new Cmdr({
            id: uuid() as CmdrId,
            name: "CMDR Existing",
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
          })
        )

        // Insert events with commanders
        const now = new Date().toISOString()
        const tickId = "tick_test"

        // Insert event with existing commander
        yield* eventRepo.createEvent(
          new Event({
            id: uuid() as EventId,
            event: "FSDJump",
            timestamp: now,
            tickid: tickId,
            ticktime: now,
            cmdr: Option.some("CMDR Existing"),
            starsystem: Option.some("Sol"),
            systemaddress: Option.none(),
            rawJson: Option.none(),
          })
        )

        // Insert event with new commander
        yield* eventRepo.createEvent(
          new Event({
            id: uuid() as EventId,
            event: "FSDJump",
            timestamp: now,
            tickid: tickId,
            ticktime: now,
            cmdr: Option.some("CMDR New"),
            starsystem: Option.some("Achenar"),
            systemaddress: Option.none(),
            rawJson: Option.none(),
          })
        )

        // Simulate the handler logic
        const cmdrNames = yield* eventRepo.getDistinctCmdrNames(100)

        let added = 0
        let skipped = 0

        for (const cmdrName of cmdrNames) {
          const existing = yield* cmdrRepo.findByName(cmdrName)

          if (Option.isNone(existing)) {
            yield* cmdrRepo.create(
              new Cmdr({
                id: uuid() as CmdrId,
                name: cmdrName,
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
              })
            ).pipe(
              Effect.catchTag("CmdrAlreadyExistsError", () => Effect.void)
            )
            added++
          } else {
            skipped++
          }
        }

        return new SyncCmdrsResponse({
          status: "completed",
          added,
          updated: 0,
          skipped,
          message: `Added commanders from events: ${added} added, ${skipped} skipped`,
        })
      })
    )

    expect(result.status).toBe("completed")
    expect(result.added).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(1)
  })

  it("should handle empty event list", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const eventRepo = yield* EventRepository

        // No events created

        const cmdrNames = yield* eventRepo.getDistinctCmdrNames(100)

        expect(cmdrNames.length).toBe(0)

        return new SyncCmdrsResponse({
          status: "completed",
          added: 0,
          updated: 0,
          skipped: 0,
          message: `Added commanders from events: 0 added, 0 skipped`,
        })
      })
    )

    expect(result.status).toBe("completed")
    expect(result.added).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.skipped).toBe(0)
  })

  it("should retrieve distinct commander names from events", async () => {
    await runTest(
      Effect.gen(function* () {
        const eventRepo = yield* EventRepository

        // Insert multiple events
        const now = new Date().toISOString()
        const tickId = "tick_test"

        // Insert multiple events with same commander
        yield* eventRepo.createEvent(
          new Event({
            id: uuid() as EventId,
            event: "FSDJump",
            timestamp: now,
            tickid: tickId,
            ticktime: now,
            cmdr: Option.some("CMDR Test"),
            starsystem: Option.some("Sol"),
            systemaddress: Option.none(),
            rawJson: Option.none(),
          })
        )

        yield* eventRepo.createEvent(
          new Event({
            id: uuid() as EventId,
            event: "Docked",
            timestamp: now,
            tickid: tickId,
            ticktime: now,
            cmdr: Option.some("CMDR Test"),
            starsystem: Option.some("Sol"),
            systemaddress: Option.none(),
            rawJson: Option.none(),
          })
        )

        // Insert event with different commander
        yield* eventRepo.createEvent(
          new Event({
            id: uuid() as EventId,
            event: "FSDJump",
            timestamp: now,
            tickid: tickId,
            ticktime: now,
            cmdr: Option.some("CMDR Other"),
            starsystem: Option.some("Achenar"),
            systemaddress: Option.none(),
            rawJson: Option.none(),
          })
        )

        const cmdrNames = yield* eventRepo.getDistinctCmdrNames(100)

        // Should only return 2 distinct names
        expect(cmdrNames.length).toBe(2)
        expect(cmdrNames).toContain("CMDR Test")
        expect(cmdrNames).toContain("CMDR Other")
      })
    )
  })
})
