/**
 * Conflict Scheduler (event-driven)
 *
 * Subscribes to TickBus. On each new tick:
 *  1. Extracts current conflicts from raw_json events
 *  2. Loads previous state from conflict_state table
 *  3. Diffs and posts per-event Discord messages:
 *     - New conflict started
 *     - Day scored (wonDays incremented)
 *     - War won/lost (either faction reaches 4 wins)
 *  4. Upserts/deletes conflict_state accordingly
 *
 * Replaces the previous 6-hourly bulk-notification approach.
 */

import { Effect, Option, PubSub, Queue } from "effect"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"
import { TickBus } from "../services/TickBus.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConflictEntry {
  warType: string
  faction1: string
  faction2: string
  stake1: string
  stake2: string
  wonDays1: number
  wonDays2: number
  updatedAt?: string  // ISO string, set from DB — used for TTL cleanup
}

// ---------------------------------------------------------------------------
// Conflict detection (from raw EDDN events)
// ---------------------------------------------------------------------------

/**
 * Parse raw_json for each event in the given tick, extract conflicts
 * where our faction appears as Faction1 or Faction2. Deduplicates by
 * system, keeping the most recent jump entry.
 */
const extractConflicts = async (
  client: Client,
  tickId: string,
  factionName: string
): Promise<Map<string, ConflictEntry>> => {
  const result = await client.execute({
    sql: "SELECT raw_json, timestamp FROM event WHERE tickid = ? AND raw_json IS NOT NULL",
    args: [tickId],
  })

  const raw = new Map<string, ConflictEntry & { detectedAt: string }>()

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

    for (const c of rawConflicts) {
      const f1: string = c?.Faction1?.Name ?? ""
      const f2: string = c?.Faction2?.Name ?? ""
      if (f1 !== factionName && f2 !== factionName) continue

      const existing = raw.get(system)
      if (!existing || timestamp > existing.detectedAt) {
        raw.set(system, {
          warType: c?.WarType ?? "unknown",
          faction1: f1,
          faction2: f2,
          stake1: c?.Faction1?.Stake ?? "",
          stake2: c?.Faction2?.Stake ?? "",
          wonDays1: c?.Faction1?.WonDays ?? 0,
          wonDays2: c?.Faction2?.WonDays ?? 0,
          detectedAt: timestamp,
        })
      }
    }
  }

  const out = new Map<string, ConflictEntry>()
  for (const [system, { detectedAt: _unused, ...entry }] of raw.entries()) {
    out.set(system, entry)
  }
  return out
}

// ---------------------------------------------------------------------------
// DB persistence
// ---------------------------------------------------------------------------

const loadConflictState = async (client: Client): Promise<Map<string, ConflictEntry>> => {
  const result = await client.execute("SELECT * FROM conflict_state")
  const map = new Map<string, ConflictEntry>()
  for (const row of result.rows) {
    map.set(String(row.system), {
      warType: String(row.war_type),
      faction1: String(row.faction1),
      faction2: String(row.faction2),
      stake1: String(row.stake1 ?? ""),
      stake2: String(row.stake2 ?? ""),
      wonDays1: Number(row.won_days1),
      wonDays2: Number(row.won_days2),
    })
  }
  return map
}

const upsertConflictState = async (
  client: Client,
  system: string,
  entry: ConflictEntry,
  tickId: string
): Promise<void> => {
  await client.execute({
    sql: `INSERT INTO conflict_state
            (system, faction1, faction2, war_type, won_days1, won_days2, stake1, stake2, last_tick_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(system) DO UPDATE SET
            faction1     = excluded.faction1,
            faction2     = excluded.faction2,
            war_type     = excluded.war_type,
            won_days1    = excluded.won_days1,
            won_days2    = excluded.won_days2,
            stake1       = excluded.stake1,
            stake2       = excluded.stake2,
            last_tick_id = excluded.last_tick_id,
            updated_at   = excluded.updated_at`,
    args: [
      system,
      entry.faction1,
      entry.faction2,
      entry.warType,
      entry.wonDays1,
      entry.wonDays2,
      entry.stake1,
      entry.stake2,
      tickId,
      new Date().toISOString(),
    ],
  })
}

