/**
 * EDDN Client Fiber
 *
 * Connects to the EDDN ZMQ feed, processes Location/FSDJump messages,
 * and upserts system/faction/conflict/powerplay data into the DB.
 *
 * Collects BATCH_SIZE messages before writing, so the SQLite write lock
 * is acquired once per batch rather than once per message.
 */

import { Effect, Ref, Schedule, Duration } from "effect"
import { inflateSync } from "node:zlib"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Stmt = { sql: string; args: unknown[] }

/** Build SQL statements for one parsed EDDN message — pure, no DB access */
const buildEddnStmts = (data: any): Stmt[] => {
  const stmts: Stmt[] = []
  const msg = data?.message ?? {}
  const messageType: string = msg.event ?? ""

  if (!["Location", "FSDJump"].includes(messageType)) return stmts

  const systemName: string | undefined = msg.StarSystem
  if (!systemName) return stmts

  const now = new Date().toISOString()
  const msgId = crypto.randomUUID()

  // 1. Raw message
  stmts.push({
    sql: `INSERT INTO eddn_message (id, schema_ref, header_gateway_timestamp, message_type, message_json, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [msgId, data?.["$schemaRef"] ?? "", data?.header?.gatewayTimestamp ?? null, messageType, JSON.stringify(data), now],
  })

  // 2. Delete stale derived data for this system
  stmts.push({ sql: "DELETE FROM eddn_system_info WHERE system_name = ?", args: [systemName] })
  stmts.push({ sql: "DELETE FROM eddn_faction WHERE system_name = ?", args: [systemName] })
  stmts.push({ sql: "DELETE FROM eddn_conflict WHERE system_name = ?", args: [systemName] })
  stmts.push({ sql: "DELETE FROM eddn_powerplay WHERE system_name = ?", args: [systemName] })

  // 3. System info
  stmts.push({
    sql: `INSERT INTO eddn_system_info (id, eddn_message_id, system_name, controlling_faction, controlling_power, population, security, government, allegiance, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), msgId, systemName, msg.SystemFaction?.Name ?? null, msg.ControllingPower ?? null, msg.Population ?? null, msg.SystemSecurity ?? null, msg.SystemGovernment ?? null, msg.SystemAllegiance ?? null, now],
  })

  // 4. Factions
  for (const f of (msg.Factions ?? []) as any[]) {
    stmts.push({
      sql: `INSERT INTO eddn_faction (id, eddn_message_id, system_name, name, influence, state, allegiance, government, recovering_states, active_states, pending_states, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), msgId, systemName, f.Name ?? "Unknown", f.Influence ?? null, f.FactionState ?? null, f.Allegiance ?? null, f.Government ?? null, f.RecoveringStates ? JSON.stringify(f.RecoveringStates) : null, f.ActiveStates ? JSON.stringify(f.ActiveStates) : null, f.PendingStates ? JSON.stringify(f.PendingStates) : null, now],
    })
  }

  // 5. Conflicts
  for (const c of (msg.Conflicts ?? []) as any[]) {
    stmts.push({
      sql: `INSERT INTO eddn_conflict (id, eddn_message_id, system_name, faction1, faction2, stake1, stake2, won_days1, won_days2, status, war_type, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), msgId, systemName, c.Faction1?.Name ?? null, c.Faction2?.Name ?? null, c.Faction1?.Stake ?? null, c.Faction2?.Stake ?? null, c.Faction1?.WonDays ?? null, c.Faction2?.WonDays ?? null, c.Status ?? null, c.WarType ?? null, now],
    })
  }

  // 6. Powerplay (if present)
  if ("Powers" in msg || "PowerplayState" in msg) {
    const powers = msg.Powers
    stmts.push({
      sql: `INSERT INTO eddn_powerplay (id, eddn_message_id, system_name, power, powerplay_state, control_progress, reinforcement, undermining, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), msgId, systemName, powers ? JSON.stringify(Array.isArray(powers) ? powers : [powers]) : null, msg.PowerplayState ?? null, msg.PowerplayStateControlProgress ?? null, msg.PowerplayStateReinforcement ?? null, msg.PowerplayStateUndermining ?? null, now],
    })
  }

  return stmts
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

/** Number of ZMQ messages to accumulate before a single DB write */
const BATCH_SIZE = 20

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

    // One iteration: receive BATCH_SIZE messages, build statements, write once
    const receiveBatch = Effect.gen(function* () {
      const allStmts: Stmt[] = []

      for (let i = 0; i < BATCH_SIZE; i++) {
        const [rawMsg] = yield* Effect.tryPromise({
          try: () => socket.receive() as Promise<[Buffer]>,
          catch: (e) => new Error(`ZMQ receive error: ${e}`),
        })

        const data = yield* Effect.try({
          try: () => {
            const decompressed = inflateSync(rawMsg!)
            return JSON.parse(decompressed.toString("utf-8")) as unknown
          },
          catch: (e) => new Error(`Decompress/parse failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logDebug(`EDDN skip: ${e}`).pipe(Effect.as(null))))

        if (data !== null) {
          allStmts.push(...buildEddnStmts(data))
        }
      }

      if (allStmts.length > 0) {
        yield* Effect.tryPromise({
          try: () => client.batch(allStmts as any),
          catch: (e) => new Error(`Batch write failed: ${e}`),
        }).pipe(Effect.catchAll((e) => Effect.logWarning(`EDDN batch error: ${e}`)))
      }

      // Periodic cleanup
      const lastCleanup = yield* Ref.get(lastCleanupRef)
      const now = Date.now()
      if (now - lastCleanup > config.eddn.cleanupIntervalMs) {
        yield* Ref.set(lastCleanupRef, now)
        yield* cleanupOldMessages(client, config.eddn.messageRetentionMs)
      }
    })

    return yield* Effect.forever(receiveBatch)
  }
).pipe(
  Effect.retry(Schedule.spaced(Duration.seconds(5))),
  Effect.catchAll((e) => Effect.logError(`EDDN client fatal: ${e}`))
) as Effect.Effect<never, never, AppConfig | TursoClient>
