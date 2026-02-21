/**
 * Conflict Scheduler
 *
 * Every 6 hours at 00:00, 06:00, 12:00, 18:00 UTC:
 * - Reads the current tick's events from raw_json
 * - Finds Conflicts[] entries involving our faction
 * - Posts a summary to the BGS Discord webhook
 *
 * Based on VALKFlaskServer/fac_in_conflict.py + fac_conflict_scheduler.py
 */

import { Effect, Duration, Option } from "effect"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"

// ---------------------------------------------------------------------------
// Cron helper
// ---------------------------------------------------------------------------

/** Milliseconds until the next 6-hourly UTC boundary: 00:00, 06:00, 12:00, 18:00 */
const msUntilNextSixHourly = (): number => {
  const now = new Date()
  const h = now.getUTCHours()
  const targets = [0, 6, 12, 18]
  const nextHour = targets.find((t) => t > h)
  const next = new Date()
  if (nextHour !== undefined) {
    next.setUTCHours(nextHour, 0, 0, 0)
  } else {
    // Past 18:00 — next boundary is 00:00 tomorrow
    next.setUTCDate(next.getUTCDate() + 1)
    next.setUTCHours(0, 0, 0, 0)
  }
  return next.getTime() - now.getTime()
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

interface ConflictEntry {
  warType: string
  faction1: string
  faction2: string
  stake1: string
  stake2: string
  wonDays1: number
  wonDays2: number
  cmdrs: Set<string>
  detectedAt: string
}

/**
 * Parse raw_json for each event in the given tick, extract conflicts
 * where our faction appears as Faction1 or Faction2. Deduplicates by
 * system, keeping the most recent jump (same logic as fac_in_conflict.py).
 */
const extractConflicts = async (
  client: Client,
  tickId: string,
  factionName: string
): Promise<Map<string, ConflictEntry>> => {
  const result = await client.execute({
    sql: "SELECT raw_json, cmdr, timestamp FROM event WHERE tickid = ? AND raw_json IS NOT NULL",
    args: [tickId],
  })

  const conflicts = new Map<string, ConflictEntry>()

  for (const row of result.rows) {
    let parsed: any
    try {
      parsed = JSON.parse(String(row.raw_json))
    } catch {
      continue
    }

    const eventType: string = parsed?.event ?? ""
    if (!["FSDJump", "Location"].includes(eventType)) continue

    const system: string = parsed?.StarSystem ?? ""
    if (!system) continue

    const rawConflicts: any[] = parsed?.Conflicts ?? []
    const timestamp: string = String(row.timestamp ?? "")
    const cmdrName: string = String(row.cmdr ?? "Unknown")

    for (const c of rawConflicts) {
      const f1: string = c?.Faction1?.Name ?? ""
      const f2: string = c?.Faction2?.Name ?? ""
      if (f1 !== factionName && f2 !== factionName) continue

      const existing = conflicts.get(system)
      if (!existing || timestamp > existing.detectedAt) {
        const cmdrs = existing?.cmdrs ?? new Set<string>()
        cmdrs.add(cmdrName)
        conflicts.set(system, {
          warType: c?.WarType ?? "unknown",
          faction1: f1,
          faction2: f2,
          stake1: c?.Faction1?.Stake ?? "",
          stake2: c?.Faction2?.Stake ?? "",
          wonDays1: c?.Faction1?.WonDays ?? 0,
          wonDays2: c?.Faction2?.WonDays ?? 0,
          cmdrs,
          detectedAt: timestamp,
        })
      } else {
        existing.cmdrs.add(cmdrName)
      }
    }
  }

  return conflicts
}

const formatConflictMessage = (
  tickId: string,
  conflicts: Map<string, ConflictEntry>
): string => {
  const lines: string[] = [
    `**⚔️ Active Conflicts — Current Tick** (\`${tickId}\`)`,
    "",
  ]

  for (const [system, entry] of conflicts.entries()) {
    const typeLabel =
      entry.warType === "war"
        ? "🔴 War"
        : entry.warType === "election"
          ? "🗳️ Election"
          : `⚔️ ${entry.warType}`

    lines.push(`**${system}** — ${typeLabel}`)
    lines.push(
      `  ${entry.faction1}: ${entry.wonDays1} days won | Stake: ${entry.stake1 || "none"}`
    )
    lines.push(
      `  ${entry.faction2}: ${entry.wonDays2} days won | Stake: ${entry.stake2 || "none"}`
    )
    if (entry.cmdrs.size > 0) {
      lines.push(`  CMDRs: ${[...entry.cmdrs].join(", ")}`)
    }
    lines.push(`  Detected: ${entry.detectedAt}`)
    lines.push("")
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Main fiber
// ---------------------------------------------------------------------------

export const runConflictScheduler: Effect.Effect<never, never, AppConfig | TursoClient> =
  Effect.gen(function* () {
    const config = yield* AppConfig
    const client = yield* TursoClient
    const factionName = config.faction.name

    yield* Effect.logInfo("Conflict scheduler started")

    const runCheck = Effect.gen(function* () {
      const ms = msUntilNextSixHourly()
      yield* Effect.logInfo(`Conflict scheduler: next check in ${Math.round(ms / 60000)}m`)
      yield* Effect.sleep(Duration.millis(ms))

      yield* Effect.logInfo("Conflict scheduler: checking for active conflicts")

      const webhookUrl = Option.getOrNull(config.discord.webhooks.bgs)
      if (!webhookUrl) {
        yield* Effect.logWarning("Conflict scheduler: no BGS webhook configured, skipping")
        return
      }

      // Get current tick
      const tickResult = yield* Effect.tryPromise({
        try: () =>
          client.execute(
            "SELECT DISTINCT tickid FROM event ORDER BY timestamp DESC LIMIT 1"
          ),
        catch: (e) => new Error(`Failed to get current tick: ${e}`),
      }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`).pipe(Effect.as(null))))

      if (!tickResult?.rows[0]) {
        yield* Effect.logWarning("Conflict scheduler: no tick data found, skipping")
        return
      }

      const tickId = String(tickResult.rows[0].tickid)

      // Extract conflicts from raw_json
      const conflicts = yield* Effect.tryPromise({
        try: () => extractConflicts(client, tickId, factionName),
        catch: (e) => new Error(`Conflict extraction failed: ${e}`),
      }).pipe(
        Effect.catchAll((e) =>
          Effect.logWarning(`Conflict extraction error: ${e}`).pipe(
            Effect.as(new Map<string, ConflictEntry>())
          )
        )
      )

      if (conflicts.size === 0) {
        yield* Effect.logInfo(
          `Conflict scheduler: no active conflicts for ${factionName} in tick ${tickId}`
        )
        return
      }

      // Post to Discord
      const message = formatConflictMessage(tickId, conflicts)
      yield* Effect.tryPromise({
        try: () =>
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: message }),
            signal: AbortSignal.timeout(10_000),
          }),
        catch: (e) => new Error(`Discord post failed: ${e}`),
      }).pipe(Effect.catchAll((e) => Effect.logWarning(`Conflict Discord error: ${e}`)))

      yield* Effect.logInfo(
        `Conflict scheduler: posted ${conflicts.size} conflict(s) for tick ${tickId}`
      )
    })

    return yield* Effect.forever(runCheck)
  }).pipe(
    Effect.catchAll((e) => Effect.logError(`Conflict scheduler fatal: ${e}`))
  ) as Effect.Effect<never, never, AppConfig | TursoClient>
