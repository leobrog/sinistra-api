import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { EventRepository } from "../../domain/repositories.ts";
import { Event } from "../../domain/models.ts";
import { DatabaseError } from "../../domain/errors.ts";

// Helper to map DB row to Event domain model
const mapRowToEvent = (row: any): unknown => ({
  id: row.id,
  event: row.event,
  timestamp: row.timestamp,
  tickid: row.tickid,
  ticktime: row.ticktime,
  cmdr: row.cmdr === null ? undefined : row.cmdr,
  starsystem: row.starsystem === null ? undefined : row.starsystem,
  systemaddress: row.systemaddress === null ? undefined : row.systemaddress,
  rawJson: row.raw_json === null ? undefined : row.raw_json,
});

export const EventRepositoryLive = Layer.effect(
  EventRepository,
  Effect.gen(function* () {
    const client = yield* TursoClient;
    const decodeEvent = Schema.decodeUnknown(Event);

    return EventRepository.of({
      createEvent: (event, subEvents) =>
        Effect.gen(function* () {
          const stmts: Array<{ sql: string; args: unknown[] }> = []

          // Main event
          stmts.push({
            sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress, raw_json)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              event.id,
              event.event,
              event.timestamp,
              event.tickid,
              event.ticktime,
              Option.getOrNull(event.cmdr),
              Option.getOrNull(event.starsystem),
              Option.getOrNull(event.systemaddress),
              Option.getOrNull(event.rawJson),
            ],
          })

          if (subEvents?.marketBuy) {
            for (const marketBuy of subEvents.marketBuy) {
              stmts.push({
                sql: `INSERT INTO market_buy_event (id, event_id, stock, stock_bracket, value, count)
                      VALUES (?, ?, ?, ?, ?, ?)`,
                args: [marketBuy.id, marketBuy.eventId, Option.getOrNull(marketBuy.stock), Option.getOrNull(marketBuy.stockBracket), Option.getOrNull(marketBuy.value), Option.getOrNull(marketBuy.count)],
              })
            }
          }

          if (subEvents?.marketSell) {
            for (const marketSell of subEvents.marketSell) {
              stmts.push({
                sql: `INSERT INTO market_sell_event (id, event_id, demand, demand_bracket, profit, value, count)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [marketSell.id, marketSell.eventId, Option.getOrNull(marketSell.demand), Option.getOrNull(marketSell.demandBracket), Option.getOrNull(marketSell.profit), Option.getOrNull(marketSell.value), Option.getOrNull(marketSell.count)],
              })
            }
          }

          if (subEvents?.missionCompleted) {
            for (const { event: mission, influences } of subEvents.missionCompleted) {
              stmts.push({
                sql: `INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward)
                      VALUES (?, ?, ?, ?, ?)`,
                args: [mission.id, mission.eventId, Option.getOrNull(mission.awardingFaction), Option.getOrNull(mission.missionName), Option.getOrNull(mission.reward)],
              })
              for (const influence of influences) {
                stmts.push({
                  sql: `INSERT INTO mission_completed_influence (id, mission_id, system, influence, trend, faction_name, reputation, reputation_trend, effect, effect_trend)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  args: [influence.id, influence.missionId, Option.getOrNull(influence.systemAddress), Option.getOrNull(influence.influence), Option.getOrNull(influence.trend), Option.getOrNull(influence.factionName), Option.getOrNull(influence.reputation), Option.getOrNull(influence.reputationTrend), Option.getOrNull(influence.effect), Option.getOrNull(influence.effectTrend)],
                })
              }
            }
          }

          if (subEvents?.factionKillBond) {
            for (const killBond of subEvents.factionKillBond) {
              stmts.push({
                sql: `INSERT INTO faction_kill_bond_event (id, event_id, killer_ship, awarding_faction, victim_faction, reward)
                      VALUES (?, ?, ?, ?, ?, ?)`,
                args: [killBond.id, killBond.eventId, Option.getOrNull(killBond.killerShip), Option.getOrNull(killBond.awardingFaction), Option.getOrNull(killBond.victimFaction), Option.getOrNull(killBond.reward)],
              })
            }
          }

          if (subEvents?.missionFailed) {
            for (const failed of subEvents.missionFailed) {
              stmts.push({
                sql: `INSERT INTO mission_failed_event (id, event_id, mission_name, awarding_faction, fine)
                      VALUES (?, ?, ?, ?, ?)`,
                args: [failed.id, failed.eventId, Option.getOrNull(failed.missionName), Option.getOrNull(failed.awardingFaction), Option.getOrNull(failed.fine)],
              })
            }
          }

          if (subEvents?.multiSellExplorationData) {
            for (const explData of subEvents.multiSellExplorationData) {
              stmts.push({
                sql: `INSERT INTO multi_sell_exploration_data_event (id, event_id, total_earnings)
                      VALUES (?, ?, ?)`,
                args: [explData.id, explData.eventId, Option.getOrNull(explData.totalEarnings)],
              })
            }
          }

          if (subEvents?.redeemVoucher) {
            for (const voucher of subEvents.redeemVoucher) {
              stmts.push({
                sql: `INSERT INTO redeem_voucher_event (id, event_id, amount, faction, type)
                      VALUES (?, ?, ?, ?, ?)`,
                args: [voucher.id, voucher.eventId, Option.getOrNull(voucher.amount), Option.getOrNull(voucher.faction), Option.getOrNull(voucher.type)],
              })
            }
          }

          if (subEvents?.sellExplorationData) {
            for (const sellExpl of subEvents.sellExplorationData) {
              stmts.push({
                sql: `INSERT INTO sell_exploration_data_event (id, event_id, earnings)
                      VALUES (?, ?, ?)`,
                args: [sellExpl.id, sellExpl.eventId, Option.getOrNull(sellExpl.earnings)],
              })
            }
          }

          if (subEvents?.commitCrime) {
            for (const crime of subEvents.commitCrime) {
              stmts.push({
                sql: `INSERT INTO commit_crime_event (id, event_id, crime_type, faction, victim, victim_faction, bounty)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [crime.id, crime.eventId, Option.getOrNull(crime.crimeType), Option.getOrNull(crime.faction), Option.getOrNull(crime.victim), Option.getOrNull(crime.victimFaction), Option.getOrNull(crime.bounty)],
              })
            }
          }

          if (subEvents?.syntheticGroundCZ) {
            for (const groundCz of subEvents.syntheticGroundCZ) {
              stmts.push({
                sql: `INSERT INTO synthetic_ground_cz (id, event_id, cz_type, settlement, faction, cmdr, station_faction_name)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [groundCz.id, groundCz.eventId, Option.getOrNull(groundCz.czType), Option.getOrNull(groundCz.settlement), Option.getOrNull(groundCz.faction), Option.getOrNull(groundCz.cmdr), Option.getOrNull(groundCz.stationFactionName)],
              })
            }
          }

          if (subEvents?.syntheticCZ) {
            for (const cz of subEvents.syntheticCZ) {
              stmts.push({
                sql: `INSERT INTO synthetic_cz (id, event_id, cz_type, faction, cmdr, station_faction_name)
                      VALUES (?, ?, ?, ?, ?, ?)`,
                args: [cz.id, cz.eventId, Option.getOrNull(cz.czType), Option.getOrNull(cz.faction), Option.getOrNull(cz.cmdr), Option.getOrNull(cz.stationFactionName)],
              })
            }
          }

          yield* Effect.tryPromise({
            try: () => client.batch(stmts as any),
            catch: (error) => new DatabaseError({ operation: "create.event", error }),
          })
        }),

      findById: (id) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM event WHERE id = ?",
                args: [id],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findById.event", error }),
          });

          const row = result.rows[0];
          if (!row) return Option.none();

          const event = yield* decodeEvent(mapRowToEvent(row)).pipe(
            Effect.mapError(
              (error) => new DatabaseError({ operation: "decode.event", error })
            )
          );

          return Option.some(event);
        }),

      findByTickId: (tickId) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM event WHERE tickid = ? ORDER BY timestamp",
                args: [tickId],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findByTickId.event", error }),
          });

          const events: Event[] = [];
          for (const row of result.rows) {
            const event = yield* decodeEvent(mapRowToEvent(row)).pipe(
              Effect.mapError(
                (error) =>
                  new DatabaseError({ operation: "decode.event", error })
              )
            );
            events.push(event);
          }

          return events;
        }),

      findByDateRange: (startDate, endDate) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM event WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp",
                args: [startDate, endDate],
              }),
            catch: (error) =>
              new DatabaseError({ operation: "findByDateRange.event", error }),
          });

          const events: Event[] = [];
          for (const row of result.rows) {
            const event = yield* decodeEvent(mapRowToEvent(row)).pipe(
              Effect.mapError(
                (error) =>
                  new DatabaseError({ operation: "decode.event", error })
              )
            );
            events.push(event);
          }

          return events;
        }),

      getDistinctCmdrNames: (limit) =>
        Effect.gen(function* () {
          const limitClause = limit ? `LIMIT ${limit}` : "";
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: `SELECT DISTINCT cmdr FROM event WHERE cmdr IS NOT NULL ORDER BY cmdr ${limitClause}`,
                args: [],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "getDistinctCmdrNames.event",
                error,
              }),
          });

          return result.rows.map((row: any) => row.cmdr as string);
        }),
    });
  })
);
