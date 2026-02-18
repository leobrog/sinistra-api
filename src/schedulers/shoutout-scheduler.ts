/**
 * Shoutout Scheduler
 *
 * Posts daily BGS summaries to Discord at 20:00, 20:01, 20:02 UTC.
 * Uses the "last tick" period: the second most recent distinct tickid.
 *
 * Three jobs:
 *   20:00 UTC — Tick summary        → BGS webhook
 *   20:01 UTC — Space CZ summary    → conflict webhook
 *   20:02 UTC — Ground CZ summary   → shoutout webhook
 *
 * Based on VALKFlaskServer/fac_shoutout_scheduler.py
 */

import { Effect, Duration, Option } from "effect"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"

// ---------------------------------------------------------------------------
// Cron helper
// ---------------------------------------------------------------------------

/** Milliseconds until the next HH:MM UTC (today or tomorrow) */
const msUntilUtcTime = (hour: number, minute = 0): number => {
  const now = new Date()
  const next = new Date()
  next.setUTCHours(hour, minute, 0, 0)
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Get the last-tick tickid (second most recent distinct tickid in event table) */
const getLastTickId = async (client: Client): Promise<string | null> => {
  const result = await client.execute(
    "SELECT DISTINCT tickid FROM event ORDER BY timestamp DESC LIMIT 2"
  )
  // Prefer second row (previous tick), fall back to first if only one exists
  const row = result.rows[1] ?? result.rows[0]
  return (row?.tickid as string | undefined) ?? null
}

/** Post content to a Discord webhook, splitting on newlines if > 2000 chars */
const postToDiscord = async (webhookUrl: string, content: string): Promise<void> => {
  let remaining = content
  while (remaining.length > 0) {
    let chunk: string
    if (remaining.length <= 2000) {
      chunk = remaining
      remaining = ""
    } else {
      const split = remaining.lastIndexOf("\n", 2000)
      const cutAt = split > 0 ? split : 2000
      chunk = remaining.slice(0, cutAt)
      remaining = remaining.slice(cutAt + (split > 0 ? 1 : 0))
    }
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: chunk }),
      signal: AbortSignal.timeout(10_000),
    })
  }
}

// ---------------------------------------------------------------------------
// Job 1 — BGS tick summary (BGS webhook)
// ---------------------------------------------------------------------------

