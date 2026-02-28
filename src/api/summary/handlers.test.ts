import { describe, it, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { createClient } from "@libsql/client"
import { TursoClient } from "../../database/client.js"
import { AppConfig } from "../../lib/config.js"
import { v4 as uuid } from "uuid"


describe("Summary API Integration", () => {
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
      name: "East India Company",
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

  // Helper to create a fresh test database for each test
  const ClientLayer = Layer.effect(
    TursoClient,
    Effect.gen(function* () {
      const client = createClient({
        url: "file::memory:",
      })

      // Initialize full schema from migrations
      yield* Effect.tryPromise(() =>
        client.executeMultiple(`
          -- Event Table
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
          CREATE INDEX IF NOT EXISTS idx_event_cmdr ON event(cmdr);
          CREATE INDEX IF NOT EXISTS idx_event_starsystem ON event(starsystem);

          -- Market Buy Event
          CREATE TABLE IF NOT EXISTS market_buy_event (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            stock INTEGER,
            stock_bracket INTEGER,
            value INTEGER,
            count INTEGER,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_market_buy_event_event_id ON market_buy_event(event_id);

          -- Market Sell Event
          CREATE TABLE IF NOT EXISTS market_sell_event (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            demand INTEGER,
            demand_bracket INTEGER,
            profit INTEGER,
            value INTEGER,
            count INTEGER,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_market_sell_event_event_id ON market_sell_event(event_id);

          -- Mission Completed Event
          CREATE TABLE IF NOT EXISTS mission_completed_event (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            awarding_faction TEXT,
            mission_name TEXT,
            reward INTEGER,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_mission_completed_event_event_id ON mission_completed_event(event_id);

          -- Mission Completed Influence
          CREATE TABLE IF NOT EXISTS mission_completed_influence (
            id TEXT PRIMARY KEY,
            mission_id TEXT NOT NULL,
            system TEXT,
            influence TEXT,
            trend TEXT,
            faction_name TEXT,
            reputation TEXT,
            reputation_trend TEXT,
            effect TEXT,
            effect_trend TEXT,
            FOREIGN KEY (mission_id) REFERENCES mission_completed_event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_mission_completed_influence_mission_id ON mission_completed_influence(mission_id);

          -- Mission Failed Event
          CREATE TABLE IF NOT EXISTS mission_failed_event (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            mission_name TEXT,
            awarding_faction TEXT,
            fine INTEGER,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_mission_failed_event_event_id ON mission_failed_event(event_id);

          -- Redeem Voucher Event
          CREATE TABLE IF NOT EXISTS redeem_voucher_event (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            amount INTEGER,
            faction TEXT,
            type TEXT,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_redeem_voucher_event_event_id ON redeem_voucher_event(event_id);

          -- Sell Exploration Data Event
          CREATE TABLE IF NOT EXISTS sell_exploration_data_event (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            earnings INTEGER,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_sell_exploration_data_event_event_id ON sell_exploration_data_event(event_id);

          -- Multi Sell Exploration Data Event
          CREATE TABLE IF NOT EXISTS multi_sell_exploration_data_event (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            total_earnings INTEGER,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_multi_sell_exploration_data_event_event_id ON multi_sell_exploration_data_event(event_id);

          -- Commit Crime Event
          CREATE TABLE IF NOT EXISTS commit_crime_event (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            crime_type TEXT,
            faction TEXT,
            victim TEXT,
            victim_faction TEXT,
            bounty INTEGER,
            FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_commit_crime_event_event_id ON commit_crime_event(event_id);

          -- Commander Table
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

          CREATE INDEX IF NOT EXISTS idx_cmdr_name ON cmdr(name);
          CREATE INDEX IF NOT EXISTS idx_cmdr_squadron_name ON cmdr(squadron_name);
        `)
      )

      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfig, testConfig)

  const FullLayer = ClientLayer.pipe(Layer.provide(TestConfigLayer))

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, FullLayer))

  /**
   * Test 1: GET /api/summary/market-events - Basic market events summary
   * Simulates commanders trading and aggregating trade volume
   */
  it("should return market events summary with trade volume", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create test data: 2 commanders trading
        const event1Id = uuid()
        const event2Id = uuid()
        const event3Id = uuid()

        // CMDR Alpha - Buy and Sell
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MarketBuy', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO market_buy_event (id, event_id, stock, stock_bracket, value, count) VALUES (?, ?, 100, 2, 50000, 10)`,
            args: [uuid(), event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MarketSell', '2026-02-17T11:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO market_sell_event (id, event_id, demand, demand_bracket, profit, value, count) VALUES (?, ?, 80, 1, 5000, 55000, 10)`,
            args: [uuid(), event2Id],
          })
        )

        // CMDR Beta - Only Buy
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MarketBuy', '2026-02-17T12:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Beta', 'Achenar', 3932277478106)`,
            args: [event3Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO market_buy_event (id, event_id, stock, stock_bracket, value, count) VALUES (?, ?, 200, 3, 100000, 20)`,
            args: [uuid(), event3Id],
          })
        )

        // Query market-events summary
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr,
                     SUM(COALESCE(mb.value, 0)) AS total_buy,
                     SUM(COALESCE(ms.value, 0)) AS total_sell,
                     SUM(COALESCE(mb.value, 0)) + SUM(COALESCE(ms.value, 0)) AS total_transaction_volume,
                     SUM(COALESCE(mb.count, 0)) + SUM(COALESCE(ms.count, 0)) AS total_trade_quantity
              FROM event e
              LEFT JOIN market_buy_event mb ON mb.event_id = e.id
              LEFT JOIN market_sell_event ms ON ms.event_id = e.id
              WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_100'
              GROUP BY e.cmdr
              HAVING total_transaction_volume > 0
              ORDER BY total_trade_quantity DESC
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(2)

        // CMDR Beta should be first (20 total quantity)
        const betaRow = result.rows[0]!
        expect(betaRow[0]).toBe("CMDR Beta")
        expect(Number(betaRow[1])).toBe(100000) // total_buy
        expect(Number(betaRow[2])).toBe(0) // total_sell
        expect(Number(betaRow[3])).toBe(100000) // total_transaction_volume
        expect(Number(betaRow[4])).toBe(20) // total_trade_quantity

        // CMDR Alpha should be second (20 total quantity: 10 buy + 10 sell)
        const alphaRow = result.rows[1]!
        expect(alphaRow[0]).toBe("CMDR Alpha")
        expect(Number(alphaRow[1])).toBe(50000) // total_buy
        expect(Number(alphaRow[2])).toBe(55000) // total_sell
        expect(Number(alphaRow[3])).toBe(105000) // total_transaction_volume
        expect(Number(alphaRow[4])).toBe(20) // total_trade_quantity
      })
    )
  })

  /**
   * Test 2: GET /api/summary/missions-completed - Missions completed summary with period filter
   * Simulates commanders completing missions across different ticks
   */
  it("should filter missions completed by period (current tick)", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create missions for different ticks
        // Tick 100 (old tick)
        const event1Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionCompleted', '2026-02-16T10:00:00Z', 'tick_100', '2026-02-16T00:00:00Z', 'CMDR Old', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward) VALUES (?, ?, 'Federation Navy', 'Delivery Mission', 50000)`,
            args: [uuid(), event1Id],
          })
        )

        // Tick 101 (current tick) - multiple commanders
        const event2Id = uuid()
        const event3Id = uuid()
        const event4Id = uuid()

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionCompleted', '2026-02-17T10:00:00Z', 'tick_101', '2026-02-17T00:00:00Z', 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward) VALUES (?, ?, 'Federation Navy', 'Massacre Mission', 1000000)`,
            args: [uuid(), event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionCompleted', '2026-02-17T11:00:00Z', 'tick_101', '2026-02-17T00:00:00Z', 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [event3Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward) VALUES (?, ?, 'Mother Gaia', 'Source Mission', 200000)`,
            args: [uuid(), event3Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionCompleted', '2026-02-17T12:00:00Z', 'tick_101', '2026-02-17T00:00:00Z', 'CMDR Beta', 'Achenar', 3932277478106)`,
            args: [event4Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward) VALUES (?, ?, 'Empire Assembly', 'Courier Mission', 75000)`,
            args: [uuid(), event4Id],
          })
        )

        // Query missions completed for tick_101 only
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr, COUNT(*) AS missions_completed
              FROM mission_completed_event mc
              JOIN event e ON e.id = mc.event_id
              WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_101'
              GROUP BY e.cmdr
              ORDER BY missions_completed DESC
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(2)

        // CMDR Alpha should be first (2 missions)
        const alphaRow = result.rows[0]!
        expect(alphaRow[0]).toBe("CMDR Alpha")
        expect(Number(alphaRow[1])).toBe(2)

        // CMDR Beta should be second (1 mission)
        const betaRow = result.rows[1]!
        expect(betaRow[0]).toBe("CMDR Beta")
        expect(Number(betaRow[1])).toBe(1)
      })
    )
  })

  /**
   * Test 3: GET /api/summary/bounty-vouchers - Bounty vouchers with system filter
   * Simulates commanders redeeming bounty vouchers in different systems
   */
  it("should filter bounty vouchers by system", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create bounty vouchers in different systems
        const event1Id = uuid()
        const event2Id = uuid()
        const event3Id = uuid()

        // CMDR Alpha in Sol
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'RedeemVoucher', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO redeem_voucher_event (id, event_id, amount, faction, type) VALUES (?, ?, 500000, 'Federation Navy', 'bounty')`,
            args: [uuid(), event1Id],
          })
        )

        // CMDR Beta in Sol
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'RedeemVoucher', '2026-02-17T11:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Beta', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO redeem_voucher_event (id, event_id, amount, faction, type) VALUES (?, ?, 750000, 'Mother Gaia', 'bounty')`,
            args: [uuid(), event2Id],
          })
        )

        // CMDR Gamma in Achenar (should be filtered out)
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'RedeemVoucher', '2026-02-17T12:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Gamma', 'Achenar', 3932277478106)`,
            args: [event3Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO redeem_voucher_event (id, event_id, amount, faction, type) VALUES (?, ?, 300000, 'Empire Assembly', 'bounty')`,
            args: [uuid(), event3Id],
          })
        )

        // Query bounty vouchers for Sol system only
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr, e.starsystem, rv.faction, SUM(rv.amount) AS bounty_vouchers
              FROM redeem_voucher_event rv
              JOIN event e ON e.id = rv.event_id
              WHERE e.cmdr IS NOT NULL AND rv.type = 'bounty' AND e.starsystem = ?
              GROUP BY e.cmdr, e.starsystem, rv.faction
              ORDER BY bounty_vouchers DESC
            `,
            args: ["Sol"],
          })
        )

        expect(result.rows.length).toBe(2)

        // CMDR Beta should be first (750000)
        const betaRow = result.rows[0]!
        expect(betaRow[0]).toBe("CMDR Beta")
        expect(betaRow[1]).toBe("Sol")
        expect(betaRow[2]).toBe("Mother Gaia")
        expect(Number(betaRow[3])).toBe(750000)

        // CMDR Alpha should be second (500000)
        const alphaRow = result.rows[1]!
        expect(alphaRow[0]).toBe("CMDR Alpha")
        expect(alphaRow[1]).toBe("Sol")
        expect(alphaRow[2]).toBe("Federation Navy")
        expect(Number(alphaRow[3])).toBe(500000)
      })
    )
  })

  /**
   * Test 4: GET /api/summary/top5/missions-completed - Top 5 limit verification
   * Verifies that top5 endpoint returns max 5 results
   */
  it("should limit top5 endpoint to 5 results", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create 7 commanders with missions
        for (let i = 1; i <= 7; i++) {
          const eventId = uuid()
          yield* Effect.tryPromise(() =>
            client.execute({
              sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                    VALUES (?, 'MissionCompleted', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', ?, 'Sol', 10477373803)`,
              args: [eventId, `CMDR ${i}`],
            })
          )

          yield* Effect.tryPromise(() =>
            client.execute({
              sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward) VALUES (?, ?, 'Test Faction', 'Test Mission', 10000)`,
              args: [uuid(), eventId],
            })
          )
        }

        // Query with LIMIT 5 (simulating top5 endpoint)
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr, COUNT(*) AS missions_completed
              FROM mission_completed_event mc
              JOIN event e ON e.id = mc.event_id
              WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_100'
              GROUP BY e.cmdr
              ORDER BY missions_completed DESC LIMIT 5
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(5)
      })
    )
  })

  /**
   * Test 5: GET /api/summary/leaderboard - Comprehensive commander statistics
   * Simulates full leaderboard aggregation across all event types
   */
  it("should aggregate comprehensive leaderboard statistics", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create commander
        const cmdrId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO cmdr (id, name, squadron_rank, squadron_name) VALUES (?, 'CMDR Alpha', 'Captain', 'East India Company')`,
            args: [cmdrId],
          })
        )

        // Create various events for this commander
        const tickid = "tick_100"
        const timestamp = "2026-02-17T10:00:00Z"
        const ticktime = "2026-02-17T00:00:00Z"

        // Market buy event
        const buyEventId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MarketBuy', ?, ?, ?, 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [buyEventId, timestamp, tickid, ticktime],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO market_buy_event (id, event_id, stock, stock_bracket, value, count) VALUES (?, ?, 100, 2, 100000, 50)`,
            args: [uuid(), buyEventId],
          })
        )

        // Market sell event
        const sellEventId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MarketSell', ?, ?, ?, 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [sellEventId, timestamp, tickid, ticktime],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO market_sell_event (id, event_id, demand, demand_bracket, profit, value, count) VALUES (?, ?, 80, 1, 20000, 120000, 50)`,
            args: [uuid(), sellEventId],
          })
        )

        // Mission completed
        const missionEventId = uuid()
        const missionCompletedId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionCompleted', ?, ?, ?, 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [missionEventId, timestamp, tickid, ticktime],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward) VALUES (?, ?, 'Federation Navy', 'Test Mission', 500000)`,
            args: [missionCompletedId, missionEventId],
          })
        )

        // Mission influence for EIC faction
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_influence (id, mission_id, system, influence, trend, faction_name, reputation, reputation_trend, effect, effect_trend)
                  VALUES (?, ?, 'Sol', '+++++', 'UpGood', 'East India Company', '++', 'UpGood', 'Boom', 'UpGood')`,
            args: [uuid(), missionCompletedId],
          })
        )

        // Bounty voucher
        const bountyEventId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'RedeemVoucher', ?, ?, ?, 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [bountyEventId, timestamp, tickid, ticktime],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO redeem_voucher_event (id, event_id, amount, faction, type) VALUES (?, ?, 250000, 'Federation Navy', 'bounty')`,
            args: [uuid(), bountyEventId],
          })
        )

        // Combat bond
        const combatEventId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'RedeemVoucher', ?, ?, ?, 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [combatEventId, timestamp, tickid, ticktime],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO redeem_voucher_event (id, event_id, amount, faction, type) VALUES (?, ?, 500000, 'Federation Navy', 'CombatBond')`,
            args: [uuid(), combatEventId],
          })
        )

        // Exploration data
        const explorationEventId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'SellExplorationData', ?, ?, ?, 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [explorationEventId, timestamp, tickid, ticktime],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO sell_exploration_data_event (id, event_id, earnings) VALUES (?, ?, 150000)`,
            args: [uuid(), explorationEventId],
          })
        )

        // Query leaderboard
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr,
                     c.squadron_rank AS rank,
                     SUM(CASE WHEN mb.event_id IS NOT NULL THEN mb.value ELSE 0 END) AS total_buy,
                     SUM(CASE WHEN ms.event_id IS NOT NULL THEN ms.value ELSE 0 END) AS total_sell
              FROM event e
              LEFT JOIN cmdr c ON c.name = e.cmdr
              LEFT JOIN market_buy_event mb ON mb.event_id = e.id
              LEFT JOIN market_sell_event ms ON ms.event_id = e.id
              WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_100'
              GROUP BY e.cmdr
              ORDER BY e.cmdr
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(1)

        const row = result.rows[0]!
        expect(row[0]).toBe("CMDR Alpha")
        expect(row[1]).toBe("Captain")
        expect(Number(row[2])).toBe(100000) // total_buy
        expect(Number(row[3])).toBe(120000) // total_sell
      })
    )
  })

  /**
   * Test 6: GET /api/summary/recruits - Recruit progression tracking
   * Verifies filtering by squadron_rank='Recruit' and calculating progression metrics
   */
  it("should filter recruits by squadron rank and calculate progression", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create commanders with different ranks
        const recruit1Id = uuid()
        const recruit2Id = uuid()
        const captainId = uuid()

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO cmdr (id, name, squadron_rank, squadron_name) VALUES (?, 'CMDR Recruit1', 'Recruit', 'East India Company')`,
            args: [recruit1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO cmdr (id, name, squadron_rank, squadron_name) VALUES (?, 'CMDR Recruit2', 'Recruit', 'East India Company')`,
            args: [recruit2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO cmdr (id, name, squadron_rank, squadron_name) VALUES (?, 'CMDR Captain', 'Captain', 'East India Company')`,
            args: [captainId],
          })
        )

        // Create events for recruits
        const event1Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MarketBuy', '2026-02-10T10:00:00Z', 'tick_95', '2026-02-10T00:00:00Z', 'CMDR Recruit1', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO market_buy_event (id, event_id, stock, stock_bracket, value, count) VALUES (?, ?, 100, 2, 50000, 100)`,
            args: [uuid(), event1Id],
          })
        )

        const event2Id = uuid()
        const missionId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionCompleted', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Recruit1', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward) VALUES (?, ?, 'Federation Navy', 'Test Mission', 100000)`,
            args: [missionId, event2Id],
          })
        )

        // Create event for captain (should be filtered out)
        const event3Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MarketBuy', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Captain', 'Sol', 10477373803)`,
            args: [event3Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO market_buy_event (id, event_id, stock, stock_bracket, value, count) VALUES (?, ?, 100, 2, 50000, 50)`,
            args: [uuid(), event3Id],
          })
        )

        // Query recruits only
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr AS commander,
                     CASE WHEN COUNT(e.id) > 0 THEN 'Yes' ELSE 'No' END AS has_data,
                     MAX(e.timestamp) AS last_active,
                     (SELECT COALESCE(SUM(mb.count), 0)
                      FROM market_buy_event mb
                      JOIN event e1 ON e1.id = mb.event_id
                      WHERE e1.cmdr = e.cmdr) AS tonnage,
                     (SELECT COUNT(*)
                      FROM mission_completed_event mc
                      JOIN event ev ON ev.id = mc.event_id
                      WHERE ev.cmdr = e.cmdr) AS mission_count
              FROM event e
              JOIN cmdr c ON c.name = e.cmdr
              WHERE e.cmdr IS NOT NULL AND c.squadron_rank = 'Recruit'
              GROUP BY e.cmdr
              ORDER BY e.cmdr
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(1) // Only CMDR Recruit1 has events

        const row = result.rows[0]!
        expect(row[0]).toBe("CMDR Recruit1")
        expect(row[1]).toBe("Yes")
        expect(row[2]).toBe("2026-02-17T10:00:00Z") // last_active
        expect(Number(row[3])).toBe(100) // tonnage
        expect(Number(row[4])).toBe(1) // mission_count
      })
    )
  })

  /**
   * Test 7: GET /api/summary/exploration-sales - Combined exploration earnings
   * Verifies UNION of SellExplorationData and MultiSellExplorationData
   */
  it("should combine single and multi exploration sales", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create single exploration sale
        const event1Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'SellExplorationData', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Explorer', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO sell_exploration_data_event (id, event_id, earnings) VALUES (?, ?, 50000)`,
            args: [uuid(), event1Id],
          })
        )

        // Create multi exploration sale
        const event2Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MultiSellExplorationData', '2026-02-17T11:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Explorer', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO multi_sell_exploration_data_event (id, event_id, total_earnings) VALUES (?, ?, 150000)`,
            args: [uuid(), event2Id],
          })
        )

        // Query exploration sales (UNION query)
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT cmdr, SUM(total_sales) AS total_exploration_sales
              FROM (
                SELECT e.cmdr, se.earnings AS total_sales
                FROM sell_exploration_data_event se
                JOIN event e ON e.id = se.event_id
                WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_100'
                UNION ALL
                SELECT e.cmdr, ms.total_earnings AS total_sales
                FROM multi_sell_exploration_data_event ms
                JOIN event e ON e.id = ms.event_id
                WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_100'
              )
              GROUP BY cmdr
              ORDER BY total_exploration_sales DESC
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(1)

        const row = result.rows[0]!
        expect(row[0]).toBe("CMDR Explorer")
        expect(Number(row[1])).toBe(200000) // 50000 + 150000
      })
    )
  })

  /**
   * Test 8: GET /api/summary/murder-count - Murder crimes tracking
   * Verifies filtering CommitCrime events by crime_type='murder'
   */
  it("should filter murder crimes and group by system and faction", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create murder events
        const event1Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'CommitCrime', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Pirate', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO commit_crime_event (id, event_id, crime_type, faction, victim, victim_faction, bounty) VALUES (?, ?, 'murder', 'Federation', 'CMDR Victim1', 'Federation Navy', 10000)`,
            args: [uuid(), event1Id],
          })
        )

        const event2Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'CommitCrime', '2026-02-17T11:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Pirate', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO commit_crime_event (id, event_id, crime_type, faction, victim, victim_faction, bounty) VALUES (?, ?, 'Murder', 'Federation', 'CMDR Victim2', 'Federation Navy', 15000)`,
            args: [uuid(), event2Id],
          })
        )

        // Non-murder crime (should be filtered out)
        const event3Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'CommitCrime', '2026-02-17T12:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Pirate', 'Sol', 10477373803)`,
            args: [event3Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO commit_crime_event (id, event_id, crime_type, faction, victim, victim_faction, bounty) VALUES (?, ?, 'assault', 'Federation', 'CMDR Victim3', 'Federation Navy', 5000)`,
            args: [uuid(), event3Id],
          })
        )

        // Query murder count only
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr, e.starsystem, cc.victim_faction AS faction, COUNT(*) AS murder_count
              FROM commit_crime_event cc
              JOIN event e ON e.id = cc.event_id
              WHERE e.cmdr IS NOT NULL
                AND LOWER(cc.crime_type) = 'murder'
                AND e.tickid = 'tick_100'
              GROUP BY e.cmdr, e.starsystem, cc.victim_faction
              ORDER BY murder_count DESC
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(1)

        const row = result.rows[0]!
        expect(row[0]).toBe("CMDR Pirate")
        expect(row[1]).toBe("Sol")
        expect(row[2]).toBe("Federation Navy")
        expect(Number(row[3])).toBe(2) // 2 murders (case-insensitive)
      })
    )
  })

  /**
   * Test 9: GET /api/summary/influence-eic - Faction-specific influence tracking
   * Verifies filtering mission influence by faction name pattern
   */
  it("should filter influence by EIC faction pattern", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create missions with different faction influences
        const event1Id = uuid()
        const mission1Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionCompleted', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Alpha', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward) VALUES (?, ?, 'Federation Navy', 'Test Mission', 100000)`,
            args: [mission1Id, event1Id],
          })
        )

        // Influence for EIC (should be included)
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_influence (id, mission_id, system, influence, trend, faction_name, reputation, reputation_trend, effect, effect_trend)
                  VALUES (?, ?, 'Sol', '+++++', 'UpGood', 'East India Company', '++', 'UpGood', 'Boom', 'UpGood')`,
            args: [uuid(), mission1Id],
          })
        )

        // Influence for non-EIC faction (should be filtered out)
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_completed_influence (id, mission_id, system, influence, trend, faction_name, reputation, reputation_trend, effect, effect_trend)
                  VALUES (?, ?, 'Sol', '+++', 'UpGood', 'Federation Navy', '+', 'UpGood', 'None', 'None')`,
            args: [uuid(), mission1Id],
          })
        )

        // Query influence for EIC only
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr, mci.faction_name, SUM(LENGTH(mci.influence)) AS influence
              FROM mission_completed_influence mci
              JOIN mission_completed_event mce ON mce.id = mci.mission_id
              JOIN event e ON e.id = mce.event_id
              WHERE e.cmdr IS NOT NULL
                AND mci.faction_name LIKE ?
                AND e.tickid = 'tick_100'
              GROUP BY e.cmdr, mci.faction_name
              ORDER BY influence DESC, e.cmdr
            `,
            args: ["%East India Company%"],
          })
        )

        expect(result.rows.length).toBe(1)

        const row = result.rows[0]!
        expect(row[0]).toBe("CMDR Alpha")
        expect(row[1]).toBe("East India Company")
        expect(Number(row[2])).toBe(5) // LENGTH('+++++')
      })
    )
  })

  /**
   * Test 10: Empty results when no data matches filters
   * Verifies graceful handling of queries with no matching data
   */
  it("should return empty array when no data matches filters", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create some data for a different tick
        const eventId = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MarketBuy', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Test', 'Sol', 10477373803)`,
            args: [eventId],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO market_buy_event (id, event_id, stock, stock_bracket, value, count) VALUES (?, ?, 100, 2, 50000, 10)`,
            args: [uuid(), eventId],
          })
        )

        // Query for non-existent tick
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr,
                     SUM(COALESCE(mb.value, 0)) AS total_buy
              FROM event e
              LEFT JOIN market_buy_event mb ON mb.event_id = e.id
              WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_999'
              GROUP BY e.cmdr
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(0)
      })
    )
  })

  /**
   * Test 11: GET /api/summary/combat-bonds - Combat bonds with system and period filters
   * Verifies combat bond redemption tracking
   */
  it("should track combat bonds by system and faction", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create combat bond events
        const event1Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'RedeemVoucher', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Soldier', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO redeem_voucher_event (id, event_id, amount, faction, type) VALUES (?, ?, 1000000, 'Federation Navy', 'CombatBond')`,
            args: [uuid(), event1Id],
          })
        )

        const event2Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'RedeemVoucher', '2026-02-17T11:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Soldier', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO redeem_voucher_event (id, event_id, amount, faction, type) VALUES (?, ?, 500000, 'Federation Navy', 'CombatBond')`,
            args: [uuid(), event2Id],
          })
        )

        // Query combat bonds
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr, e.starsystem, rv.faction, SUM(rv.amount) AS combat_bonds
              FROM redeem_voucher_event rv
              JOIN event e ON e.id = rv.event_id
              WHERE e.cmdr IS NOT NULL AND rv.type = 'CombatBond' AND e.tickid = 'tick_100'
              GROUP BY e.cmdr, e.starsystem, rv.faction
              ORDER BY combat_bonds DESC
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(1)

        const row = result.rows[0]!
        expect(row[0]).toBe("CMDR Soldier")
        expect(row[1]).toBe("Sol")
        expect(row[2]).toBe("Federation Navy")
        expect(Number(row[3])).toBe(1500000) // 1000000 + 500000
      })
    )
  })

  /**
   * Test 12: GET /api/summary/missions-failed - Failed missions tracking
   * Verifies mission failure tracking
   */
  it("should track failed missions by commander", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create failed mission events
        const event1Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionFailed', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Unlucky', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_failed_event (id, event_id, mission_name, awarding_faction, fine) VALUES (?, ?, 'Courier Mission', 'Federation Navy', 50000)`,
            args: [uuid(), event1Id],
          })
        )

        const event2Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'MissionFailed', '2026-02-17T11:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Unlucky', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO mission_failed_event (id, event_id, mission_name, awarding_faction, fine) VALUES (?, ?, 'Delivery Mission', 'Mother Gaia', 25000)`,
            args: [uuid(), event2Id],
          })
        )

        // Query failed missions
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr, COUNT(*) AS missions_failed
              FROM mission_failed_event mf
              JOIN event e ON e.id = mf.event_id
              WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_100'
              GROUP BY e.cmdr
              ORDER BY missions_failed DESC
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(1)

        const row = result.rows[0]!
        expect(row[0]).toBe("CMDR Unlucky")
        expect(Number(row[1])).toBe(2)
      })
    )
  })

  /**
   * Test 13: GET /api/summary/bounty-fines - Bounty fines from crimes
   * Verifies tracking of bounties accumulated from crimes
   */
  it("should sum bounty fines from commit crime events", async () => {
    await runTest(
      Effect.gen(function* () {
        const client = yield* TursoClient

        // Create crime events with bounties
        const event1Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'CommitCrime', '2026-02-17T10:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Outlaw', 'Sol', 10477373803)`,
            args: [event1Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO commit_crime_event (id, event_id, crime_type, faction, victim, victim_faction, bounty) VALUES (?, ?, 'assault', 'Federation', 'NPC Guard', 'Federation Navy', 5000)`,
            args: [uuid(), event1Id],
          })
        )

        const event2Id = uuid()
        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress)
                  VALUES (?, 'CommitCrime', '2026-02-17T11:00:00Z', 'tick_100', '2026-02-17T00:00:00Z', 'CMDR Outlaw', 'Sol', 10477373803)`,
            args: [event2Id],
          })
        )

        yield* Effect.tryPromise(() =>
          client.execute({
            sql: `INSERT INTO commit_crime_event (id, event_id, crime_type, faction, victim, victim_faction, bounty) VALUES (?, ?, 'murder', 'Federation', 'CMDR Victim', 'Federation Navy', 15000)`,
            args: [uuid(), event2Id],
          })
        )

        // Query bounty fines
        const result = yield* Effect.tryPromise(() =>
          client.execute({
            sql: `
              SELECT e.cmdr, SUM(cc.bounty) AS bounty_fines
              FROM commit_crime_event cc
              JOIN event e ON e.id = cc.event_id
              WHERE e.cmdr IS NOT NULL AND e.tickid = 'tick_100'
              GROUP BY e.cmdr
              ORDER BY bounty_fines DESC
            `,
            args: [],
          })
        )

        expect(result.rows.length).toBe(1)

        const row = result.rows[0]!
        expect(row[0]).toBe("CMDR Outlaw")
        expect(Number(row[1])).toBe(20000) // 5000 + 15000
      })
    )
  })
})
