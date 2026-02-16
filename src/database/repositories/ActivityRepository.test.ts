import { describe, it, expect } from "bun:test";
import { Effect, Layer, Option } from "effect";
import { ActivityRepository } from "../../domain/repositories.ts";
import { ActivityRepositoryLive } from "./ActivityRepository.ts";
import { TursoClient } from "../client.ts";
import { createClient } from "@libsql/client";
import { ActivityId, SystemId, FactionId } from "../../domain/ids.ts";
import { Activity, System, Faction } from "../../domain/models.ts";

// Helper to provide a fresh Test Layer for each test
const ClientLayer = Layer.effect(
  TursoClient,
  Effect.gen(function* () {
    const client = createClient({
      url: "file::memory:",
    });

    // Initialize Schema
    yield* Effect.tryPromise(() =>
      client.executeMultiple(`
        CREATE TABLE activity (
          id TEXT PRIMARY KEY,
          tickid TEXT NOT NULL,
          ticktime TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          cmdr TEXT
        );

        CREATE INDEX idx_activity_tickid ON activity(tickid);
        CREATE INDEX idx_activity_timestamp ON activity(timestamp);
        CREATE INDEX idx_activity_cmdr ON activity(cmdr);

        CREATE TABLE system (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          address INTEGER NOT NULL,
          activity_id TEXT NOT NULL,
          FOREIGN KEY (activity_id) REFERENCES activity(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_system_activity_id ON system(activity_id);

        CREATE TABLE faction (
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

        CREATE INDEX idx_faction_system_id ON faction(system_id);
      `)
    );

    return client;
  })
);

const TestLayer = ActivityRepositoryLive.pipe(Layer.provide(ClientLayer));

