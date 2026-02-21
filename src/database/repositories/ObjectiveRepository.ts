import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { ObjectiveRepository } from "../../domain/repositories.ts";
import { Objective } from "../../domain/models.ts";
import { DatabaseError, ObjectiveNotFoundError } from "../../domain/errors.ts";
import { ObjectiveId } from "../../domain/ids.ts";

// Helper to map DB row to Objective domain model
const mapRowToObjective = (row: any): unknown => ({
  id: row.id,
  title: row.title === null ? undefined : row.title,
  priority: row.priority === null ? undefined : row.priority,
  type: row.type === null ? undefined : row.type,
  system: row.system === null ? undefined : row.system,
  faction: row.faction === null ? undefined : row.faction,
  description: row.description === null ? undefined : row.description,
  // Dates are stored as ISO 8601 TEXT, Schema.Date expects ISO string or undefined
  startdate: row.startdate === null ? undefined : row.startdate,
  enddate: row.enddate === null ? undefined : row.enddate,
  targets: [], // Will be populated separately
});

// Helper to map DB row to ObjectiveTarget domain model
const mapRowToObjectiveTarget = (row: any): unknown => ({
  id: row.id,
  objectiveId: row.objective_id,
  type: row.type === null ? undefined : row.type,
  station: row.station === null ? undefined : row.station,
  system: row.system === null ? undefined : row.system,
  faction: row.faction === null ? undefined : row.faction,
  progress: row.progress === null ? undefined : row.progress,
  targetindividual: row.targetindividual === null ? undefined : row.targetindividual,
  targetoverall: row.targetoverall === null ? undefined : row.targetoverall,
  settlements: [], // Will be populated separately
});

// Helper to map DB row to ObjectiveTargetSettlement domain model
const mapRowToObjectiveTargetSettlement = (row: any): unknown => ({
  id: row.id,
  targetId: row.target_id,
  name: row.name === null ? undefined : row.name,
  targetindividual: row.targetindividual === null ? undefined : row.targetindividual,
  targetoverall: row.targetoverall === null ? undefined : row.targetoverall,
  progress: row.progress === null ? undefined : row.progress,
});

