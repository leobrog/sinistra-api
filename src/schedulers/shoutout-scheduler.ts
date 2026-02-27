/**
 * Shoutout Scheduler (event-driven)
 *
 * Subscribes to TickBus. On each new tick, waits 15 minutes for EDDN data
 * to settle, then posts BGS summaries to Discord as embeds.
 *
 * Three jobs:
 *   Job 1 — BGS tick summary     → BGS webhook
 *   Job 2 — Space CZ summary     → conflict webhook
 *   Job 3 — Ground CZ summary    → shoutout webhook
 *
 * Based on VALKFlaskServer/fac_shoutout_scheduler.py
 */

import { Effect, Duration, Option, PubSub, Queue } from "effect"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"
import { TickBus } from "../services/TickBus.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscordEmbed {
  description: string
  color?: number
}

// ---------------------------------------------------------------------------
// Discord helper
// ---------------------------------------------------------------------------

/**
 * Post embeds to a Discord webhook.
 * Splits into multiple requests if needed (max 10 embeds, 6000 total chars per request).
 */
export const postEmbedsToDiscord = async (webhookUrl: string, embeds: DiscordEmbed[]): Promise<void> => {
  const chunks: DiscordEmbed[][] = []
  let current: DiscordEmbed[] = []
  let totalChars = 0

  for (const embed of embeds) {
    const len = embed.description.length
    if (current.length >= 10 || totalChars + len > 6000) {
      if (current.length > 0) chunks.push(current)
      current = []
      totalChars = 0
    }
    current.push(embed)
    totalChars += len
  }
  if (current.length > 0) chunks.push(current)

  for (const chunk of chunks) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: chunk }),
      signal: AbortSignal.timeout(10_000),
    })
  }
}

// ---------------------------------------------------------------------------
// EDDN context
// ---------------------------------------------------------------------------

/** Fetch our faction's influence % and active states per system. */
const getOurFactionBySystem = async (
  client: Client,
  factionName: string
): Promise<Map<string, { influence: number | null; states: string[] }>> => {
  const result = await client.execute({
    sql: "SELECT system_name, influence, active_states FROM eddn_faction WHERE name = ?",
    args: [factionName],
  })

  const map = new Map<string, { influence: number | null; states: string[] }>()
  for (const row of result.rows) {
    const system = String(row.system_name)
    const influence = row.influence != null ? Number(row.influence) : null
    let states: string[] = []
    try {
      const parsed = JSON.parse(String(row.active_states ?? "[]"))
      if (Array.isArray(parsed)) states = parsed.map(String)
    } catch {
      // ignore malformed JSON
    }
    map.set(system, { influence, states })
  }
  return map
}

