/**
 * EDDN Worker — runs as a standalone Node.js process.
 *
 * Bun cannot run zeromq (it uses uv_async_init which Bun doesn't support on
 * POSIX). This script is invoked with `node scripts/eddn-worker.mjs` alongside
 * the main Bun server, sharing the same SQLite database file.
 */

import { createClient } from "@libsql/client"
import { inflateSync } from "node:zlib"
import zmq from "zeromq"

const DB_URL = process.env.TURSO_DATABASE_URL ?? "file:./data/sinistra.db"
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? ""
const ZMQ_URL = process.env.EDDN_ZMQ_URL ?? "tcp://eddn.edcd.io:9500"
const CLEANUP_INTERVAL_MS = parseInt(process.env.EDDN_CLEANUP_INTERVAL_MS ?? "3600000")
const RETENTION_MS = parseInt(process.env.EDDN_MESSAGE_RETENTION_MS ?? "86400000")
const RETRY_DELAY_MS = 5000

const client = createClient({ url: DB_URL, authToken: AUTH_TOKEN })
await client.execute("PRAGMA busy_timeout = 3000")

// ---------------------------------------------------------------------------

async function saveEddnData(data) {
  const msg = data?.message ?? {}
  const messageType = msg.event ?? ""

  if (!["Location", "FSDJump"].includes(messageType)) return

  const systemName = msg.StarSystem
  if (!systemName) return

  const now = new Date().toISOString()
  const msgId = crypto.randomUUID()

  const statements = []

  // 1. Insert raw message
  statements.push({
    sql: `INSERT INTO eddn_message (id, schema_ref, header_gateway_timestamp, message_type, message_json, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [msgId, data?.["$schemaRef"] ?? "", data?.header?.gatewayTimestamp ?? null, messageType, JSON.stringify(data), now],
  })

  // 2. Delete stale system data
  statements.push({ sql: "DELETE FROM eddn_system_info WHERE system_name = ?", args: [systemName] })
  statements.push({ sql: "DELETE FROM eddn_faction WHERE system_name = ?", args: [systemName] })
  statements.push({ sql: "DELETE FROM eddn_conflict WHERE system_name = ?", args: [systemName] })
  statements.push({ sql: "DELETE FROM eddn_powerplay WHERE system_name = ?", args: [systemName] })

  // 3. Insert system info
  statements.push({
    sql: `INSERT INTO eddn_system_info (id, eddn_message_id, system_name, controlling_faction, controlling_power, population, security, government, allegiance, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(), msgId, systemName,
      msg.SystemFaction?.Name ?? null, msg.ControllingPower ?? null,
      msg.Population ?? null, msg.SystemSecurity ?? null,
      msg.SystemGovernment ?? null, msg.SystemAllegiance ?? null, now,
    ],
  })

  // 4. Factions
  for (const f of msg.Factions ?? []) {
    statements.push({
      sql: `INSERT INTO eddn_faction (id, eddn_message_id, system_name, name, influence, state, allegiance, government, recovering_states, active_states, pending_states, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(), msgId, systemName,
        f.Name ?? "Unknown", f.Influence ?? null, f.FactionState ?? null,
        f.Allegiance ?? null, f.Government ?? null,
        f.RecoveringStates ? JSON.stringify(f.RecoveringStates) : null,
        f.ActiveStates ? JSON.stringify(f.ActiveStates) : null,
        f.PendingStates ? JSON.stringify(f.PendingStates) : null,
        now,
      ],
    })
  }

  // 5. Conflicts
  for (const c of msg.Conflicts ?? []) {
    statements.push({
      sql: `INSERT INTO eddn_conflict (id, eddn_message_id, system_name, faction1, faction2, stake1, stake2, won_days1, won_days2, status, war_type, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(), msgId, systemName,
        c.Faction1?.Name ?? null, c.Faction2?.Name ?? null,
        c.Faction1?.Stake ?? null, c.Faction2?.Stake ?? null,
        c.Faction1?.WonDays ?? null, c.Faction2?.WonDays ?? null,
        c.Status ?? null, c.WarType ?? null, now,
      ],
    })
  }

  // 6. Powerplay
  if ("Powers" in msg || "PowerplayState" in msg) {
    const powers = msg.Powers
    statements.push({
      sql: `INSERT INTO eddn_powerplay (id, eddn_message_id, system_name, power, powerplay_state, control_progress, reinforcement, undermining, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(), msgId, systemName,
        powers ? JSON.stringify(Array.isArray(powers) ? powers : [powers]) : null,
        msg.PowerplayState ?? null, msg.PowerplayStateControlProgress ?? null,
        msg.PowerplayStateReinforcement ?? null, msg.PowerplayStateUndermining ?? null,
        now,
      ],
    })
  }

  await client.batch(statements, "write")
}

async function cleanupOldMessages() {
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()
  const result = await client.execute({ sql: "DELETE FROM eddn_message WHERE timestamp < ?", args: [cutoff] })
  if (result.rowsAffected > 0) console.log(`[EDDN] Cleaned up ${result.rowsAffected} old messages`)
}

// ---------------------------------------------------------------------------

async function run() {
  console.log(`[EDDN] Connecting to ${ZMQ_URL}`)
  const socket = new zmq.Subscriber()
  socket.connect(ZMQ_URL)
  socket.subscribe("")
  console.log("[EDDN] Connected, receiving messages...")

  let lastCleanup = Date.now()

  for await (const [raw] of socket) {
    try {
      const data = JSON.parse(inflateSync(raw).toString("utf-8"))
      await saveEddnData(data)
    } catch (e) {
      console.warn(`[EDDN] Skip: ${e?.message ?? e}`)
    }

    if (Date.now() - lastCleanup > CLEANUP_INTERVAL_MS) {
      lastCleanup = Date.now()
      cleanupOldMessages().catch((e) => console.warn(`[EDDN] Cleanup error: ${e}`))
    }
  }
}

async function runWithRetry() {
  while (true) {
    try {
      await run()
    } catch (e) {
      console.error(`[EDDN] Error: ${e?.message ?? e}. Retrying in ${RETRY_DELAY_MS}ms...`)
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
}

runWithRetry()