export const ObjectiveRepositoryLive = Layer.effect(
  ObjectiveRepository,
  Effect.gen(function* () {
    const client = yield* TursoClient;
    const decodeObjective = Schema.decodeUnknown(Objective);

    const repo = ObjectiveRepository.of({
      create: (objective) =>
        Effect.gen(function* () {
          // Insert main objective
          yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: `INSERT INTO objective (id, title, priority, type, system, faction, description, startdate, enddate)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                  objective.id,
                  Option.getOrNull(objective.title),
                  Option.getOrNull(objective.priority),
                  Option.getOrNull(objective.type),
                  Option.getOrNull(objective.system),
                  Option.getOrNull(objective.faction),
                  Option.getOrNull(objective.description),
                  Option.match(objective.startdate, {
                    onNone: () => null,
                    onSome: (date) => date.toISOString(),
                  }),
                  Option.match(objective.enddate, {
                    onNone: () => null,
                    onSome: (date) => date.toISOString(),
                  }),
                ],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "create.objective", error }),
          });

          // Insert targets and settlements
          for (const target of objective.targets) {
            yield* Effect.tryPromise({
              try: () =>
                client.execute({
                  sql: `INSERT INTO objective_target (id, objective_id, type, station, system, faction, progress, targetindividual, targetoverall)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  args: [
                    target.id,
                    target.objectiveId,
                    Option.getOrNull(target.type),
                    Option.getOrNull(target.station),
                    Option.getOrNull(target.system),
                    Option.getOrNull(target.faction),
                    Option.getOrNull(target.progress),
                    Option.getOrNull(target.targetindividual),
                    Option.getOrNull(target.targetoverall),
                  ],
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "create.objectiveTarget",
                  error,
                }),
            });

            // Insert settlements for this target
            for (const settlement of target.settlements) {
              yield* Effect.tryPromise({
                try: () =>
                  client.execute({
                    sql: `INSERT INTO objective_target_settlement (id, target_id, name, targetindividual, targetoverall, progress)
                          VALUES (?, ?, ?, ?, ?, ?)`,
                    args: [
                      settlement.id,
                      settlement.targetId,
                      Option.getOrNull(settlement.name),
                      Option.getOrNull(settlement.targetindividual),
                      Option.getOrNull(settlement.targetoverall),
                      Option.getOrNull(settlement.progress),
                    ],
                  }),
                catch: (error) =>
                  new DatabaseError({
                    operation: "create.objectiveTargetSettlement",
                    error,
                  }),
              });
            }
          }
        }),

      findById: (id) =>
        Effect.gen(function* () {
          // Get objective
          const objectiveResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM objective WHERE id = ?",
                args: [id],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findById.objective", error }),
          });

          const objectiveRow = objectiveResult.rows[0];
          if (!objectiveRow) return Option.none();

          // Get targets for this objective
          const targetsResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM objective_target WHERE objective_id = ?",
                args: [id],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "findById.objective.targets",
                error,
              }),
          });

          // Collect raw targets data
          const targetsData = [];
          for (const targetRow of targetsResult.rows) {
            // Get settlements for this target
            const settlementsResult = yield* Effect.tryPromise({
              try: () =>
                client.execute({
                  sql: "SELECT * FROM objective_target_settlement WHERE target_id = ?",
                  args: [targetRow.id as string],
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "findById.objective.settlements",
                  error,
                }),
            });

            // Map settlement rows to raw data
            const settlementsData = settlementsResult.rows.map(
              mapRowToObjectiveTargetSettlement
            );

            // Build raw target data with settlements
            const targetData = Object.assign({}, mapRowToObjectiveTarget(targetRow), {
              settlements: settlementsData,
            });
            targetsData.push(targetData);
          }

          // Decode everything together
          const objectiveData = Object.assign({}, mapRowToObjective(objectiveRow), {
            targets: targetsData,
          });
          const objective = yield* decodeObjective(objectiveData).pipe(
            Effect.mapError(
              (error) =>
                new DatabaseError({ operation: "decode.objective", error })
            )
          );

          return Option.some(objective);
        }),

      findAll: () =>
        Effect.gen(function* () {
          const objectivesResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT id FROM objective ORDER BY priority DESC, startdate DESC",
                args: [],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findAll.objective", error }),
          });

          const objectives: Objective[] = [];

          for (const row of objectivesResult.rows) {
            const maybeObjective = yield* repo.findById(row.id as ObjectiveId);
            if (Option.isSome(maybeObjective)) {
              objectives.push(maybeObjective.value);
            }
          }

          return objectives;
        }),

      findActive: (now) =>
        Effect.gen(function* () {
          const nowISO = now.toISOString();
          const objectivesResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: `SELECT id FROM objective
                      WHERE (startdate IS NULL OR startdate <= ?)
                        AND (enddate IS NULL OR enddate >= ?)
                      ORDER BY priority DESC`,
                args: [nowISO, nowISO],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findActive.objective", error }),
          });

          const objectives: Objective[] = [];

          for (const row of objectivesResult.rows) {
            const maybeObjective = yield* repo.findById(row.id as ObjectiveId);
            if (Option.isSome(maybeObjective)) {
              objectives.push(maybeObjective.value);
            }
          }

          return objectives;
        }),

      update: (objective) =>
        Effect.gen(function* () {
          // Update main objective
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: `UPDATE objective
                      SET title = ?, priority = ?, type = ?, system = ?, faction = ?, description = ?, startdate = ?, enddate = ?
                      WHERE id = ?`,
                args: [
                  Option.getOrNull(objective.title),
                  Option.getOrNull(objective.priority),
                  Option.getOrNull(objective.type),
                  Option.getOrNull(objective.system),
                  Option.getOrNull(objective.faction),
                  Option.getOrNull(objective.description),
                  Option.match(objective.startdate, {
                    onNone: () => null,
                    onSome: (date) => date.toISOString(),
                  }),
                  Option.match(objective.enddate, {
                    onNone: () => null,
                    onSome: (date) => date.toISOString(),
                  }),
                  objective.id,
                ],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "update.objective", error }),
          });

          if (result.rowsAffected === 0) {
            return yield* Effect.fail(
              new ObjectiveNotFoundError({ id: objective.id })
            );
          }

          // Delete existing targets (CASCADE will delete settlements)
          yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "DELETE FROM objective_target WHERE objective_id = ?",
                args: [objective.id],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "delete.objective.targets",
                error,
              }),
          });

          // Re-insert targets and settlements
          for (const target of objective.targets) {
            yield* Effect.tryPromise({
              try: () =>
                client.execute({
                  sql: `INSERT INTO objective_target (id, objective_id, type, station, system, faction, progress, targetindividual, targetoverall)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  args: [
                    target.id,
                    target.objectiveId,
                    Option.getOrNull(target.type),
                    Option.getOrNull(target.station),
                    Option.getOrNull(target.system),
                    Option.getOrNull(target.faction),
                    Option.getOrNull(target.progress),
                    Option.getOrNull(target.targetindividual),
                    Option.getOrNull(target.targetoverall),
                  ],
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "update.objectiveTarget",
                  error,
                }),
            });

            for (const settlement of target.settlements) {
              yield* Effect.tryPromise({
                try: () =>
                  client.execute({
                    sql: `INSERT INTO objective_target_settlement (id, target_id, name, targetindividual, targetoverall, progress)
                          VALUES (?, ?, ?, ?, ?, ?)`,
                    args: [
                      settlement.id,
                      settlement.targetId,
                      Option.getOrNull(settlement.name),
                      Option.getOrNull(settlement.targetindividual),
                      Option.getOrNull(settlement.targetoverall),
                      Option.getOrNull(settlement.progress),
                    ],
                  }),
                catch: (error) =>
                  new DatabaseError({
                    operation: "update.objectiveTargetSettlement",
                    error,
                  }),
              });
            }
          }
        }),

      delete: (id) =>
        Effect.tryPromise({
          try: () =>
            client.execute({
              sql: "DELETE FROM objective WHERE id = ?",
              args: [id],
            }),
          catch: (error) =>
            new DatabaseError({ operation: "delete.objective", error }),
        }).pipe(Effect.asVoid),
    });
    
    return repo;
  })
);