const deleteConflictState = async (client: Client, system: string): Promise<void> => {
  await client.execute({
    sql: "DELETE FROM conflict_state WHERE system = ?",
    args: [system],
  })
}

// ---------------------------------------------------------------------------
// Message formatters
// ---------------------------------------------------------------------------

const typeLabel = (warType: string): string => {
  if (warType === "war") return "War"
  if (warType === "election") return "Election"
  if (warType === "civilwar") return "Civil War"
  return warType
}

const formatNewConflict = (system: string, entry: ConflictEntry): string =>
  [
    `⚔️ New conflict in **${system}**`,
    `${entry.faction1} vs ${entry.faction2} (${typeLabel(entry.warType)})`,
    `Score: ${entry.wonDays1} – ${entry.wonDays2}${entry.stake1 ? ` | Stake: ${entry.stake1}` : ""}`,
  ].join("\n")

const formatDayScored = (
  system: string,
  current: ConflictEntry,
  prev: ConflictEntry
): string => {
  const f1Arrow = current.wonDays1 > prev.wonDays1 ? " ←" : ""
  const f2Arrow = current.wonDays2 > prev.wonDays2 ? " ←" : ""
  const stakeLabel = current.stake1 || current.stake2
  return [
    `📅 Day scored in **${system}**`,
    `${current.faction1}: ${current.wonDays1} day${current.wonDays1 !== 1 ? "s" : ""}${f1Arrow} | ${current.faction2}: ${current.wonDays2} day${current.wonDays2 !== 1 ? "s" : ""}${f2Arrow}`,
    stakeLabel ? `Stake: ${stakeLabel}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

const formatConflictResolved = (
  system: string,
  entry: ConflictEntry,
  factionName: string
): string => {
  const ourSide = entry.faction1 === factionName ? 1 : 2
  const winner = entry.wonDays1 >= 4 ? 1 : 2
  const weWon = ourSide === winner
  const winScore = winner === 1 ? entry.wonDays1 : entry.wonDays2
  const loseScore = winner === 1 ? entry.wonDays2 : entry.wonDays1
  const winnerName = winner === 1 ? entry.faction1 : entry.faction2
  const stake = winner === 1 ? entry.stake1 : entry.stake2

  if (weWon) {
    return [
      `🏆 Conflict resolved in **${system}**`,
      `${winnerName} wins (${winScore} – ${loseScore})`,
      stake ? `Won: ${stake}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  } else {
    return [
      `💀 Conflict resolved in **${system}**`,
      `${winnerName} wins (${winScore} – ${loseScore})`,
      stake ? `Lost: ${stake}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  }
}

// ---------------------------------------------------------------------------
// Discord helper
// ---------------------------------------------------------------------------

const postToDiscord = (webhookUrl: string, content: string): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () =>
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(10_000),
      }),
    catch: (e) => new Error(`Discord post failed: ${e}`),
  }).pipe(
    Effect.asVoid,
    Effect.catchAll((e) => Effect.logWarning(`Conflict Discord error: ${e}`))
  )

// ---------------------------------------------------------------------------
// Per-tick diff + notification logic
// ---------------------------------------------------------------------------

export const runConflictCheck = (
  client: Client,
  factionName: string,
  webhookUrl: string | null,
  tickId: string
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Conflict scheduler: processing tick ${tickId}`)

    const [currentConflicts, prevState] = yield* Effect.all([
      Effect.tryPromise({
        try: () => extractConflicts(client, tickId, factionName),
        catch: (e) => new Error(`Conflict extraction failed: ${e}`),
      }).pipe(
        Effect.catchAll((e) =>
          Effect.logWarning(`${e}`).pipe(Effect.as(new Map<string, ConflictEntry>()))
        )
      ),
      Effect.tryPromise({
        try: () => loadConflictState(client),
        catch: (e) => new Error(`Load conflict state failed: ${e}`),
      }).pipe(
        Effect.catchAll((e) =>
          Effect.logWarning(`${e}`).pipe(Effect.as(new Map<string, ConflictEntry>()))
        )
      ),
    ])

    // --- Process systems present in the current tick ---
    for (const [system, current] of currentConflicts.entries()) {
      const prev = prevState.get(system)

      if (!prev) {
        // New conflict — insert state, notify
        yield* Effect.tryPromise({
          try: () => upsertConflictState(client, system, current, tickId),
          catch: (e) => new Error(`Upsert failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))

        if (webhookUrl) {
          yield* postToDiscord(webhookUrl, formatNewConflict(system, current))
        }
        yield* Effect.logInfo(`Conflict scheduler: new conflict in ${system}`)
        continue
      }

      // Conflict already known — check win condition first
      if (current.wonDays1 >= 4 || current.wonDays2 >= 4) {
        yield* Effect.tryPromise({
          try: () => deleteConflictState(client, system),
          catch: (e) => new Error(`Delete failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))

        if (webhookUrl) {
          yield* postToDiscord(
            webhookUrl,
            formatConflictResolved(system, current, factionName)
          )
        }
        yield* Effect.logInfo(`Conflict scheduler: conflict resolved in ${system}`)
        continue
      }

      // Day scored?
      if (current.wonDays1 > prev.wonDays1 || current.wonDays2 > prev.wonDays2) {
        yield* Effect.tryPromise({
          try: () => upsertConflictState(client, system, current, tickId),
          catch: (e) => new Error(`Upsert failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))

        if (webhookUrl) {
          yield* postToDiscord(webhookUrl, formatDayScored(system, current, prev))
        }
        yield* Effect.logInfo(`Conflict scheduler: day scored in ${system}`)
        continue
      }

      // Unchanged — just refresh the tick reference
      yield* Effect.tryPromise({
        try: () => upsertConflictState(client, system, current, tickId),
        catch: (e) => new Error(`Upsert failed: ${e}`),
      }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))
    }

    yield* Effect.logInfo(
      `Conflict scheduler: tick ${tickId} processed — ` +
        `${currentConflicts.size} active conflict(s)`
    )
  })

// ---------------------------------------------------------------------------
// Shared diff logic — accepts a pre-computed conflict map
// ---------------------------------------------------------------------------

export const runConflictDiff = (
  client: Client,
  webhookUrl: string | null,
  currentConflicts: Map<string, ConflictEntry>,
  factionNames: Set<string>,
  tickId: string,
  label: string,
  options: { cleanupScope: "all" | Set<string> }
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`${label}: processing ${currentConflicts.size} conflict(s)`)

    const prevState = yield* Effect.tryPromise({
      try: () => loadConflictState(client),
      catch: (e) => new Error(`Load conflict state failed: ${e}`),
    }).pipe(
      Effect.catchAll((e) =>
        Effect.logWarning(`${e}`).pipe(Effect.as(new Map<string, ConflictEntry>()))
      )
    )

    for (const [system, current] of currentConflicts.entries()) {
      const prev = prevState.get(system)

      if (!prev) {
        yield* Effect.tryPromise({
          try: () => upsertConflictState(client, system, current, tickId),
          catch: (e) => new Error(`Upsert failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))
        if (webhookUrl) {
          yield* postToDiscord(webhookUrl, formatNewConflict(system, current))
        }
        yield* Effect.logInfo(`${label}: new conflict in ${system}`)
        continue
      }

      if (current.wonDays1 >= 4 || current.wonDays2 >= 4) {
        yield* Effect.tryPromise({
          try: () => deleteConflictState(client, system),
          catch: (e) => new Error(`Delete failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))
        if (webhookUrl) {
          const ourFaction =
            [...factionNames].find((n) => n === current.faction1 || n === current.faction2) ??
            current.faction1
          yield* postToDiscord(webhookUrl, formatConflictResolved(system, current, ourFaction))
        }
        yield* Effect.logInfo(`${label}: conflict resolved in ${system}`)
        continue
      }

      if (current.wonDays1 > prev.wonDays1 || current.wonDays2 > prev.wonDays2) {
        yield* Effect.tryPromise({
          try: () => upsertConflictState(client, system, current, tickId),
          catch: (e) => new Error(`Upsert failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))
        if (webhookUrl) {
          yield* postToDiscord(webhookUrl, formatDayScored(system, current, prev))
        }
        yield* Effect.logInfo(`${label}: day scored in ${system}`)
        continue
      }

      yield* Effect.tryPromise({
        try: () => upsertConflictState(client, system, current, tickId),
        catch: (e) => new Error(`Upsert failed: ${e}`),
      }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))
    }

    for (const system of prevState.keys()) {
      if (currentConflicts.has(system)) continue
      const { cleanupScope } = options
      const scopeKind =
        cleanupScope === "all"
          ? "all"
          : cleanupScope instanceof Set && cleanupScope.has(system)
            ? "visited"
            : null
      if (scopeKind !== null) {
        const entry = prevState.get(system)!
        const reason =
          scopeKind === "all"
            ? `not found in ${label} scan`
            : `commander visited ${system} but no conflict detected in their journal`
        const debugMsg = [
          `🗑️ **[DEBUG] Deleting conflict in ${system}**`,
          `Reason: ${reason}`,
          `Was: ${entry.faction1} vs ${entry.faction2} (${typeLabel(entry.warType)})`,
          `Score: ${entry.wonDays1} – ${entry.wonDays2}${entry.stake1 ? ` | Stake: ${entry.stake1}` : ""}`,
          `Source: ${label}`,
        ].join("\n")
        yield* Effect.logWarning(
          `${label}: DELETING ${system} — ${reason} | was: ${entry.faction1} vs ${entry.faction2} score ${entry.wonDays1}-${entry.wonDays2}`
        )
        if (webhookUrl) {
          yield* postToDiscord(webhookUrl, debugMsg)
        }
        yield* Effect.tryPromise({
          try: () => deleteConflictState(client, system),
          catch: (e) => new Error(`Delete failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`${e}`)))
      }
    }

    yield* Effect.logInfo(`${label}: done — ${currentConflicts.size} active conflict(s)`)
  })

// ---------------------------------------------------------------------------
// Parse conflicts from in-memory FSDJump/Location event objects
// ---------------------------------------------------------------------------

export const parseConflictsFromEntries = (
  entries: ReadonlyArray<{ event: string; StarSystem?: string; Conflicts?: ReadonlyArray<unknown> }>,
  factionNames: Set<string>
): Map<string, ConflictEntry> => {
  const out = new Map<string, ConflictEntry>()

  for (const entry of entries) {
    if (!["FSDJump", "Location"].includes(entry.event)) continue
    const system = entry.StarSystem
    if (!system) continue

    for (const c of (entry.Conflicts ?? []) as any[]) {
      const f1: string = c?.Faction1?.Name ?? ""
      const f2: string = c?.Faction2?.Name ?? ""
      if (!factionNames.has(f1) && !factionNames.has(f2)) continue

      out.set(system, {
        warType: c?.WarType ?? "unknown",
        faction1: f1,
        faction2: f2,
        stake1: c?.Faction1?.Stake ?? "",
        stake2: c?.Faction2?.Stake ?? "",
        wonDays1: c?.Faction1?.WonDays ?? 0,
        wonDays2: c?.Faction2?.WonDays ?? 0,
      })
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Main fiber — subscribes to TickBus
// ---------------------------------------------------------------------------

export const runConflictScheduler: Effect.Effect<
  never,
  never,
  AppConfig | TursoClient | TickBus
> = Effect.gen(function* () {
  const config = yield* AppConfig
  const client = yield* TursoClient
  const bus = yield* TickBus
  const factionName = config.faction.name
  const webhookUrl = Option.getOrNull(config.discord.webhooks.bgs)

  yield* Effect.logInfo("Conflict scheduler started (event-driven, subscribed to TickBus)")

  return yield* Effect.scoped(
    Effect.gen(function* () {
      const sub = yield* PubSub.subscribe(bus)
      return yield* Effect.forever(
        Effect.gen(function* () {
          const tickId = yield* Queue.take(sub)
          yield* runConflictCheck(client, factionName, webhookUrl, tickId)
        })
      )
    })
  )
}).pipe(
  Effect.catchAll((e) => Effect.logError(`Conflict scheduler fatal: ${e}`))
) as Effect.Effect<never, never, AppConfig | TursoClient | TickBus>