describe("ActivityRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, ActivityRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer));

  it("should upsert and retrieve an activity with nested systems and factions", async () => {
    const activityId = ActivityId.make("act_001");
    const systemId = SystemId.make("sys_001");
    const factionId = FactionId.make("fac_001");

    const faction = new Faction({
      id: factionId,
      name: "Federation Navy",
      state: "Boom",
      systemId: systemId,
      bvs: Option.some(100),
      cbs: Option.some(50),
      exobiology: Option.none(),
      exploration: Option.some(25),
      scenarios: Option.some(10),
      infprimary: Option.some(500),
      infsecondary: Option.some(200),
      missionfails: Option.none(),
      murdersground: Option.none(),
      murdersspace: Option.none(),
      tradebm: Option.some(150),
    });

    const system = new System({
      id: systemId,
      name: "Sol",
      address: BigInt(10477373803),
      activityId: activityId,
      factions: [faction],
    });

    const activity = new Activity({
      id: activityId,
      tickid: "tick_100",
      ticktime: "2024-01-15T00:00:00Z",
      timestamp: "2024-01-15T10:30:00Z",
      cmdr: Option.some("TestCommander"),
      systems: [system],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ActivityRepository;

        // Upsert
        yield* repo.upsert(activity);

        // Find by ID
        const result = yield* repo.findById(activityId);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          const retrieved = result.value;
          expect(retrieved.id).toBe(activityId);
          expect(retrieved.tickid).toBe("tick_100");
          expect(Option.getOrNull(retrieved.cmdr)).toBe("TestCommander");
          expect(retrieved.systems.length).toBe(1);

          const retrievedSystem = retrieved.systems[0]!;
          expect(retrievedSystem.name).toBe("Sol");
          expect(retrievedSystem.address).toBe(BigInt(10477373803));
          expect(retrievedSystem.factions.length).toBe(1);

          const retrievedFaction = retrievedSystem.factions[0]!;
          expect(retrievedFaction.name).toBe("Federation Navy");
          expect(retrievedFaction.state).toBe("Boom");
          expect(Option.getOrNull(retrievedFaction.bvs)).toBe(100);
        }
      })
    );
  });

  it("should update an existing activity (upsert)", async () => {
    const activityId = ActivityId.make("act_update");
    const systemId1 = SystemId.make("sys_update_1");
    const systemId2 = SystemId.make("sys_update_2");
    const factionId1 = FactionId.make("fac_update_1");
    const factionId2 = FactionId.make("fac_update_2");

    // Initial activity with one system
    const faction1 = new Faction({
      id: factionId1,
      name: "Original Faction",
      state: "None",
      systemId: systemId1,
      bvs: Option.some(10),
      cbs: Option.none(),
      exobiology: Option.none(),
      exploration: Option.none(),
      scenarios: Option.none(),
      infprimary: Option.none(),
      infsecondary: Option.none(),
      missionfails: Option.none(),
      murdersground: Option.none(),
      murdersspace: Option.none(),
      tradebm: Option.none(),
    });

    const system1 = new System({
      id: systemId1,
      name: "System One",
      address: BigInt(111111),
      activityId: activityId,
      factions: [faction1],
    });

    const activity1 = new Activity({
      id: activityId,
      tickid: "tick_200",
      ticktime: "2024-01-20T00:00:00Z",
      timestamp: "2024-01-20T10:00:00Z",
      cmdr: Option.some("Commander1"),
      systems: [system1],
    });

    // Updated activity with different system
    const faction2 = new Faction({
      id: factionId2,
      name: "Updated Faction",
      state: "War",
      systemId: systemId2,
      bvs: Option.some(200),
      cbs: Option.some(100),
      exobiology: Option.none(),
      exploration: Option.none(),
      scenarios: Option.none(),
      infprimary: Option.none(),
      infsecondary: Option.none(),
      missionfails: Option.none(),
      murdersground: Option.none(),
      murdersspace: Option.none(),
      tradebm: Option.none(),
    });

    const system2 = new System({
      id: systemId2,
      name: "System Two",
      address: BigInt(222222),
      activityId: activityId,
      factions: [faction2],
    });

    const activity2 = new Activity({
      id: activityId,
      tickid: "tick_201",
      ticktime: "2024-01-21T00:00:00Z",
      timestamp: "2024-01-21T11:00:00Z",
      cmdr: Option.some("Commander2"),
      systems: [system2],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ActivityRepository;

        // First upsert
        yield* repo.upsert(activity1);

        // Verify initial state
        let result = yield* repo.findById(activityId);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.systems.length).toBe(1);
          expect(result.value.systems[0]!.name).toBe("System One");
        }

        // Update with new data
        yield* repo.upsert(activity2);

        // Verify updated state
        result = yield* repo.findById(activityId);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.tickid).toBe("tick_201");
          expect(Option.getOrNull(result.value.cmdr)).toBe("Commander2");
          expect(result.value.systems.length).toBe(1);
          expect(result.value.systems[0]!.name).toBe("System Two");
          expect(result.value.systems[0]!.factions[0]!.name).toBe(
            "Updated Faction"
          );
        }
      })
    );
  });

  it("should find activity by tick ID", async () => {
    const tickId = "tick_300";
    const activityId = ActivityId.make("act_tick");
    const systemId = SystemId.make("sys_tick");
    const factionId = FactionId.make("fac_tick");

    const faction = new Faction({
      id: factionId,
      name: "Test Faction",
      state: "None",
      systemId: systemId,
      bvs: Option.none(),
      cbs: Option.none(),
      exobiology: Option.none(),
      exploration: Option.none(),
      scenarios: Option.none(),
      infprimary: Option.none(),
      infsecondary: Option.none(),
      missionfails: Option.none(),
      murdersground: Option.none(),
      murdersspace: Option.none(),
      tradebm: Option.none(),
    });

    const system = new System({
      id: systemId,
      name: "Test System",
      address: BigInt(333333),
      activityId: activityId,
      factions: [faction],
    });

    const activity = new Activity({
      id: activityId,
      tickid: tickId,
      ticktime: "2024-01-25T00:00:00Z",
      timestamp: "2024-01-25T12:00:00Z",
      cmdr: Option.some("TestCmdr"),
      systems: [system],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ActivityRepository;

        yield* repo.upsert(activity);

        const result = yield* repo.findByTickId(tickId);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(activityId);
          expect(result.value.tickid).toBe(tickId);
        }
      })
    );
  });

  it("should find activities by date range", async () => {
    const act1 = new Activity({
      id: ActivityId.make("act_date_1"),
      tickid: "tick_400",
      ticktime: "2024-01-10T00:00:00Z",
      timestamp: "2024-01-10T10:00:00Z",
      cmdr: Option.none(),
      systems: [],
    });

    const act2 = new Activity({
      id: ActivityId.make("act_date_2"),
      tickid: "tick_401",
      ticktime: "2024-01-15T00:00:00Z",
      timestamp: "2024-01-15T10:00:00Z",
      cmdr: Option.none(),
      systems: [],
    });

    const act3 = new Activity({
      id: ActivityId.make("act_date_3"),
      tickid: "tick_402",
      ticktime: "2024-01-20T00:00:00Z",
      timestamp: "2024-01-20T10:00:00Z",
      cmdr: Option.none(),
      systems: [],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ActivityRepository;

        yield* repo.upsert(act1);
        yield* repo.upsert(act2);
        yield* repo.upsert(act3);

        const results = yield* repo.findByDateRange(
          "2024-01-12T00:00:00Z",
          "2024-01-17T00:00:00Z"
        );
        expect(results.length).toBe(1);
        expect(results[0]!.id).toBe(act2.id);
      })
    );
  });

  it("should find activities by commander", async () => {
    const cmdr = "SpecificCommander";
    const act1 = new Activity({
      id: ActivityId.make("act_cmdr_1"),
      tickid: "tick_500",
      ticktime: "2024-01-10T00:00:00Z",
      timestamp: "2024-01-10T10:00:00Z",
      cmdr: Option.some(cmdr),
      systems: [],
    });

    const act2 = new Activity({
      id: ActivityId.make("act_cmdr_2"),
      tickid: "tick_501",
      ticktime: "2024-01-11T00:00:00Z",
      timestamp: "2024-01-11T10:00:00Z",
      cmdr: Option.some(cmdr),
      systems: [],
    });

    const act3 = new Activity({
      id: ActivityId.make("act_cmdr_3"),
      tickid: "tick_502",
      ticktime: "2024-01-12T00:00:00Z",
      timestamp: "2024-01-12T10:00:00Z",
      cmdr: Option.some("DifferentCommander"),
      systems: [],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ActivityRepository;

        yield* repo.upsert(act1);
        yield* repo.upsert(act2);
        yield* repo.upsert(act3);

        const results = yield* repo.findByCmdr(cmdr);
        expect(results.length).toBe(2);
        expect(results[0]!.id).toBe(act1.id);
        expect(results[1]!.id).toBe(act2.id);
      })
    );
  });

  it("should return None for non-existent activity", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* ActivityRepository;
        const result = yield* repo.findById(ActivityId.make("ghost"));
        expect(Option.isNone(result)).toBe(true);
      })
    );
  });

  it("should return None for non-existent tick ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* ActivityRepository;
        const result = yield* repo.findByTickId("nonexistent_tick");
        expect(Option.isNone(result)).toBe(true);
      })
    );
  });

  it("should return empty array when no activities match date range", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* ActivityRepository;
        const results = yield* repo.findByDateRange(
          "2099-01-01T00:00:00Z",
          "2099-12-31T00:00:00Z"
        );
        expect(results.length).toBe(0);
      })
    );
  });
});
