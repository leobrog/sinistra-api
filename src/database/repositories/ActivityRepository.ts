import { Effect, Layer, Option, Schema } from "effect";
import { PgClient } from "../client.ts";
import { ActivityRepository } from "../../domain/repositories.ts";
import { Activity } from "../../domain/models.ts";
import { DatabaseError } from "../../domain/errors.ts";
import { ActivityId, FactionId } from "../../domain/ids.ts";

// ============================================================================
// Null helper — coerce null/undefined to null for SQL args
// ============================================================================

const n = (v: unknown) => (v === null || v === undefined ? null : v as number);

// ============================================================================
// Value object reconstructors
// Returns the *encoded* form expected by Schema.decodeUnknown:
//   - undefined  → decoded as Option.none()
//   - plain value → decoded as Option.some(value)
// ============================================================================

const nu = (v: unknown) => (v === null || v === undefined ? undefined : v as number);

const reconstructCZLevels = (low: unknown, medium: unknown, high: unknown) => {
  if (low === null && medium === null && high === null) return undefined;
  return { low: nu(low), medium: nu(medium), high: nu(high) };
};

const reconstructSumCount = (sum: unknown, count: unknown) => {
  if (sum === null && count === null) return undefined;
  return { sum: (sum ?? 0) as number, count: (count ?? 0) as number };
};

const reconstructLMH = (
  ls: unknown, lc: unknown,
  ms: unknown, mc: unknown,
  hs: unknown, hc: unknown,
) => {
  if (ls === null && lc === null && ms === null && mc === null && hs === null && hc === null)
    return undefined;
  return {
    low: reconstructSumCount(ls, lc),
    medium: reconstructSumCount(ms, mc),
    high: reconstructSumCount(hs, hc),
  };
};

const reconstructTradeBracket = (items: unknown, value: unknown, profit: unknown) => {
  if (items === null && value === null && profit === null) return undefined;
  return { items: nu(items), value: nu(value), profit: nu(profit) };
};

const reconstructTrade = (
  hi: unknown, hv: unknown, hp: unknown,
  li: unknown, lv: unknown, lp: unknown,
  zi: unknown, zv: unknown, zp: unknown,
) => {
  if (hi === null && hv === null && hp === null &&
      li === null && lv === null && lp === null &&
      zi === null && zv === null && zp === null)
    return undefined;
  return {
    high: reconstructTradeBracket(hi, hv, hp),
    low: reconstructTradeBracket(li, lv, lp),
    zero: reconstructTradeBracket(zi, zv, zp),
  };
};

const reconstructActivitySandR = (row: any) => {
  const fields = [
    row.sandr_blackboxes, row.sandr_damagedpods, row.sandr_occupiedpods,
    row.sandr_thargoidpods, row.sandr_wreckagecomponents, row.sandr_personaleffects,
    row.sandr_politicalprisoners, row.sandr_hostages,
  ];
  if (fields.every((f) => f === null)) return undefined;
  return {
    blackboxes: nu(row.sandr_blackboxes),
    damagedpods: nu(row.sandr_damagedpods),
    occupiedpods: nu(row.sandr_occupiedpods),
    thargoidpods: nu(row.sandr_thargoidpods),
    wreckagecomponents: nu(row.sandr_wreckagecomponents),
    personaleffects: nu(row.sandr_personaleffects),
    politicalprisoners: nu(row.sandr_politicalprisoners),
    hostages: nu(row.sandr_hostages),
  };
};

const reconstructTWKills = (row: any) => {
  const fields = [
    row.twkills_cyclops, row.twkills_basilisk, row.twkills_medusa, row.twkills_hydra,
    row.twkills_orthrus, row.twkills_scout, row.twkills_revenant, row.twkills_banshee,
    row.twkills_scythe_glaive,
  ];
  if (fields.every((f) => f === null)) return undefined;
  return {
    cyclops: nu(row.twkills_cyclops),
    basilisk: nu(row.twkills_basilisk),
    medusa: nu(row.twkills_medusa),
    hydra: nu(row.twkills_hydra),
    orthrus: nu(row.twkills_orthrus),
    scout: nu(row.twkills_scout),
    revenant: nu(row.twkills_revenant),
    banshee: nu(row.twkills_banshee),
    scytheGlaive: nu(row.twkills_scythe_glaive),
  };
};