/** Format EDDN context as a ↳ line, or empty string if no data. */
const factionContext = (
  system: string,
  eddnMap: Map<string, { influence: number | null; states: string[] }>
): string => {
  const entry = eddnMap.get(system)
  if (!entry) return ""
  const inf = entry.influence !== null ? `${entry.influence.toFixed(1)}%` : "?"
  const states = entry.states.length > 0 ? entry.states.join(" · ") : "None"
  return `_↳ ${inf} · ${states}_`
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const formatVolume = (cr: number): string => {
  if (cr >= 1_000_000) return `${(cr / 1_000_000).toFixed(1)}M cr`
  if (cr >= 1_000) return `${(cr / 1_000).toFixed(1)}K cr`
  return `${cr} cr`
}

const formatQty = (n: number): string => n.toLocaleString("en-US")

const DIVIDER = "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄"

const sectionHeader = (emoji: string, title: string): string =>
  `${emoji} **${title}**\n${DIVIDER}`

const groupHeader = (label: string): string => `${DIVIDER}\n**${label}**`

// ---------------------------------------------------------------------------
// Job 1 — BGS tick summary (BGS webhook)
// ---------------------------------------------------------------------------

export const buildTickSummary = async (
  client: Client,
  tickId: string,
  factionName: string
): Promise<DiscordEmbed[]> => {
  const [influenceRows, missionsRows, czRows, marketRows, eddnCtx] = await Promise.all([
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
    getOurFactionBySystem(client, factionName),
  ])

  const header = `📊 BGS Tick Summary · ${tickId}`
  const embeds: DiscordEmbed[] = []

  if (influenceRows.rows.length > 0) {
    const lines = [header, "", sectionHeader("📈", "Influence")]
    for (const r of influenceRows.rows) {
      lines.push(`**${r.starsystem}** — ${r.faction_name} — ${r.cmdr}: +${r.influence}`)
      const ctxLine = factionContext(String(r.starsystem), eddnCtx)
      if (ctxLine) lines.push(ctxLine)
    }
    embeds.push({ description: lines.join("\n"), color: 3447003 })
  }

  if (missionsRows.rows.length > 0) {
    const lines = [header, "", sectionHeader("📋", "Missions")]
    for (const r of missionsRows.rows) {
      lines.push(`**${r.starsystem}** — ${r.awarding_faction} — ${r.cmdr}: ×${r.missions_completed}`)
      const ctxLine = factionContext(String(r.starsystem), eddnCtx)
      if (ctxLine) lines.push(ctxLine)
    }
    embeds.push({ description: lines.join("\n"), color: 3447003 })
  }

  if (marketRows.rows.length > 0) {
    const lines = [header, "", sectionHeader("💰", "Market")]
    for (const r of marketRows.rows) {
      lines.push(
        `**${r.starsystem}** — ${r.cmdr}: ${formatVolume(Number(r.total_volume))} / ${formatQty(Number(r.quantity))}t`
      )
    }
    embeds.push({ description: lines.join("\n"), color: 3447003 })
  }

  if (czRows.rows.length > 0) {
    const lines = [header, "", sectionHeader("⚔️", "CZs")]
    for (const r of czRows.rows) {
      lines.push(`**${r.starsystem}** — ${r.faction} — ${r.cmdr}: ${r.cz_count}× ${r.cz_type}`)
      const ctxLine = factionContext(String(r.starsystem), eddnCtx)
      if (ctxLine) lines.push(ctxLine)
    }
    embeds.push({ description: lines.join("\n"), color: 3447003 })
  }

  return embeds
}

// ---------------------------------------------------------------------------
// Job 2 — Space CZ summary (conflict webhook)
// ---------------------------------------------------------------------------

export const buildSpaceCzSummary = async (client: Client, tickId: string): Promise<DiscordEmbed[]> => {
  const result = await client.execute({
    sql: `SELECT e.starsystem AS system, scz.cz_type, e.cmdr, COUNT(*) AS cz_count
          FROM synthetic_cz scz
          JOIN event e ON e.id = scz.event_id
          WHERE e.tickid = ?
          GROUP BY e.starsystem, scz.cz_type, e.cmdr
          ORDER BY e.starsystem, scz.cz_type, cz_count DESC`,
    args: [tickId],
  })

  if (result.rows.length === 0) return []

  // Group: system → type → cmdr list
  const bySystem = new Map<string, Map<string, Array<{ cmdr: string; count: number }>>>()
  for (const r of result.rows) {
    const system = String(r.system)
    const type = String(r.cz_type ?? "unknown")
    if (!bySystem.has(system)) bySystem.set(system, new Map())
    const byType = bySystem.get(system)!
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type)!.push({ cmdr: String(r.cmdr), count: Number(r.cz_count) })
  }

  const lines = [`⚔️ Space CZs · ${tickId}`, ""]
  for (const [system, byType] of bySystem.entries()) {
    lines.push(groupHeader(system))
    for (const [type, cmdrs] of byType.entries()) {
      const cmdrList = cmdrs.map((c) => `${c.cmdr}: ×${c.count}`).join(", ")
      lines.push(`${type.padEnd(5)} · ${cmdrList}`)
    }
  }

  return [{ description: lines.join("\n"), color: 15844367 }]
}

