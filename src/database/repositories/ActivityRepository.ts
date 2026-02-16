import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { ActivityRepository } from "../../domain/repositories.ts";
import { Activity } from "../../domain/models.ts";
import { DatabaseError } from "../../domain/errors.ts";
import { ActivityId } from "../../domain/ids.ts";

// Helper to map DB row to Activity domain model
const mapRowToActivity = (row: any): unknown => ({
  id: row.id,
  tickid: row.tickid,
  ticktime: row.ticktime,
  timestamp: row.timestamp,
  cmdr: row.cmdr === null ? undefined : row.cmdr,
  systems: [], // Will be populated separately
});

// Helper to map DB row to System domain model
const mapRowToSystem = (row: any): unknown => ({
  id: row.id,
  name: row.name,
  address: String(row.address), // BigInt schema expects string
  activityId: row.activity_id,
  factions: [], // Will be populated separately
});

// Helper to map DB row to Faction domain model
const mapRowToFaction = (row: any): unknown => ({
  id: row.id,
  name: row.name,
  state: row.state,
  systemId: row.system_id,
  bvs: row.bvs === null ? undefined : row.bvs,
  cbs: row.cbs === null ? undefined : row.cbs,
  exobiology: row.exobiology === null ? undefined : row.exobiology,
  exploration: row.exploration === null ? undefined : row.exploration,
  scenarios: row.scenarios === null ? undefined : row.scenarios,
  infprimary: row.infprimary === null ? undefined : row.infprimary,
  infsecondary: row.infsecondary === null ? undefined : row.infsecondary,
  missionfails: row.missionfails === null ? undefined : row.missionfails,
  murdersground: row.murdersground === null ? undefined : row.murdersground,
  murdersspace: row.murdersspace === null ? undefined : row.murdersspace,
  tradebm: row.tradebm === null ? undefined : row.tradebm,
});

export const ActivityRepositoryLive = Layer.effect(
  ActivityRepository,
  Effect.gen(function* () {
    const client = yield* TursoClient;
    const decodeActivity = Schema.decodeUnknown(Activity);

    const repo = ActivityRepository.of({
      upsert: (activity) =>
        Effect.gen(function* () {
          // Upsert main activity (INSERT OR REPLACE)
          yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: `INSERT INTO activity (id, tickid, ticktime, timestamp, cmdr)
                      VALUES (?, ?, ?, ?, ?)
                      ON CONFLICT(id) DO UPDATE SET
                        tickid = excluded.tickid,
                        ticktime = excluded.ticktime,
                        timestamp = excluded.timestamp,
                        cmdr = excluded.cmdr`,
                args: [
                  activity.id,
                  activity.tickid,
                  activity.ticktime,
                  activity.timestamp,
                  Option.getOrNull(activity.cmdr),
                ],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "upsert.activity", error }),
          });

          // Delete existing systems (CASCADE will delete factions too)
          yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "DELETE FROM system WHERE activity_id = ?",
                args: [activity.id],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "delete.activity.systems",
                error,
              }),
          });

          // Insert systems and factions
          for (const system of activity.systems) {
            // Insert system
            yield* Effect.tryPromise({
              try: () =>
                client.execute({
                  sql: `INSERT INTO system (id, name, address, activity_id)
                        VALUES (?, ?, ?, ?)`,
                  args: [
                    system.id,
                    system.name,
                    Number(system.address), // Convert BigInt to number for SQLite
                    system.activityId,
                  ],
                }),
              catch: (error) =>
                new DatabaseError({ operation: "insert.system", error }),
            });

            // Insert factions for this system
            for (const faction of system.factions) {
              yield* Effect.tryPromise({
                try: () =>
                  client.execute({
                    sql: `INSERT INTO faction (id, name, state, system_id, bvs, cbs, exobiology, exploration, scenarios, infprimary, infsecondary, missionfails, murdersground, murdersspace, tradebm)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                      faction.id,
                      faction.name,
                      faction.state,
                      faction.systemId,
                      Option.getOrNull(faction.bvs),
                      Option.getOrNull(faction.cbs),
                      Option.getOrNull(faction.exobiology),
                      Option.getOrNull(faction.exploration),
                      Option.getOrNull(faction.scenarios),
                      Option.getOrNull(faction.infprimary),
                      Option.getOrNull(faction.infsecondary),
                      Option.getOrNull(faction.missionfails),
                      Option.getOrNull(faction.murdersground),
                      Option.getOrNull(faction.murdersspace),
                      Option.getOrNull(faction.tradebm),
                    ],
                  }),
                catch: (error) =>
                  new DatabaseError({ operation: "insert.faction", error }),
              });
            }
          }
        }),

      findById: (id) =>
        Effect.gen(function* () {
          // Get activity
          const activityResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM activity WHERE id = ?",
                args: [id],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findById.activity", error }),
          });

          const activityRow = activityResult.rows[0];
          if (!activityRow) return Option.none();

          // Get systems for this activity
          const systemsResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM system WHERE activity_id = ?",
                args: [id],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "findById.activity.systems",
                error,
              }),
          });

          // Collect raw systems data (don't decode yet)
          const systemsData = [];
          for (const systemRow of systemsResult.rows) {
            // Get factions for this system
            const factionsResult = yield* Effect.tryPromise({
              try: () =>
                client.execute({
                  sql: "SELECT * FROM faction WHERE system_id = ?",
                  args: [systemRow.id as string],
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "findById.activity.factions",
                  error,
                }),
            });

            // Map faction rows to raw data
            const factionsData = factionsResult.rows.map(mapRowToFaction);

            // Build raw system data with factions
            const systemData = Object.assign({}, mapRowToSystem(systemRow), { factions: factionsData });
            systemsData.push(systemData);
          }

          // Decode everything together
          const activityData = Object.assign({}, mapRowToActivity(activityRow), { systems: systemsData });
          const activity = yield* decodeActivity(activityData).pipe(
            Effect.mapError(
              (error) =>
                new DatabaseError({ operation: "decode.activity", error })
            )
          );

          return Option.some(activity);
        }),

      findByTickId: (tickId) =>
        Effect.gen(function* () {
          const activityResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM activity WHERE tickid = ? ORDER BY timestamp",
                args: [tickId],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findByTickId.activity", error }),
          });

          const activityRow = activityResult.rows[0];
          if (!activityRow) return Option.none();

          // Reuse findById to get full nested structure
          const activityId = activityRow.id as ActivityId;
          return yield* repo.findById(activityId);
        }),

      findByDateRange: (startDate, endDate) =>
        Effect.gen(function* () {
          const activityResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT id FROM activity WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp",
                args: [startDate, endDate],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "findByDateRange.activity",
                error,
              }),
          });

          const activities: Activity[] = [];

          for (const row of activityResult.rows) {
            const maybeActivity = yield* repo.findById(row.id as ActivityId);
            if (Option.isSome(maybeActivity)) {
              activities.push(maybeActivity.value);
            }
          }

          return activities;
        }),

      findByCmdr: (cmdr) =>
        Effect.gen(function* () {
          const activityResult = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT id FROM activity WHERE cmdr = ? ORDER BY timestamp",
                args: [cmdr],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findByCmdr.activity", error }),
          });

          const activities: Activity[] = [];

          for (const row of activityResult.rows) {
            const maybeActivity = yield* repo.findById(row.id as ActivityId);
            if (Option.isSome(maybeActivity)) {
              activities.push(maybeActivity.value);
            }
          }

          return activities;
        }),
    });
    
    return repo;
  })
);
