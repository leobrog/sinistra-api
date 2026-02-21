/**
 * EDDN Client Fiber
 *
 * Connects to the EDDN ZMQ feed, processes Location/FSDJump messages,
 * and upserts system/faction/conflict/powerplay data into the DB.
 *
 * Uses TursoClient directly (DELETE + INSERT pattern) to replace stale
 * per-system data on each update.
 */

import { Effect, Ref, Schedule, Duration } from "effect"
import { inflateSync } from "node:zlib"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Delete all derived data for a system before re-inserting */
const deleteSystemData = async (client: Client, systemName: string) => {
  await client.batch([
    { sql: "DELETE FROM eddn_system_info WHERE system_name = ?", args: [systemName] },
    { sql: "DELETE FROM eddn_faction WHERE system_name = ?", args: [systemName] },
    { sql: "DELETE FROM eddn_conflict WHERE system_name = ?", args: [systemName] },
    { sql: "DELETE FROM eddn_powerplay WHERE system_name = ?", args: [systemName] },
  ])
}

/** Save one parsed EDDN message to the DB */
const saveEddnData = async (client: Client, data: any): Promise<void> => {
  const msg = data?.message ?? {}
  const messageType: string = msg.event ?? ""

  if (!["Location", "FSDJump"].includes(messageType)) return

  const systemName: string | undefined = msg.StarSystem
  if (!systemName) return

  const now = new Date().toISOString()
  const msgId = crypto.randomUUID()

  // 1. Save raw message
  await client.execute({
    sql: `INSERT INTO eddn_message (id, schema_ref, header_gateway_timestamp, message_type, message_json, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      msgId,
      data?.["$schemaRef"] ?? "",
      data?.header?.gatewayTimestamp ?? null,
      messageType,
      JSON.stringify(data),
      now,
    ],
  })

  // 2. Delete stale data for this system
  await deleteSystemData(client, systemName)

  // 3. Insert new system info
  await client.execute({
    sql: `INSERT INTO eddn_system_info (id, eddn_message_id, system_name, controlling_faction, controlling_power, population, security, government, allegiance, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      msgId,
      systemName,
      msg.SystemFaction?.Name ?? null,
      msg.ControllingPower ?? null,
      msg.Population ?? null,
      msg.SystemSecurity ?? null,
      msg.SystemGovernment ?? null,
      msg.SystemAllegiance ?? null,
      now,
    ],
  })

  // 4. Insert factions
  const factions: any[] = msg.Factions ?? []
  for (const f of factions) {
    await client.execute({
      sql: `INSERT INTO eddn_faction (id, eddn_message_id, system_name, name, influence, state, allegiance, government, recovering_states, active_states, pending_states, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        msgId,
        systemName,
        f.Name ?? "Unknown",
        f.Influence ?? null,
        f.FactionState ?? null,
        f.Allegiance ?? null,
        f.Government ?? null,
        f.RecoveringStates ? JSON.stringify(f.RecoveringStates) : null,
        f.ActiveStates ? JSON.stringify(f.ActiveStates) : null,
        f.PendingStates ? JSON.stringify(f.PendingStates) : null,
        now,
      ],
    })
  }

  // 5. Insert conflicts
  const conflicts: any[] = msg.Conflicts ?? []
  for (const c of conflicts) {
    await client.execute({
      sql: `INSERT INTO eddn_conflict (id, eddn_message_id, system_name, faction1, faction2, stake1, stake2, won_days1, won_days2, status, war_type, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        msgId,
        systemName,
        c.Faction1?.Name ?? null,
        c.Faction2?.Name ?? null,
        c.Faction1?.Stake ?? null,
        c.Faction2?.Stake ?? null,
        c.Faction1?.WonDays ?? null,
        c.Faction2?.WonDays ?? null,
        c.Status ?? null,
        c.WarType ?? null,
        now,
      ],
    })
  }

  // 6. Insert powerplay (if present)
  const hasPowerplay = "Powers" in msg || "PowerplayState" in msg
  if (hasPowerplay) {
    const powers = msg.Powers
    await client.execute({
      sql: `INSERT INTO eddn_powerplay (id, eddn_message_id, system_name, power, powerplay_state, control_progress, reinforcement, undermining, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        msgId,
        systemName,
        powers ? JSON.stringify(Array.isArray(powers) ? powers : [powers]) : null,
        msg.PowerplayState ?? null,
        msg.PowerplayStateControlProgress ?? null,
        msg.PowerplayStateReinforcement ?? null,
        msg.PowerplayStateUndermining ?? null,
        now,
      ],
    })
  }
}

/** Delete eddn_message rows older than retentionMs */
const cleanupOldMessages = (client: Client, retentionMs: number) =>
  Effect.tryPromise({
    try: async () => {
      const cutoff = new Date(Date.now() - retentionMs).toISOString()
      const result = await client.execute({
        sql: "DELETE FROM eddn_message WHERE timestamp < ?",
        args: [cutoff],
      })
      return result.rowsAffected
    },
    catch: (e) => new Error(`Cleanup failed: ${e}`),
  }).pipe(
    Effect.tap((n) => (n > 0 ? Effect.logInfo(`EDDN: cleaned up ${n} old messages`) : Effect.void)),
    Effect.catchAll((e) => Effect.logWarning(`EDDN cleanup error: ${e}`))
  )

// ---------------------------------------------------------------------------
// Main fiber
// ---------------------------------------------------------------------------

export const runEddnClient: Effect.Effect<never, never, AppConfig | TursoClient> = Effect.gen(
  function* () {
    const config = yield* AppConfig
    const client = yield* TursoClient

    // Dynamic import so missing native bindings don't crash startup
    const zmq = yield* Effect.tryPromise({
      try: () => import("zeromq"),
      catch: (e) => new Error(`zeromq import failed: ${e}`),
    })

    const socket = new zmq.Subscriber()
    socket.connect(config.eddn.zmqUrl)
    socket.subscribe("") // subscribe to all topics

    yield* Effect.logInfo(`EDDN client connected to ${config.eddn.zmqUrl}`)

    const lastCleanupRef = yield* Ref.make(Date.now())

    // One iteration: receive one message, process it, maybe cleanup
    const receiveOnce = Effect.gen(function* () {
      const [rawMsg] = yield* Effect.tryPromise({
        try: () => socket.receive() as Promise<[Buffer]>,
        catch: (e) => new Error(`ZMQ receive error: ${e}`),
      })

      // Decompress (zlib format)
      const data = yield* Effect.try({
        try: () => {
          const decompressed = inflateSync(rawMsg!)
          return JSON.parse(decompressed.toString("utf-8")) as unknown
        },
        catch: (e) => new Error(`Decompress/parse failed: ${e}`),
      }).pipe(Effect.catchAll((e) => Effect.logDebug(`EDDN skip: ${e}`).pipe(Effect.as(null))))

      if (data !== null) {
        yield* Effect.tryPromise({
          try: () => saveEddnData(client, data),
          catch: (e) => new Error(`Save EDDN data failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`EDDN save error: ${e}`)))
      }

      // Periodic cleanup
      const lastCleanup = yield* Ref.get(lastCleanupRef)
      const now = Date.now()
      if (now - lastCleanup > config.eddn.cleanupIntervalMs) {
        yield* Ref.set(lastCleanupRef, now)
        yield* cleanupOldMessages(client, config.eddn.messageRetentionMs)
      }
    })

    return yield* Effect.forever(receiveOnce)
  }
).pipe(
  Effect.retry(Schedule.spaced(Duration.seconds(5))),
  Effect.catchAll((e) => Effect.logError(`EDDN client fatal: ${e}`))
) as Effect.Effect<never, never, AppConfig | TursoClient>