// ---------------------------------------------------------------------------
// Job 3 — Ground CZ summary (shoutout webhook)
// ---------------------------------------------------------------------------

export const buildGroundCzSummary = async (client: Client, tickId: string): Promise<DiscordEmbed[]> => {
  const result = await client.execute({
    sql: `SELECT e.starsystem AS system, sgcz.settlement, sgcz.cz_type, e.cmdr, COUNT(*) AS cz_count
          FROM synthetic_ground_cz sgcz
          JOIN event e ON e.id = sgcz.event_id
          WHERE e.tickid = ? AND sgcz.settlement IS NOT NULL
          GROUP BY e.starsystem, sgcz.settlement, sgcz.cz_type, e.cmdr
          ORDER BY e.starsystem, sgcz.settlement, sgcz.cz_type, cz_count DESC`,
    args: [tickId],
  })

  if (result.rows.length === 0) return []

  // Group: "system — settlement" → type → cmdr list
  const bySysSettl = new Map<string, Map<string, Array<{ cmdr: string; count: number }>>>()
  for (const r of result.rows) {
    const key = `${r.system} — ${r.settlement}`
    const type = String(r.cz_type ?? "unknown")
    if (!bySysSettl.has(key)) bySysSettl.set(key, new Map())
    const byType = bySysSettl.get(key)!
    if (!byType.has(type)) byType.set(type, [])
    byType.get(type)!.push({ cmdr: String(r.cmdr), count: Number(r.cz_count) })
  }

  const lines = [`🪖 Ground CZs · ${tickId}`, ""]
  for (const [key, byType] of bySysSettl.entries()) {
    lines.push(groupHeader(key))
    for (const [type, cmdrs] of byType.entries()) {
      const cmdrList = cmdrs.map((c) => `${c.cmdr}: ×${c.count}`).join(", ")
      lines.push(`${type.padEnd(5)} · ${cmdrList}`)
    }
  }

  return [{ description: lines.join("\n"), color: 10038562 }]
}

// ---------------------------------------------------------------------------
// Main fiber — subscribes to TickBus
// ---------------------------------------------------------------------------

export const runShoutoutScheduler: Effect.Effect<
  never,
  never,
  AppConfig | TursoClient | TickBus