const reconstructTWSandR = (row: any) => {
  const fields = [
    row.twsandr_blackboxes, row.twsandr_damagedpods, row.twsandr_occupiedpods,
    row.twsandr_tissuesamples, row.twsandr_thargoidpods,
  ];
  if (fields.every((f) => f === null)) return undefined;
  return {
    blackboxes: nu(row.twsandr_blackboxes),
    damagedpods: nu(row.twsandr_damagedpods),
    occupiedpods: nu(row.twsandr_occupiedpods),
    tissuesamples: nu(row.twsandr_tissuesamples),
    thargoidpods: nu(row.twsandr_thargoidpods),
  };
};

const reconstructTWMassacre = (row: any) => {
  const fields = [
    row.twmassacre_cyclops_sum, row.twmassacre_basilisk_sum, row.twmassacre_medusa_sum,
    row.twmassacre_hydra_sum, row.twmassacre_orthrus_sum, row.twmassacre_scout_sum,
  ];
  if (fields.every((f) => f === null)) return undefined;
  return {
    cyclops: reconstructSumCount(row.twmassacre_cyclops_sum, row.twmassacre_cyclops_count),
    basilisk: reconstructSumCount(row.twmassacre_basilisk_sum, row.twmassacre_basilisk_count),
    medusa: reconstructSumCount(row.twmassacre_medusa_sum, row.twmassacre_medusa_count),
    hydra: reconstructSumCount(row.twmassacre_hydra_sum, row.twmassacre_hydra_count),
    orthrus: reconstructSumCount(row.twmassacre_orthrus_sum, row.twmassacre_orthrus_count),
    scout: reconstructSumCount(row.twmassacre_scout_sum, row.twmassacre_scout_count),
  };
};

// ============================================================================
// Row mappers
// ============================================================================

const mapRowToActivity = (row: any): unknown => ({
  id: row.id,
  tickid: row.tickid,
  ticktime: row.ticktime,
  timestamp: row.timestamp,
  cmdr: row.cmdr === null ? undefined : row.cmdr,
  systems: [],
});

const mapRowToSystem = (row: any): unknown => ({
  id: row.id,
  name: row.name,
  address: row.address,
  activityId: row.activity_id,
  factions: [],
  twkills: reconstructTWKills(row),
  twsandr: reconstructTWSandR(row),
  twreactivate: row.twreactivate === null ? undefined : row.twreactivate,
});

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
  czspace: reconstructCZLevels(row.czspace_low, row.czspace_medium, row.czspace_high),
  czground: reconstructCZLevels(row.czground_low, row.czground_medium, row.czground_high),
  czgroundSettlements: [], // populated by child query
  sandr: reconstructActivitySandR(row),
  tradebuy: reconstructTrade(
    row.tradebuy_high_items, row.tradebuy_high_value, null,
    row.tradebuy_low_items, row.tradebuy_low_value, null,
    row.tradebuy_zero_items, row.tradebuy_zero_value, null,
  ),
  tradesell: reconstructTrade(
    row.tradesell_high_items, row.tradesell_high_value, row.tradesell_high_profit,
    row.tradesell_low_items, row.tradesell_low_value, row.tradesell_low_profit,
    row.tradesell_zero_items, row.tradesell_zero_value, row.tradesell_zero_profit,
  ),
  stations: [], // populated by child query
});

const mapRowToFactionSettlement = (row: any): unknown => ({
  id: row.id,
  factionId: row.faction_id,
  name: row.name,
  type: row.type,
  count: row.count,
});

const mapRowToFactionStation = (row: any): unknown => ({
  id: row.id,
  factionId: row.faction_id,
  name: row.name,
  twreactivate: row.twreactivate === null ? undefined : row.twreactivate,
  twcargo: reconstructSumCount(row.twcargo_sum, row.twcargo_count),
  twescapepods: reconstructLMH(
    row.twescapepods_low_sum, row.twescapepods_low_count,
    row.twescapepods_medium_sum, row.twescapepods_medium_count,
    row.twescapepods_high_sum, row.twescapepods_high_count,
  ),
  twpassengers: reconstructLMH(
    row.twpassengers_low_sum, row.twpassengers_low_count,
    row.twpassengers_medium_sum, row.twpassengers_medium_count,
    row.twpassengers_high_sum, row.twpassengers_high_count,
  ),
  twmassacre: reconstructTWMassacre(row),
});

