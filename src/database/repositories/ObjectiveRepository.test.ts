import { describe, it, expect } from "bun:test";
import { Effect, Layer, Option } from "effect";
import { ObjectiveRepository } from "../../domain/repositories.ts";
import { ObjectiveRepositoryLive } from "./ObjectiveRepository.ts";
import { TursoClient } from "../client.ts";
import { createClient } from "@libsql/client";
import {
  ObjectiveId,
  ObjectiveTargetId,
  ObjectiveTargetSettlementId,
} from "../../domain/ids.ts";
import {
  Objective,
  ObjectiveTarget,
  ObjectiveTargetSettlement,
} from "../../domain/models.ts";

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
        CREATE TABLE objective (
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

        CREATE INDEX idx_objective_priority ON objective(priority);

        CREATE TABLE objective_target (
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

        CREATE INDEX idx_objective_target_objective_id ON objective_target(objective_id);

        CREATE TABLE objective_target_settlement (
          id TEXT PRIMARY KEY,
          target_id TEXT NOT NULL,
          name TEXT,
          targetindividual INTEGER,
          targetoverall INTEGER,
          progress INTEGER,
          FOREIGN KEY (target_id) REFERENCES objective_target(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_objective_target_settlement_target_id ON objective_target_settlement(target_id);
      `)
    );

    return client;
  })
);

const TestLayer = ObjectiveRepositoryLive.pipe(Layer.provide(ClientLayer));

describe("ObjectiveRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, ObjectiveRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer));

  it("should create and retrieve an objective with nested targets and settlements", async () => {
    const objectiveId = ObjectiveId.make("obj_001");
    const targetId = ObjectiveTargetId.make("tgt_001");
    const settlementId = ObjectiveTargetSettlementId.make("set_001");

    const settlement = new ObjectiveTargetSettlement({
      id: settlementId,
      targetId: targetId,
      name: Option.some("Settlement Alpha"),
      targetindividual: Option.some(100),
      targetoverall: Option.some(500),
      progress: Option.some(50),
    });

    const target = new ObjectiveTarget({
      id: targetId,
      objectiveId: objectiveId,
      type: Option.some("GroundCZ"),
      station: Option.some("Station One"),
      system: Option.some("Sol"),
      faction: Option.some("Federation"),
      progress: Option.some(200),
      targetindividual: Option.some(300),
      targetoverall: Option.some(1000),
      settlements: [settlement],
    });

    const objective = new Objective({
      id: objectiveId,
      title: Option.some("Test Objective"),
      priority: Option.some(1),
      type: Option.some("Combat"),
      system: Option.some("Sol"),
      faction: Option.some("Federation"),
      description: Option.some("Test description"),
      startdate: Option.some(new Date("2024-01-01")),
      enddate: Option.some(new Date("2024-12-31")),
      targets: [target],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ObjectiveRepository;

        // Create
        yield* repo.create(objective);

        // Find by ID
        const result = yield* repo.findById(objectiveId);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          const retrieved = result.value;
          expect(retrieved.id).toBe(objectiveId);
          expect(Option.getOrNull(retrieved.title)).toBe("Test Objective");
          expect(Option.getOrNull(retrieved.priority)).toBe(1);
          expect(retrieved.targets.length).toBe(1);

          const retrievedTarget = retrieved.targets[0]!;
          expect(Option.getOrNull(retrievedTarget.type)).toBe("GroundCZ");
          expect(Option.getOrNull(retrievedTarget.system)).toBe("Sol");
          expect(retrievedTarget.settlements.length).toBe(1);

          const retrievedSettlement = retrievedTarget.settlements[0]!;
          expect(Option.getOrNull(retrievedSettlement.name)).toBe(
            "Settlement Alpha"
          );
          expect(Option.getOrNull(retrievedSettlement.progress)).toBe(50);
        }
      })
    );
  });

  it("should create objective without targets", async () => {
    const objectiveId = ObjectiveId.make("obj_simple");
    const objective = new Objective({
      id: objectiveId,
      title: Option.some("Simple Objective"),
      priority: Option.some(5),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.none(),
      startdate: Option.none(),
      enddate: Option.none(),
      targets: [],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ObjectiveRepository;

        yield* repo.create(objective);

        const result = yield* repo.findById(objectiveId);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(result.value.id).toBe(objectiveId);
          expect(result.value.targets.length).toBe(0);
        }
      })
    );
  });

  it("should find all objectives", async () => {
    const obj1 = new Objective({
      id: ObjectiveId.make("obj_all_1"),
      title: Option.some("First"),
      priority: Option.some(10),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.none(),
      startdate: Option.none(),
      enddate: Option.none(),
      targets: [],
    });

    const obj2 = new Objective({
      id: ObjectiveId.make("obj_all_2"),
      title: Option.some("Second"),
      priority: Option.some(5),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.none(),
      startdate: Option.none(),
      enddate: Option.none(),
      targets: [],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ObjectiveRepository;

        yield* repo.create(obj1);
        yield* repo.create(obj2);

        const results = yield* repo.findAll();
        expect(results.length).toBe(2);
        // Should be ordered by priority DESC
        expect(results[0]!.id).toBe(obj1.id);
        expect(results[1]!.id).toBe(obj2.id);
      })
    );
  });

  it("should find active objectives", async () => {
    const now = new Date("2024-06-15");

    // Active: started, not ended
    const obj1 = new Objective({
      id: ObjectiveId.make("obj_active_1"),
      title: Option.some("Active 1"),
      priority: Option.some(1),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.none(),
      startdate: Option.some(new Date("2024-01-01")),
      enddate: Option.some(new Date("2024-12-31")),
      targets: [],
    });

    // Not started yet
    const obj2 = new Objective({
      id: ObjectiveId.make("obj_active_2"),
      title: Option.some("Future"),
      priority: Option.some(1),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.none(),
      startdate: Option.some(new Date("2024-07-01")),
      enddate: Option.some(new Date("2024-12-31")),
      targets: [],
    });

    // Already ended
    const obj3 = new Objective({
      id: ObjectiveId.make("obj_active_3"),
      title: Option.some("Past"),
      priority: Option.some(1),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.none(),
      startdate: Option.some(new Date("2024-01-01")),
      enddate: Option.some(new Date("2024-05-31")),
      targets: [],
    });

    // No dates (always active)
    const obj4 = new Objective({
      id: ObjectiveId.make("obj_active_4"),
      title: Option.some("Always"),
      priority: Option.some(1),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.none(),
      startdate: Option.none(),
      enddate: Option.none(),
      targets: [],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ObjectiveRepository;

        yield* repo.create(obj1);
        yield* repo.create(obj2);
        yield* repo.create(obj3);
        yield* repo.create(obj4);

        const results = yield* repo.findActive(now);
        expect(results.length).toBe(2);
        const ids = results.map((o) => o.id);
        expect(ids).toContain(obj1.id); // Active
        expect(ids).toContain(obj4.id); // Always active
      })
    );
  });

  it("should update an objective", async () => {
    const objectiveId = ObjectiveId.make("obj_update");
    const targetId = ObjectiveTargetId.make("tgt_update");

    // Initial objective
    const target1 = new ObjectiveTarget({
      id: targetId,
      objectiveId: objectiveId,
      type: Option.some("Original Type"),
      station: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      progress: Option.some(0),
      targetindividual: Option.none(),
      targetoverall: Option.none(),
      settlements: [],
    });

    const objective1 = new Objective({
      id: objectiveId,
      title: Option.some("Original Title"),
      priority: Option.some(1),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.some("Original description"),
      startdate: Option.none(),
      enddate: Option.none(),
      targets: [target1],
    });

    // Updated objective
    const newTargetId = ObjectiveTargetId.make("tgt_new");
    const target2 = new ObjectiveTarget({
      id: newTargetId,
      objectiveId: objectiveId,
      type: Option.some("Updated Type"),
      station: Option.some("New Station"),
      system: Option.none(),
      faction: Option.none(),
      progress: Option.some(50),
      targetindividual: Option.none(),
      targetoverall: Option.none(),
      settlements: [],
    });

    const objective2 = new Objective({
      id: objectiveId,
      title: Option.some("Updated Title"),
      priority: Option.some(10),
      type: Option.some("NewType"),
      system: Option.none(),
      faction: Option.none(),
      description: Option.some("Updated description"),
      startdate: Option.some(new Date("2024-01-01")),
      enddate: Option.some(new Date("2024-12-31")),
      targets: [target2],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ObjectiveRepository;

        // Create initial
        yield* repo.create(objective1);

        // Verify initial state
        let result = yield* repo.findById(objectiveId);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(Option.getOrNull(result.value.title)).toBe("Original Title");
          expect(result.value.targets.length).toBe(1);
          expect(result.value.targets[0]!.id).toBe(targetId);
        }

        // Update
        yield* repo.update(objective2);

        // Verify updated state
        result = yield* repo.findById(objectiveId);
        expect(Option.isSome(result)).toBe(true);
        if (Option.isSome(result)) {
          expect(Option.getOrNull(result.value.title)).toBe("Updated Title");
          expect(Option.getOrNull(result.value.priority)).toBe(10);
          expect(result.value.targets.length).toBe(1);
          expect(result.value.targets[0]!.id).toBe(newTargetId);
          expect(Option.getOrNull(result.value.targets[0]!.type)).toBe(
            "Updated Type"
          );
        }
      })
    );
  });

  it("should delete an objective", async () => {
    const objectiveId = ObjectiveId.make("obj_delete");
    const objective = new Objective({
      id: objectiveId,
      title: Option.some("To Delete"),
      priority: Option.some(1),
      type: Option.none(),
      system: Option.none(),
      faction: Option.none(),
      description: Option.none(),
      startdate: Option.none(),
      enddate: Option.none(),
      targets: [],
    });

    await runTest(
      Effect.gen(function* () {
        const repo = yield* ObjectiveRepository;

        // Create
        yield* repo.create(objective);

        // Verify exists
        let result = yield* repo.findById(objectiveId);
        expect(Option.isSome(result)).toBe(true);

        // Delete
        yield* repo.delete(objectiveId);

        // Verify gone
        result = yield* repo.findById(objectiveId);
        expect(Option.isNone(result)).toBe(true);
      })
    );
  });

  it("should return None for non-existent objective", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* ObjectiveRepository;
        const result = yield* repo.findById(ObjectiveId.make("ghost"));
        expect(Option.isNone(result)).toBe(true);
      })
    );
  });

  it("should return empty array when no objectives exist", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* ObjectiveRepository;
        const results = yield* repo.findAll();
        expect(results.length).toBe(0);
      })
    );
  });
});