> = Effect.gen(function* () {
  const config = yield* AppConfig
  const client = yield* TursoClient
  const bus = yield* TickBus
  const factionName = config.faction.name

  yield* Effect.logInfo("Shoutout scheduler started (event-driven, subscribed to TickBus)")

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const sub = yield* PubSub.subscribe(bus)
      return yield* Effect.forever(
        Effect.gen(function* () {
          const currentTick = yield* Queue.take(sub)
          yield* Effect.logInfo(
            `Shoutout scheduler: received tick ${currentTick}, waiting 15 minutes`
          )
          yield* Effect.sleep(Duration.minutes(15))

          // Resolve the Zoy hash tickid for the just-completed period.
          // Events carry hash IDs (e.g. "zoy-XXXX"), not ISO timestamps, so we
          // find the most recent distinct tickid from events submitted before the
          // new tick's ISO timestamp — that is the completed tick's hash.
          const completedTickHash = yield* Effect.tryPromise({
            try: async () => {
              const result = await client.execute({
                sql: "SELECT DISTINCT tickid FROM event WHERE tickid IS NOT NULL AND timestamp < ? ORDER BY timestamp DESC LIMIT 1",
                args: [currentTick],
              })
              return result.rows[0]?.tickid as string | undefined
            },
            catch: (e) => new Error(`Tick hash lookup failed: ${e}`),
          }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`).pipe(Effect.as(undefined))))

          if (!completedTickHash) {
            yield* Effect.logInfo(
              `Shoutout scheduler: skipping ${currentTick} — no events found before this tick`
            )
            return
          }

          yield* Effect.logInfo(
            `Shoutout scheduler: running jobs for completed tick ${completedTickHash}`
          )

          const bgsWebhook = Option.getOrNull(config.discord.webhooks.bgs)
          const conflictWebhook = Option.getOrNull(config.discord.webhooks.conflict)
          const shoutoutWebhook = Option.getOrNull(config.discord.webhooks.shoutout)

          let totalSent = 0

          // Job 1: BGS tick summary → bgs webhook
          if (bgsWebhook) {
            yield* Effect.tryPromise({
              try: async () => {
                const embeds = await buildTickSummary(client, completedTickHash, factionName)
                if (embeds.length > 0) {
                  await postEmbedsToDiscord(bgsWebhook, embeds)
                  return embeds.length
                }
                return 0
              },
              catch: (e) => new Error(`BGS summary failed: ${e}`),
            }).pipe(
              Effect.flatMap((n) => {
                totalSent += n
                return n > 0
                  ? Effect.logInfo(`Shoutout: BGS summary sent (${n} embed(s))`)
                  : Effect.logInfo("Shoutout: BGS summary — no data for this tick")
              }),
              Effect.catchAll((e) => Effect.logWarning(`Shoutout BGS error: ${e}`))
            )
          }

          // Job 2: Space CZ → conflict webhook
          if (conflictWebhook) {
            yield* Effect.tryPromise({
              try: async () => {
                const embeds = await buildSpaceCzSummary(client, completedTickHash)
                if (embeds.length > 0) {
                  await postEmbedsToDiscord(conflictWebhook, embeds)
                  return embeds.length
                }
                return 0
              },
              catch: (e) => new Error(`Space CZ summary failed: ${e}`),
            }).pipe(
              Effect.flatMap((n) => {
                totalSent += n
                return n > 0
                  ? Effect.logInfo(`Shoutout: Space CZ summary sent (${n} embed(s))`)
                  : Effect.logInfo("Shoutout: Space CZ summary — no data for this tick")
              }),
              Effect.catchAll((e) => Effect.logWarning(`Shoutout space CZ error: ${e}`))
            )
          }

          // Job 3: Ground CZ → shoutout webhook
          if (shoutoutWebhook) {
            yield* Effect.tryPromise({
              try: async () => {
                const embeds = await buildGroundCzSummary(client, completedTickHash)
                if (embeds.length > 0) {
                  await postEmbedsToDiscord(shoutoutWebhook, embeds)
                  return embeds.length
                }
                return 0
              },
              catch: (e) => new Error(`Ground CZ summary failed: ${e}`),
            }).pipe(
              Effect.flatMap((n) => {
                totalSent += n
                return n > 0
                  ? Effect.logInfo(`Shoutout: Ground CZ summary sent (${n} embed(s))`)
                  : Effect.logInfo("Shoutout: Ground CZ summary — no data for this tick")
              }),
              Effect.catchAll((e) => Effect.logWarning(`Shoutout ground CZ error: ${e}`))
            )
          }

          // If no data was sent on any job, post a fallback "nothing happened" notice
          if (totalSent === 0) {
            const fallbackWebhook = bgsWebhook ?? conflictWebhook ?? shoutoutWebhook
            if (fallbackWebhook) {
              yield* Effect.tryPromise({
                try: () =>
                  postEmbedsToDiscord(fallbackWebhook, [
                    {
                      description: `📭 **No BGS activity recorded for tick ${completedTickHash}**\n_No missions, market trades, or CZ data found in the database for this tick._`,
                      color: 9807270, // grey
                    },
                  ]),
                catch: (e) => new Error(`Fallback notice failed: ${e}`),
              }).pipe(
                Effect.flatMap(() => Effect.logInfo("Shoutout: posted no-activity notice")),
                Effect.catchAll((e) => Effect.logWarning(`Shoutout fallback notice error: ${e}`))
              )
            }
          }

          yield* Effect.logInfo(`Shoutout scheduler: tick ${currentTick} jobs complete`)
        })
      )
    })
  )
}).pipe(
  Effect.catchAll((e) => Effect.logError(`Shoutout scheduler fatal: ${e}`))
) as Effect.Effect<never, never, AppConfig | TursoClient | TickBus>
