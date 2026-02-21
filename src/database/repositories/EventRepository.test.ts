import { describe, it, expect } from "bun:test";
import { Effect, Layer, Option } from "effect";
import { EventRepository } from "../../domain/repositories.ts";
import { EventRepositoryLive } from "./EventRepository.ts";
import { TursoClient } from "../client.ts";
import { createClient } from "@libsql/client";
import {
  EventId,
  MarketBuyEventId,
  MarketSellEventId,
  MissionCompletedEventId,
} from "../../domain/ids.ts";
import {
  Event,
  MarketBuyEvent,
  MarketSellEvent,
  MissionCompletedEvent,
} from "../../domain/models.ts";

// Helper to provide a fresh Test Layer for each test
const ClientLayer = Layer.effect(
  TursoClient,
  Effect.gen(function* () {
    const client = createClient({
      url: "file::memory:",
    });

    // Initialize Schema - Main event table + all sub-event tables
    yield* Effect.tryPromise(() =>
      client.executeMultiple(`
        CREATE TABLE event (
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

        CREATE INDEX idx_event_tickid ON event(tickid);
        CREATE INDEX idx_event_timestamp ON event(timestamp);

        CREATE TABLE market_buy_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          stock INTEGER,
          stock_bracket INTEGER,
          value INTEGER,
          count INTEGER,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE market_sell_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          demand INTEGER,
          demand_bracket INTEGER,
          profit INTEGER,
          value INTEGER,
          count INTEGER,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE mission_completed_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          awarding_faction TEXT,
          mission_name TEXT,
          reward INTEGER,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE faction_kill_bond_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          killer_ship TEXT,
          awarding_faction TEXT,
          victim_faction TEXT,
          reward INTEGER,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE mission_failed_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          mission_name TEXT,
          awarding_faction TEXT,
          fine INTEGER,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE multi_sell_exploration_data_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          total_earnings INTEGER,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE redeem_voucher_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          amount INTEGER,
          faction TEXT,
          type TEXT,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE sell_exploration_data_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          earnings INTEGER,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE commit_crime_event (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          crime_type TEXT,
          faction TEXT,
          victim TEXT,
          victim_faction TEXT,
          bounty INTEGER,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE synthetic_ground_cz (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          cz_type TEXT,
          settlement TEXT,
          faction TEXT,
          cmdr TEXT,
          station_faction_name TEXT,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );

        CREATE TABLE synthetic_cz (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          cz_type TEXT,
          faction TEXT,
          cmdr TEXT,
          station_faction_name TEXT,
          FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
        );
      `)
    );

    return client;
  })
);

const TestLayer = EventRepositoryLive.pipe(Layer.provide(ClientLayer));