const buildTickSummary = async (client: Client, tickId: string): Promise<string> => {
  const [influenceRows, missionsRows, czRows, marketRows] = await Promise.all([
    client.execute({
      sql: `SELECT e.starsystem, mci.faction_name, e.cmdr, SUM(LENGTH(mci.influence)) AS influence
            FROM mission_completed_influence mci
            JOIN mission_completed_event mce ON mce.id = mci.mission_id
            JOIN event e ON e.id = mce.event_id
            WHERE e.starsystem IS NOT NULL AND e.tickid = ?
            GROUP BY e.starsystem, mci.faction_name, e.cmdr
            ORDER BY influence DESC, e.starsystem LIMIT 5`,
      args: [tickId],
    }),
    client.execute({
      sql: `SELECT e.starsystem, mc.awarding_faction, e.cmdr, COUNT(*) AS missions_completed
            FROM mission_completed_event mc
            JOIN event e ON e.id = mc.event_id
            WHERE e.starsystem IS NOT NULL AND e.tickid = ?
            GROUP BY e.starsystem, mc.awarding_faction, e.cmdr
            ORDER BY missions_completed DESC LIMIT 5`,
      args: [tickId],
    }),
    client.execute({
      sql: `SELECT scz.faction, e.starsystem, scz.cz_type, e.cmdr, COUNT(*) AS cz_count
            FROM synthetic_cz scz
            JOIN event e ON e.id = scz.event_id
            WHERE e.starsystem IS NOT NULL AND e.tickid = ?
            GROUP BY e.starsystem, scz.faction, scz.cz_type, e.cmdr
            ORDER BY cz_count DESC LIMIT 5`,
      args: [tickId],
    }),
    client.execute({
      sql: `SELECT e.starsystem, e.cmdr,
                   SUM(COALESCE(mb.value, 0)) AS total_buy,
                   SUM(COALESCE(ms.value, 0)) AS total_sell,
                   SUM(COALESCE(mb.value, 0)) + SUM(COALESCE(ms.value, 0)) AS total_volume,
                   SUM(COALESCE(mb.count, 0)) + SUM(COALESCE(ms.count, 0)) AS quantity
            FROM event e
            LEFT JOIN market_buy_event mb ON mb.event_id = e.id
            LEFT JOIN market_sell_event ms ON ms.event_id = e.id
            WHERE e.starsystem IS NOT NULL AND e.tickid = ?
            GROUP BY e.starsystem, e.cmdr
            HAVING total_volume > 0
            ORDER BY quantity DESC LIMIT 5`,
      args: [tickId],
    }),
  ])

  const lines: string[] = [`**📊 BGS Tick Summary** (tick: \`${tickId}\`)`, ""]

  if (influenceRows.rows.length > 0) {
    lines.push("**Influence by System / Faction / Cmdr**")
    for (const r of influenceRows.rows) {
      lines.push(`  ${r.starsystem} | ${r.faction_name} | ${r.cmdr} — ${r.influence} influence`)
    }
    lines.push("")
  }

  if (missionsRows.rows.length > 0) {
    lines.push("**Missions Completed by System / Faction / Cmdr**")
    for (const r of missionsRows.rows) {
      lines.push(
        `  ${r.starsystem} | ${r.awarding_faction} | ${r.cmdr} — ${r.missions_completed} missions`
      )
    }
    lines.push("")
  }

  if (czRows.rows.length > 0) {
    lines.push("**Conflict Zones by System / Faction / Cmdr**")
    for (const r of czRows.rows) {
      lines.push(`  ${r.starsystem} | ${r.faction} | ${r.cmdr} — ${r.cz_count}× ${r.cz_type}`)
    }
    lines.push("")
  }

  if (marketRows.rows.length > 0) {
    lines.push("**Market Events by System / Cmdr**")
    for (const r of marketRows.rows) {
      lines.push(
        `  ${r.starsystem} | ${r.cmdr} — qty: ${r.quantity}, vol: ${r.total_volume} cr`
      )
    }
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Job 2 — Space CZ summary (conflict webhook)
// ---------------------------------------------------------------------------

const buildSpaceCzSummary = async (client: Client, tickId: string): Promise<string> => {
  const result = await client.execute({
    sql: `SELECT e.starsystem AS system, scz.cz_type, e.cmdr, COUNT(*) AS cz_count
          FROM synthetic_cz scz
          JOIN event e ON e.id = scz.event_id
          WHERE e.tickid = ?
          GROUP BY e.starsystem, scz.cz_type, e.cmdr
          ORDER BY e.starsystem, scz.cz_type, cz_count DESC`,
    args: [tickId],
  })

  if (result.rows.length === 0) return ""

  const lines: string[] = [`**⚔️ Space CZ Summary** (tick: \`${tickId}\`)`, ""]
  let currentSystem = ""
  let currentType = ""

  for (const r of result.rows) {
    const system = String(r.system)
    const type = String(r.cz_type ?? "unknown")
    if (system !== currentSystem) {
      currentSystem = system
      currentType = ""
      lines.push(`\n**${system}**`)
    }
    if (type !== currentType) {
      currentType = type
      lines.push(`  _${type}_`)
    }
    lines.push(`    ${r.cmdr}: ${r.cz_count}`)
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Job 3 — Ground CZ summary (shoutout webhook)
// ---------------------------------------------------------------------------

const buildGroundCzSummary = async (client: Client, tickId: string): Promise<string> => {
  const result = await client.execute({
    sql: `SELECT e.starsystem AS system, sgcz.settlement, sgcz.cz_type, e.cmdr, COUNT(*) AS cz_count
          FROM synthetic_ground_cz sgcz
          JOIN event e ON e.id = sgcz.event_id
          WHERE e.tickid = ?
          GROUP BY e.starsystem, sgcz.settlement, sgcz.cz_type, e.cmdr
          ORDER BY e.starsystem, sgcz.settlement, sgcz.cz_type, cz_count DESC`,
    args: [tickId],
  })

  if (result.rows.length === 0) return ""

  const lines: string[] = [`**🪖 Ground CZ Summary** (tick: \`${tickId}\`)`, ""]
  let currentSystem = ""
  let currentSettlement = ""

  for (const r of result.rows) {
    const system = String(r.system)
    const settlement = String(r.settlement ?? "Unknown")
    const type = String(r.cz_type ?? "unknown")
    if (system !== currentSystem) {
      currentSystem = system
      currentSettlement = ""
      lines.push(`\n**${system}**`)
    }
    if (settlement !== currentSettlement) {
      currentSettlement = settlement
      lines.push(`  _${settlement}_`)
    }
    lines.push(`    ${r.cmdr}: ${r.cz_count}× ${type}`)
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Main fiber
// ---------------------------------------------------------------------------

export const runShoutoutScheduler: Effect.Effect<never, never, AppConfig | TursoClient> =
  Effect.gen(function* () {
    const config = yield* AppConfig
    const client = yield* TursoClient

    yield* Effect.logInfo("Shoutout scheduler started")

    const runDaily = Effect.gen(function* () {
      const ms = msUntilUtcTime(20, 0)
      yield* Effect.logInfo(`Shoutout scheduler: next run in ${Math.round(ms / 60000)}m`)
      yield* Effect.sleep(Duration.millis(ms))

      yield* Effect.logInfo("Shoutout scheduler: running daily jobs")

      const bgsWebhook = Option.getOrNull(config.discord.webhooks.bgs)
      const conflictWebhook = Option.getOrNull(config.discord.webhooks.conflict)
      const shoutoutWebhook = Option.getOrNull(config.discord.webhooks.shoutout)

      const tickId = yield* Effect.tryPromise({
        try: () => getLastTickId(client),
        catch: (e) => new Error(`Failed to get last tickid: ${e}`),
      }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`).pipe(Effect.as(null))))

      if (!tickId) {
        yield* Effect.logWarning("Shoutout scheduler: no tick data found, skipping")
        return
      }

      // Job 1: BGS tick summary → bgs webhook
      if (bgsWebhook) {
        yield* Effect.tryPromise({
          try: async () => {
            const summary = await buildTickSummary(client, tickId)
            if (summary.trim()) await postToDiscord(bgsWebhook, summary)
          },
          catch: (e) => new Error(`BGS summary failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`Shoutout BGS error: ${e}`)))
        yield* Effect.logInfo("Shoutout: BGS summary sent")
      }

      yield* Effect.sleep(Duration.minutes(1))

      // Job 2: Space CZ → conflict webhook
      if (conflictWebhook) {
        yield* Effect.tryPromise({
          try: async () => {
            const summary = await buildSpaceCzSummary(client, tickId)
            if (summary.trim()) await postToDiscord(conflictWebhook, summary)
          },
          catch: (e) => new Error(`Space CZ summary failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`Shoutout space CZ error: ${e}`)))
        yield* Effect.logInfo("Shoutout: Space CZ summary sent")
      }

      yield* Effect.sleep(Duration.minutes(1))

      // Job 3: Ground CZ → shoutout webhook
      if (shoutoutWebhook) {
        yield* Effect.tryPromise({
          try: async () => {
            const summary = await buildGroundCzSummary(client, tickId)
            if (summary.trim()) await postToDiscord(shoutoutWebhook, summary)
          },
          catch: (e) => new Error(`Ground CZ summary failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`Shoutout ground CZ error: ${e}`)))
        yield* Effect.logInfo("Shoutout: Ground CZ summary sent")
      }

      yield* Effect.logInfo("Shoutout scheduler: daily jobs complete")
    })

    return yield* Effect.forever(runDaily)
  }).pipe(
    Effect.catchAll((e) => Effect.logError(`Shoutout scheduler fatal: ${e}`))
  ) as Effect.Effect<never, never, AppConfig | TursoClient>
