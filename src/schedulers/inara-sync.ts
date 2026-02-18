/**
 * Inara Sync Scheduler
 *
 * Daily at 01:00 UTC: iterate all CMDRs in the DB, fetch their Inara
 * profile, and update rank/squadron data. Respects Inara's rate limit
 * by sleeping 60 seconds between each request. Aborts the batch if
 * rate-limited (same behaviour as cmdr_sync_inara.py).
 *
 * Uses TursoClient directly rather than CmdrRepository to keep
 * consistent with the other schedulers and avoid the full domain stack.
 *
 * Based on VALKFlaskServer/cmdr_sync_inara.py
 */

import { Effect, Duration } from "effect"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"
import { fetchCmdrProfile, profileToDbValues, InaraRateLimitError } from "../services/inara.js"

// ---------------------------------------------------------------------------
// Cron helper
// ---------------------------------------------------------------------------

const msUntilUtcTime = (hour: number, minute = 0): number => {
  const now = new Date()
  const next = new Date()
  next.setUTCHours(hour, minute, 0, 0)
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}

// ---------------------------------------------------------------------------
// DB update
// ---------------------------------------------------------------------------

const updateCmdrRanks = (
  client: Client,
  cmdrId: string,
  vals: ReturnType<typeof profileToDbValues>
): Effect.Effect<void, Error> =>
  Effect.tryPromise({
    try: () =>
      client.execute({
        sql: `UPDATE cmdr
              SET rank_combat = ?, rank_trade = ?, rank_explore = ?, rank_cqc = ?,
                  rank_empire = ?, rank_federation = ?, rank_power = ?,
                  inara_url = ?, squadron_name = ?, squadron_rank = ?
              WHERE id = ?`,
        args: [
          vals.rankCombat !== null ? String(vals.rankCombat) : null,
          vals.rankTrade !== null ? String(vals.rankTrade) : null,
          vals.rankExplore !== null ? String(vals.rankExplore) : null,
          vals.rankCqc !== null ? String(vals.rankCqc) : null,
          vals.rankEmpire !== null ? String(vals.rankEmpire) : null,
          vals.rankFederation !== null ? String(vals.rankFederation) : null,
          vals.rankPower,
          vals.inaraUrl,
          vals.squadronName,
          vals.squadronRank,
          cmdrId,
        ],
      }),
    catch: (e) => new Error(`DB update failed for cmdr ${cmdrId}: ${e}`),
  }).pipe(Effect.asVoid)

// ---------------------------------------------------------------------------
// Main fiber
// ---------------------------------------------------------------------------

export const runInaraSync: Effect.Effect<never, never, AppConfig | TursoClient> = Effect.gen(
  function* () {
    const config = yield* AppConfig
    const client = yield* TursoClient

    yield* Effect.logInfo("Inara sync scheduler started")

    const runSync = Effect.gen(function* () {
      const ms = msUntilUtcTime(1, 0)
      yield* Effect.logInfo(`Inara sync: next run in ${Math.round(ms / 60000)}m`)
      yield* Effect.sleep(Duration.millis(ms))

      yield* Effect.logInfo("Inara sync: starting daily CMDR sync")

      // Fetch all CMDRs
      const cmdrResult = yield* Effect.tryPromise({
        try: () => client.execute("SELECT id, name FROM cmdr ORDER BY name"),
        catch: (e) => new Error(`Failed to fetch CMDRs: ${e}`),
      }).pipe(
        Effect.catchAll((e) =>
          Effect.logWarning(`Inara sync: CMDR fetch error: ${e}`).pipe(
            Effect.as({ rows: [] as any[] })
          )
        )
      )

      const cmdrs = cmdrResult.rows
      yield* Effect.logInfo(`Inara sync: processing ${cmdrs.length} CMDRs`)

      let synced = 0
      let skipped = 0
      let rateLimited = false

      for (const row of cmdrs) {
        if (rateLimited) break

        const cmdrId = String(row.id)
        const cmdrName = String(row.name)

        // Fetch profile and update DB; handle rate-limit and other errors
        const outcome = yield* fetchCmdrProfile(cmdrName, config.inara.apiKey).pipe(
          Effect.flatMap((profile) => updateCmdrRanks(client, cmdrId, profileToDbValues(profile))),
          Effect.map(() => "synced" as const),
          Effect.catchTag("InaraRateLimitError", (_e: InaraRateLimitError) =>
            Effect.succeed("rate_limited" as const)
          ),
          Effect.catchAll((e) =>
            Effect.logWarning(`Inara sync: skipped ${cmdrName}: ${e}`).pipe(
              Effect.as("skipped" as const)
            )
          )
        )

        if (outcome === "rate_limited") {
          rateLimited = true
          yield* Effect.logWarning(`Inara sync: rate limited after ${synced} CMDRs, aborting batch`)
          break
        }

        if (outcome === "synced") {
          synced++
          yield* Effect.logInfo(`Inara sync: updated ${cmdrName}`)
        } else {
          skipped++
        }

        // 60s between requests to respect Inara rate limits
        yield* Effect.sleep(Duration.seconds(60))
      }

      yield* Effect.logInfo(
        `Inara sync complete: ${synced} updated, ${skipped} skipped${rateLimited ? ", rate limited" : ""}`
      )
    })

    return yield* Effect.forever(runSync)
  }
).pipe(
  Effect.catchAll((e) => Effect.logError(`Inara sync fatal: ${e}`))
) as Effect.Effect<never, never, AppConfig | TursoClient>