describe("EventRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, EventRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer));

  it("should create and retrieve a basic event", async () => {
    const event = new Event({
      id: EventId.make("evt_001"),
      event: "MarketBuy",
      timestamp: "2024-01-15T10:30:00Z",
      tickid: "tick_123",
      ticktime: "2024-01-15T00:00:00Z",
      cmdr: Option.some("TestCommander"),
      starsystem: Option.some("Sol"),
      systemaddress: Option.some(12345678),
      rawJson: Option.some('{"event":"MarketBuy"}'),
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EventRepository;

        // Create
        yield* repo.createEvent(event);

        // Find by ID
        const result = yield* repo.findById(event.id);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(event.id);
          expect(result.value.event).toBe("MarketBuy");
          expect(result.value.timestamp).toBe("2024-01-15T10:30:00Z");
          expect(Option.getOrNull(result.value.cmdr)).toBe("TestCommander");
        }
      })
    );
  });

  it("should create an event with market buy sub-events", async () => {
    const eventId = EventId.make("evt_002");
    const event = new Event({
      id: eventId,
      event: "MarketBuy",
      timestamp: "2024-01-15T11:00:00Z",
      tickid: "tick_123",
      ticktime: "2024-01-15T00:00:00Z",
      cmdr: Option.some("TestCommander"),
      starsystem: Option.some("Sol"),
      systemaddress: Option.none(),
      rawJson: Option.none(),
    });

    const marketBuyEvent = new MarketBuyEvent({
      id: MarketBuyEventId.make("mbe_001"),
      eventId: eventId,
      stock: Option.some(100),
      stockBracket: Option.some(2),
      value: Option.some(5000),
      count: Option.some(10),
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EventRepository;

        // Create with sub-events
        yield* repo.createEvent(event, {
          marketBuy: [marketBuyEvent],
        });

        // Verify main event was created
        const result = yield* repo.findById(event.id);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.event).toBe("MarketBuy");
        }
      })
    );
  });

  it("should create an event with multiple sub-event types", async () => {
    const eventId = EventId.make("evt_003");
    const event = new Event({
      id: eventId,
      event: "MultiEvent",
      timestamp: "2024-01-15T12:00:00Z",
      tickid: "tick_124",
      ticktime: "2024-01-15T00:00:00Z",
      cmdr: Option.some("TestCommander"),
      starsystem: Option.some("Alpha Centauri"),
      systemaddress: Option.none(),
      rawJson: Option.none(),
    });

    const marketSell = new MarketSellEvent({
      id: MarketSellEventId.make("mse_001"),
      eventId: eventId,
      demand: Option.some(50),
      demandBracket: Option.some(1),
      profit: Option.some(2000),
      value: Option.some(10000),
      count: Option.some(5),
    });

    const mission = new MissionCompletedEvent({
      id: MissionCompletedEventId.make("mce_001"),
      eventId: eventId,
      awardingFaction: Option.some("Federation"),
      missionName: Option.some("Delivery Mission"),
      reward: Option.some(50000),
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EventRepository;

        yield* repo.createEvent(event, {
          marketSell: [marketSell],
          missionCompleted: [{ event: mission, influences: [] }],
        });

        const result = yield* repo.findById(event.id);
        expect(Option.isSome(result)).toBe(true);
      })
    );
  });

  it("should find events by tick ID", async () => {
    const tickId = "tick_999";
    const event1 = new Event({
      id: EventId.make("evt_tick_001"),
      event: "Event1",
      timestamp: "2024-01-15T08:00:00Z",
      tickid: tickId,
      ticktime: "2024-01-15T00:00:00Z",
      cmdr: Option.none(),
      starsystem: Option.none(),
      systemaddress: Option.none(),
      rawJson: Option.none(),
    });

    const event2 = new Event({
      id: EventId.make("evt_tick_002"),
      event: "Event2",
      timestamp: "2024-01-15T09:00:00Z",
      tickid: tickId,
      ticktime: "2024-01-15T00:00:00Z",
      cmdr: Option.none(),
      starsystem: Option.none(),
      systemaddress: Option.none(),
      rawJson: Option.none(),
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EventRepository;

        yield* repo.createEvent(event1);
        yield* repo.createEvent(event2);

        const results = yield* repo.findByTickId(tickId);
        expect(results.length).toBe(2);
        expect(results[0]!.id).toBe(event1.id);
        expect(results[1]!.id).toBe(event2.id);
      })
    );
  });

  it("should find events by date range", async () => {
    const event1 = new Event({
      id: EventId.make("evt_date_001"),
      event: "Event1",
      timestamp: "2024-01-10T10:00:00Z",
      tickid: "tick_100",
      ticktime: "2024-01-10T00:00:00Z",
      cmdr: Option.none(),
      starsystem: Option.none(),
      systemaddress: Option.none(),
      rawJson: Option.none(),
    });

    const event2 = new Event({
      id: EventId.make("evt_date_002"),
      event: "Event2",
      timestamp: "2024-01-15T10:00:00Z",
      tickid: "tick_101",
      ticktime: "2024-01-15T00:00:00Z",
      cmdr: Option.none(),
      starsystem: Option.none(),
      systemaddress: Option.none(),
      rawJson: Option.none(),
    });

    const event3 = new Event({
      id: EventId.make("evt_date_003"),
      event: "Event3",
      timestamp: "2024-01-20T10:00:00Z",
      tickid: "tick_102",
      ticktime: "2024-01-20T00:00:00Z",
      cmdr: Option.none(),
      starsystem: Option.none(),
      systemaddress: Option.none(),
      rawJson: Option.none(),
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EventRepository;

        yield* repo.createEvent(event1);
        yield* repo.createEvent(event2);
        yield* repo.createEvent(event3);

        // Find events between Jan 12 and Jan 17
        const results = yield* repo.findByDateRange(
          "2024-01-12T00:00:00Z",
          "2024-01-17T00:00:00Z"
        );
        expect(results.length).toBe(1);
        expect(results[0]!.id).toBe(event2.id);
      })
    );
  });

  it("should return None for non-existent event", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* EventRepository;
        const result = yield* repo.findById(EventId.make("ghost_event"));
        expect(Option.isNone(result)).toBe(true);
      })
    );
  });

  it("should return empty array when no events match tick ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* EventRepository;
        const results = yield* repo.findByTickId("nonexistent_tick");
        expect(results.length).toBe(0);
      })
    );
  });
});
