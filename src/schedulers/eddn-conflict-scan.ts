/**
 * EDDN Conflict Scan (hourly)
 *
 * Reads eddn_conflict (populated by the live EDDN ZMQ feed) every hour,
 * filters for tracked factions, and diffs against conflict_state using the
 * same logic as the tick-based conflict scheduler.
 *
 * This acts as a fallback: if no commander submits a FSDJump/Location event
 * through a conflicted system during a tick, this scan will still detect and
 * notify about conflict changes sourced from community EDDN traffic.
 *
 * Both this scanner and the tick-based scheduler share conflict_state, so
 * Discord notifications are only sent when something actually changes.
 */

import { Effect, Duration, Schedule } from "effect"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient, EddnTursoClient } from "../database/client.js"
import type { ConflictEntry } from "./conflict-scheduler.js"
import { runConflictDiff } from "./conflict-scheduler.js"

// ---------------------------------------------------------------------------
// Extract conflicts from eddn_conflict for tracked factions
// ---------------------------------------------------------------------------

/**
 * Reads eddn_conflict from the EDDN DB using eddnClient.
 * Filters in-memory to conflicts involving tracked factions, since
 * protected_faction lives in the main DB and a cross-DB SQL JOIN is not possible.
 */
const extractEddnConflicts = async (
  eddnClient: Client,
  factionNames: Set<string>
): Promise<Map<string, ConflictEntry>> => {
  const result = await eddnClient.execute(`
    SELECT system_name, faction1, faction2,
           stake1, stake2, won_days1, won_days2, war_type
    FROM eddn_conflict
  `)

  const map = new Map<string, ConflictEntry>()
  for (const row of result.rows) {
    const system = String(row.system_name ?? "")
    if (!system) continue

    const f1 = String(row.faction1 ?? "")
    const f2 = String(row.faction2 ?? "")
    if (!factionNames.has(f1) && !factionNames.has(f2)) continue

    // If multiple conflicts in same system involve tracked factions, last write wins
    map.set(system, {
      warType: String(row.war_type ?? "unknown"),
      faction1: f1,
      faction2: f2,
      stake1: String(row.stake1 ?? ""),
      stake2: String(row.stake2 ?? ""),
      wonDays1: Number(row.won_days1 ?? 0),
      wonDays2: Number(row.won_days2 ?? 0),
    })
  }
  return map
}

// ---------------------------------------------------------------------------
// Main fiber — runs every hour
// ---------------------------------------------------------------------------

export const runEddnConflictScan: Effect.Effect<never, never, AppConfig | TursoClient | EddnTursoClient> =
  Effect.gen(function* () {
    const config = yield* AppConfig
    const client = yield* TursoClient          // main DB — has protected_faction, conflict_state
    const eddnClient = yield* EddnTursoClient  // EDDN DB — has eddn_conflict
    const webhookUrls = config.discord.webhooks.conflict
    const debugWebhookUrls = config.discord.webhooks.debug

    yield* Effect.logInfo("EDDN conflict scan started (hourly)")

    const scanOnce = Effect.gen(function* () {

      const factionNames = yield* Effect.tryPromise({
        try: async () => {
          const result = await client.execute("SELECT name FROM protected_faction")
          return new Set(result.rows.map((r) => String(r.name)))
        },
        catch: (e) => new Error(`Load protected factions failed: ${e}`),
      }).pipe(
        Effect.catchAll((e) =>
          Effect.logWarning(`EDDN conflict scan: ${e}`).pipe(Effect.as(new Set<string>()))
        )
      )

      if (factionNames.size === 0) {
        yield* Effect.logWarning("EDDN conflict scan: no protected factions found, skipping")
        return
      }

      const currentConflicts = yield* Effect.tryPromise({
        try: () => extractEddnConflicts(eddnClient, factionNames),
        catch: (e) => new Error(`EDDN conflict extraction failed: ${e}`),
      }).pipe(
        Effect.catchAll((e) =>
          Effect.logWarning(`${e}`).pipe(Effect.as(new Map<string, ConflictEntry>()))
        )
      )

      yield* Effect.logInfo(
        `EDDN conflict scan: found ${currentConflicts.size} conflict(s) in EDDN data`
      )

      // If the query returned nothing while we have tracked factions, the EDDN
      // client may not have populated the table yet (e.g. race on startup).
      // Skip the diff entirely rather than triggering spurious "conflict ended"
      // cleanup that would delete all conflict_state entries.
      if (currentConflicts.size === 0) {
        yield* Effect.logWarning("EDDN conflict scan: no conflicts found, skipping diff")
        return
      }

      yield* runConflictDiff(
        client,
        webhookUrls,
        debugWebhookUrls,
        currentConflicts,
        factionNames,
        new Date().toISOString(),
        "EDDN conflict scan",
        { cleanupScope: new Set<string>() }
      )
    })

    return yield* Effect.repeat(scanOnce, Schedule.spaced(Duration.hours(1)))
  }).pipe(
    Effect.catchAll((e) => Effect.logError(`EDDN conflict scan fatal: ${e}`))
  ) as Effect.Effect<never, never, AppConfig | TursoClient | EddnTursoClient>