// ============================================================================
// Repository
// ============================================================================

export const ActivityRepositoryLive = Layer.effect(
  ActivityRepository,
  Effect.gen(function* () {
    const client = yield* PgClient;
    const decodeActivity = Schema.decodeUnknown(Activity);

    const repo = ActivityRepository.of({
      upsert: (activity) =>
        Effect.gen(function* () {
          // Upsert main activity
          yield* Effect.tryPromise({
            try: () =>
              client`INSERT INTO activity (id, tickid, ticktime, timestamp, cmdr)
                      VALUES (${activity.id}, ${activity.tickid}, ${activity.ticktime}, ${activity.timestamp}, ${Option.getOrNull(activity.cmdr)})
                      ON CONFLICT(id) DO UPDATE SET
                        tickid = excluded.tickid,
                        ticktime = excluded.ticktime,
                        timestamp = excluded.timestamp,
                        cmdr = excluded.cmdr`,
            catch: (error) =>
              new DatabaseError({ operation: "upsert.activity", error }),
          });

          // Delete existing systems (CASCADE deletes factions → settlements + stations)
          yield* Effect.tryPromise({
            try: () =>
              client`DELETE FROM system WHERE activity_id = ${activity.id}`,
            catch: (error) =>
              new DatabaseError({ operation: "delete.activity.systems", error }),
          });

          // Insert systems, factions, and all children
          for (const system of activity.systems) {
            const twkills = Option.getOrUndefined(system.twkills);
            const twsandr = Option.getOrUndefined(system.twsandr);

            yield* Effect.tryPromise({
              try: () =>
                client`INSERT INTO system (
                          id, name, address, activity_id,
                          twreactivate,
                          twkills_cyclops, twkills_basilisk, twkills_medusa, twkills_hydra,
                          twkills_orthrus, twkills_scout, twkills_revenant, twkills_banshee,
                          twkills_scythe_glaive,
                          twsandr_blackboxes, twsandr_damagedpods, twsandr_occupiedpods,
                          twsandr_tissuesamples, twsandr_thargoidpods
                        ) VALUES (${system.id}, ${system.name}, ${system.address}, ${system.activityId}, ${Option.getOrNull(system.twreactivate)}, ${n(twkills && Option.getOrNull(twkills.cyclops))}, ${n(twkills && Option.getOrNull(twkills.basilisk))}, ${n(twkills && Option.getOrNull(twkills.medusa))}, ${n(twkills && Option.getOrNull(twkills.hydra))}, ${n(twkills && Option.getOrNull(twkills.orthrus))}, ${n(twkills && Option.getOrNull(twkills.scout))}, ${n(twkills && Option.getOrNull(twkills.revenant))}, ${n(twkills && Option.getOrNull(twkills.banshee))}, ${n(twkills && Option.getOrNull(twkills.scytheGlaive))}, ${n(twsandr && Option.getOrNull(twsandr.blackboxes))}, ${n(twsandr && Option.getOrNull(twsandr.damagedpods))}, ${n(twsandr && Option.getOrNull(twsandr.occupiedpods))}, ${n(twsandr && Option.getOrNull(twsandr.tissuesamples))}, ${n(twsandr && Option.getOrNull(twsandr.thargoidpods))})`,
              catch: (error) =>
                new DatabaseError({ operation: "insert.system", error }),
            });

            for (const faction of system.factions) {
              const czspace = Option.getOrUndefined(faction.czspace);
              const czground = Option.getOrUndefined(faction.czground);
              const sandr = Option.getOrUndefined(faction.sandr);
              const tradebuy = Option.getOrUndefined(faction.tradebuy);
              const tradesell = Option.getOrUndefined(faction.tradesell);
              const tbHigh = tradebuy ? Option.getOrUndefined(tradebuy.high) : undefined;
              const tbLow = tradebuy ? Option.getOrUndefined(tradebuy.low) : undefined;
              const tbZero = tradebuy ? Option.getOrUndefined(tradebuy.zero) : undefined;
              const tsHigh = tradesell ? Option.getOrUndefined(tradesell.high) : undefined;
              const tsLow = tradesell ? Option.getOrUndefined(tradesell.low) : undefined;
              const tsZero = tradesell ? Option.getOrUndefined(tradesell.zero) : undefined;

              yield* Effect.tryPromise({
                try: () =>
                  client`INSERT INTO faction (
                            id, name, state, system_id,
                            bvs, cbs, exobiology, exploration, scenarios,
                            infprimary, infsecondary, missionfails,
                            murdersground, murdersspace, tradebm,
                            czspace_low, czspace_medium, czspace_high,
                            czground_low, czground_medium, czground_high,
                            sandr_blackboxes, sandr_damagedpods, sandr_occupiedpods,
                            sandr_thargoidpods, sandr_wreckagecomponents,
                            sandr_personaleffects, sandr_politicalprisoners, sandr_hostages,
                            tradebuy_high_items, tradebuy_high_value,
                            tradebuy_low_items, tradebuy_low_value,
                            tradebuy_zero_items, tradebuy_zero_value,
                            tradesell_high_items, tradesell_high_value, tradesell_high_profit,
                            tradesell_low_items, tradesell_low_value, tradesell_low_profit,
                            tradesell_zero_items, tradesell_zero_value, tradesell_zero_profit
                          ) VALUES (
                            ${faction.id}, ${faction.name}, ${faction.state}, ${faction.systemId},
                            ${Option.getOrNull(faction.bvs)}, ${Option.getOrNull(faction.cbs)}, ${Option.getOrNull(faction.exobiology)}, ${Option.getOrNull(faction.exploration)}, ${Option.getOrNull(faction.scenarios)},
                            ${Option.getOrNull(faction.infprimary)}, ${Option.getOrNull(faction.infsecondary)}, ${Option.getOrNull(faction.missionfails)},
                            ${Option.getOrNull(faction.murdersground)}, ${Option.getOrNull(faction.murdersspace)}, ${Option.getOrNull(faction.tradebm)},
                            ${n(czspace && Option.getOrNull(czspace.low))}, ${n(czspace && Option.getOrNull(czspace.medium))}, ${n(czspace && Option.getOrNull(czspace.high))},
                            ${n(czground && Option.getOrNull(czground.low))}, ${n(czground && Option.getOrNull(czground.medium))}, ${n(czground && Option.getOrNull(czground.high))},
                            ${n(sandr && Option.getOrNull(sandr.blackboxes))}, ${n(sandr && Option.getOrNull(sandr.damagedpods))}, ${n(sandr && Option.getOrNull(sandr.occupiedpods))},
                            ${n(sandr && Option.getOrNull(sandr.thargoidpods))}, ${n(sandr && Option.getOrNull(sandr.wreckagecomponents))},
                            ${n(sandr && Option.getOrNull(sandr.personaleffects))}, ${n(sandr && Option.getOrNull(sandr.politicalprisoners))}, ${n(sandr && Option.getOrNull(sandr.hostages))},
                            ${n(tbHigh && Option.getOrNull(tbHigh.items))}, ${n(tbHigh && Option.getOrNull(tbHigh.value))},
                            ${n(tbLow && Option.getOrNull(tbLow.items))}, ${n(tbLow && Option.getOrNull(tbLow.value))},
                            ${n(tbZero && Option.getOrNull(tbZero.items))}, ${n(tbZero && Option.getOrNull(tbZero.value))},
                            ${n(tsHigh && Option.getOrNull(tsHigh.items))}, ${n(tsHigh && Option.getOrNull(tsHigh.value))}, ${n(tsHigh && Option.getOrNull(tsHigh.profit))},
                            ${n(tsLow && Option.getOrNull(tsLow.items))}, ${n(tsLow && Option.getOrNull(tsLow.value))}, ${n(tsLow && Option.getOrNull(tsLow.profit))},
                            ${n(tsZero && Option.getOrNull(tsZero.items))}, ${n(tsZero && Option.getOrNull(tsZero.value))}, ${n(tsZero && Option.getOrNull(tsZero.profit))}
                          )`,
                catch: (error) =>
                  new DatabaseError({ operation: "insert.faction", error }),
              });

              // Insert czground settlements
              for (const settlement of faction.czgroundSettlements) {
                yield* Effect.tryPromise({
                  try: () =>
                    client`INSERT INTO faction_settlement (id, faction_id, name, type, count)
                            VALUES (${settlement.id}, ${faction.id}, ${settlement.name}, ${settlement.type}, ${settlement.count})`,
                  catch: (error) =>
                    new DatabaseError({ operation: "insert.faction_settlement", error }),
                });
              }

              // Insert stations
              for (const station of faction.stations) {
                const twcargo = Option.getOrUndefined(station.twcargo);
                const twescapepods = Option.getOrUndefined(station.twescapepods);
                const twpassengers = Option.getOrUndefined(station.twpassengers);
                const twmassacre = Option.getOrUndefined(station.twmassacre);
                const tepLow = twescapepods ? Option.getOrUndefined(twescapepods.low) : undefined;
                const tepMed = twescapepods ? Option.getOrUndefined(twescapepods.medium) : undefined;
                const tepHigh = twescapepods ? Option.getOrUndefined(twescapepods.high) : undefined;
                const tpLow = twpassengers ? Option.getOrUndefined(twpassengers.low) : undefined;
                const tpMed = twpassengers ? Option.getOrUndefined(twpassengers.medium) : undefined;
                const tpHigh = twpassengers ? Option.getOrUndefined(twpassengers.high) : undefined;
                const tmCyclops = twmassacre ? Option.getOrUndefined(twmassacre.cyclops) : undefined;
                const tmBasilisk = twmassacre ? Option.getOrUndefined(twmassacre.basilisk) : undefined;
                const tmMedusa = twmassacre ? Option.getOrUndefined(twmassacre.medusa) : undefined;
                const tmHydra = twmassacre ? Option.getOrUndefined(twmassacre.hydra) : undefined;
                const tmOrthrus = twmassacre ? Option.getOrUndefined(twmassacre.orthrus) : undefined;
                const tmScout = twmassacre ? Option.getOrUndefined(twmassacre.scout) : undefined;

                yield* Effect.tryPromise({
                  try: () =>
                    client`INSERT INTO faction_station (
                              id, faction_id, name, twreactivate,
                              twcargo_sum, twcargo_count,
                              twescapepods_low_sum, twescapepods_low_count,
                              twescapepods_medium_sum, twescapepods_medium_count,
                              twescapepods_high_sum, twescapepods_high_count,
                              twpassengers_low_sum, twpassengers_low_count,
                              twpassengers_medium_sum, twpassengers_medium_count,
                              twpassengers_high_sum, twpassengers_high_count,
                              twmassacre_cyclops_sum, twmassacre_cyclops_count,
                              twmassacre_basilisk_sum, twmassacre_basilisk_count,
                              twmassacre_medusa_sum, twmassacre_medusa_count,
                              twmassacre_hydra_sum, twmassacre_hydra_count,
                              twmassacre_orthrus_sum, twmassacre_orthrus_count,
                              twmassacre_scout_sum, twmassacre_scout_count
                            ) VALUES (
                              ${station.id}, ${faction.id}, ${station.name}, ${Option.getOrNull(station.twreactivate)},
                              ${n(twcargo?.sum)}, ${n(twcargo?.count)},
                              ${n(tepLow?.sum)}, ${n(tepLow?.count)}, ${n(tepMed?.sum)}, ${n(tepMed?.count)}, ${n(tepHigh?.sum)}, ${n(tepHigh?.count)},
                              ${n(tpLow?.sum)}, ${n(tpLow?.count)}, ${n(tpMed?.sum)}, ${n(tpMed?.count)}, ${n(tpHigh?.sum)}, ${n(tpHigh?.count)},
                              ${n(tmCyclops?.sum)}, ${n(tmCyclops?.count)}, ${n(tmBasilisk?.sum)}, ${n(tmBasilisk?.count)}, ${n(tmMedusa?.sum)}, ${n(tmMedusa?.count)}, ${n(tmHydra?.sum)}, ${n(tmHydra?.count)}, ${n(tmOrthrus?.sum)}, ${n(tmOrthrus?.count)}, ${n(tmScout?.sum)}, ${n(tmScout?.count)}
                            )`,
                  catch: (error) =>
                    new DatabaseError({ operation: "insert.faction_station", error }),
                });
              }
            }
          }
        }),

      findById: (id) =>
        Effect.gen(function* () {
          const activityResult = yield* Effect.tryPromise({
            try: () =>
              client`SELECT * FROM activity WHERE id = ${id}`,
            catch: (error) =>
              new DatabaseError({ operation: "findById.activity", error }),
          });

          const activityRow = activityResult.rows[0];
          if (!activityRow) return Option.none();

          const systemsResult = yield* Effect.tryPromise({
            try: () =>
              client`SELECT * FROM system WHERE activity_id = ${id}`,
            catch: (error) =>
              new DatabaseError({ operation: "findById.activity.systems", error }),
          });

          const systemsData = [];
          for (const systemRow of systemsResult.rows) {
            const factionsResult = yield* Effect.tryPromise({
              try: () =>
                client`SELECT * FROM faction WHERE system_id = ${systemRow.id as string}`,
              catch: (error) =>
                new DatabaseError({ operation: "findById.activity.factions", error }),
            });

            const factionsData = [];
            for (const factionRow of factionsResult.rows) {
              const factionId = factionRow.id as FactionId;

              // Fetch settlements for this faction
              const settlementsResult = yield* Effect.tryPromise({
                try: () =>
                  client`SELECT * FROM faction_settlement WHERE faction_id = ${factionId}`,
                catch: (error) =>
                  new DatabaseError({ operation: "findById.faction.settlements", error }),
              });

              // Keep as raw plain objects — decodeActivity handles the full tree decode
              const settlements = settlementsResult.rows.map(mapRowToFactionSettlement);

              // Fetch stations for this faction
              const stationsResult = yield* Effect.tryPromise({
                try: () =>
                  client`SELECT * FROM faction_station WHERE faction_id = ${factionId}`,
                catch: (error) =>
                  new DatabaseError({ operation: "findById.faction.stations", error }),
              });

              const stations = stationsResult.rows.map(mapRowToFactionStation);

              const factionData = Object.assign({}, mapRowToFaction(factionRow), {
                czgroundSettlements: settlements,
                stations,
              });
              factionsData.push(factionData);
            }

            const systemData = Object.assign({}, mapRowToSystem(systemRow), { factions: factionsData });
            systemsData.push(systemData);
          }

          const activityData = Object.assign({}, mapRowToActivity(activityRow), { systems: systemsData });
          const activity = yield* decodeActivity(activityData).pipe(
            Effect.mapError(
              (error) => new DatabaseError({ operation: "decode.activity", error })
            )
          );

          return Option.some(activity);
        }),

      findByTickId: (tickId) =>
        Effect.gen(function* () {
          const activityResult = yield* Effect.tryPromise({
            try: () =>
              client`SELECT * FROM activity WHERE tickid = ${tickId} ORDER BY timestamp`,
            catch: (error) =>
              new DatabaseError({ operation: "findByTickId.activity", error }),
          });

          const activityRow = activityResult.rows[0];
          if (!activityRow) return Option.none();

          const activityId = activityRow.id as ActivityId;
          return yield* repo.findById(activityId);
        }),

      findByDateRange: (startDate, endDate) =>
        Effect.gen(function* () {
          const activityResult = yield* Effect.tryPromise({
            try: () =>
              client`SELECT id FROM activity WHERE timestamp >= ${startDate} AND timestamp <= ${endDate} ORDER BY timestamp`,
            catch: (error) =>
              new DatabaseError({ operation: "findByDateRange.activity", error }),
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
              client`SELECT id FROM activity WHERE cmdr = ${cmdr} ORDER BY timestamp`,
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
