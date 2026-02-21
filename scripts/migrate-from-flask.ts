/**
 * Flask → Bun/Effect Migration Script
 *
 * Reads from data/bgs_data.db (Flask SQLite, INTEGER IDs)
 * Writes to data/sinistra_migrated.db (new schema, UUID TEXT IDs)
 *
 * Usage:
 *   bun scripts/migrate-from-flask.ts
 *
 * After migration, run the server with:
 *   TURSO_URL=file:./data/sinistra_migrated.db bun src/main.ts
 */

import { Database } from "bun:sqlite"
import { readdir, readFile } from "fs/promises"
import { join } from "path"

const SOURCE_DB = "./data/bgs_data.db"
const TARGET_DB = "./data/sinistra_migrated.db"
const MIGRATIONS_DIR = "./migrations"
const BATCH_SIZE = 500

// ── Helpers ──────────────────────────────────────────────────────────────────

const uuid = () => crypto.randomUUID()

/** Convert Flask datetime string to ISO 8601, null-safe */
function toIso(value: string | null | undefined): string | null {
  if (!value) return null
  // Flask stores "2026-01-24 00:00:00.000000" — convert space to T and strip microseconds
  return value.replace(" ", "T").replace(/(\.\d+)?$/, "Z").replace("ZZ", "Z")
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

function logTable(name: string, count: number) {
  log(`  ✓ ${name}: ${count.toLocaleString()} rows migrated`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log("Flask → Bun migration starting")
  log(`  Source: ${SOURCE_DB}`)
  log(`  Target: ${TARGET_DB}`)

  // Remove old target if it exists
  const targetFile = Bun.file(TARGET_DB)
  if (await targetFile.exists()) {
    log("  Removing existing target DB...")
    await Bun.file(TARGET_DB).delete?.()
    // Fallback: try to delete via fs
    const { unlink } = await import("fs/promises")
    await unlink(TARGET_DB).catch(() => {})
  }

  const src = new Database(SOURCE_DB, { readonly: true })
  const dst = new Database(TARGET_DB)

  // Enable WAL mode and performance pragmas for target
  dst.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=OFF;")

  // ── Apply all migrations ──────────────────────────────────────────────────
  log("Applying migrations to target DB...")
  const migrationFiles = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort()

  for (const file of migrationFiles) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8")
    dst.exec(sql)
    log(`  ✓ ${file}`)
  }

  // ── ID mapping tables (old INTEGER → new UUID) ────────────────────────────
  const eventMap = new Map<number, string>()
  const activityMap = new Map<number, string>()
  const systemMap = new Map<number, string>()
  const objectiveMap = new Map<number, string>()
  const objectiveTargetMap = new Map<number, string>()
  const missionCompletedMap = new Map<number, string>()
  // Flask bug: from row 719 onward, mission_completed_influence.mission_id stores
  // event.id instead of mission_completed_event.id. This map resolves that.
  const eventIdToMissionCompletedMap = new Map<number, string>()

  log("Migrating data...")

  // ── cmdr ──────────────────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM cmdr ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT OR IGNORE INTO cmdr
        (id, name, rank_combat, rank_trade, rank_explore, rank_cqc,
         rank_empire, rank_federation, rank_power, credits, assets,
         inara_url, squadron_name, squadron_rank)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `)
    dst.transaction(() => {
      for (const r of rows) {
        stmt.run(
          uuid(), r.name, r.rank_combat, r.rank_trade, r.rank_explore,
          r.rank_cqc, r.rank_empire, r.rank_federation, r.rank_power,
          r.credits, r.assets, r.inara_url, r.squadron_name, r.squadron_rank
        )
      }
    })()
    logTable("cmdr", rows.length)
  }

  // ── colony ────────────────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM colony ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT INTO colony (id, cmdr, starsystem, ravenurl, priority)
      VALUES (?,?,?,?,?)
    `)
    dst.transaction(() => {
      for (const r of rows) {
        stmt.run(uuid(), r.cmdr, r.starsystem, r.ravenurl, r.priority ?? 0)
      }
    })()
    logTable("colony", rows.length)
  }

  // ── protected_faction ─────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM protected_faction ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT OR IGNORE INTO protected_faction (id, name, webhook_url, description, protected)
      VALUES (?,?,?,?,?)
    `)
    dst.transaction(() => {
      for (const r of rows) {
        stmt.run(uuid(), r.name, r.webhook_url ?? null, r.description ?? null, r.protected ? 1 : 0)
      }
    })()
    logTable("protected_faction", rows.length)
  }

  // ── objective ─────────────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM objective ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT INTO objective (id, title, priority, type, system, faction, description, startdate, enddate)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    dst.transaction(() => {
      for (const r of rows) {
        const id = uuid()
        objectiveMap.set(r.id, id)
        stmt.run(
          id, r.title, r.priority, r.type, r.system, r.faction,
          r.description, toIso(r.startdate), toIso(r.enddate)
        )
      }
    })()
    logTable("objective", rows.length)
  }

  // ── objective_target ──────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM objective_target ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT INTO objective_target
        (id, objective_id, type, station, system, faction, progress, targetindividual, targetoverall)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    dst.transaction(() => {
      for (const r of rows) {
        const objId = objectiveMap.get(r.objective_id)
        if (!objId) { console.warn(`  ! objective_target ${r.id}: missing objective ${r.objective_id}`); continue }
        const id = uuid()
        objectiveTargetMap.set(r.id, id)
        stmt.run(id, objId, r.type, r.station, r.system, r.faction, r.progress, r.targetindividual, r.targetoverall)
      }
    })()
    logTable("objective_target", rows.length)
  }

  // ── objective_target_settlement ───────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM objective_target_settlement ORDER BY id").all() as any[]
    if (rows.length > 0) {
      const stmt = dst.prepare(`
        INSERT INTO objective_target_settlement (id, target_id, name, targetindividual, targetoverall, progress)
        VALUES (?,?,?,?,?,?)
      `)
      dst.transaction(() => {
        for (const r of rows) {
          const targetId = objectiveTargetMap.get(r.target_id)
          if (!targetId) { console.warn(`  ! settlement ${r.id}: missing target ${r.target_id}`); continue }
          stmt.run(uuid(), targetId, r.name, r.targetindividual, r.targetoverall, r.progress)
        }
      })()
    }
    logTable("objective_target_settlement", rows.length)
  }

  // ── event ─────────────────────────────────────────────────────────────────
  {
    log("  Migrating events (may take a moment)...")
    const total = (src.query("SELECT COUNT(*) as n FROM event").get() as any).n
    const stmt = dst.prepare(`
      INSERT INTO event (id, event, timestamp, tickid, ticktime, cmdr, starsystem, systemaddress, raw_json)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)

    let migrated = 0
    let offset = 0
    while (offset < total) {
      const rows = src.query(`SELECT * FROM event ORDER BY id LIMIT ${BATCH_SIZE} OFFSET ${offset}`).all() as any[]
      dst.transaction(() => {
        for (const r of rows) {
          const id = uuid()
          eventMap.set(r.id, id)
          stmt.run(id, r.event, r.timestamp, r.tickid, r.ticktime, r.cmdr, r.starsystem, r.systemaddress, r.raw_json)
        }
      })()
      migrated += rows.length
      offset += BATCH_SIZE
      if (migrated % 10000 === 0 || migrated === total) {
        log(`    ${migrated.toLocaleString()} / ${total.toLocaleString()} events`)
      }
    }
    logTable("event", total)
  }

  // ── Helper: migrate an event sub-table ────────────────────────────────────
  function migrateEventSubTable(
    tableName: string,
    columns: string[],
    getValues: (r: any, newEventId: string) => any[]
  ) {
    const rows = src.query(`SELECT * FROM ${tableName} ORDER BY id`).all() as any[]
    if (rows.length === 0) { logTable(tableName, 0); return }

    const placeholders = columns.map(() => "?").join(",")
    const stmt = dst.prepare(`INSERT INTO ${tableName} (${columns.join(",")}) VALUES (${placeholders})`)

    let i = 0
    while (i < rows.length) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      dst.transaction(() => {
        for (const r of batch) {
          const newEventId = eventMap.get(r.event_id)
          if (!newEventId) { console.warn(`  ! ${tableName} row ${r.id}: missing event ${r.event_id}`); continue }
          stmt.run(...getValues(r, newEventId))
        }
      })()
      i += BATCH_SIZE
    }
    logTable(tableName, rows.length)
  }

  // ── market_buy_event ──────────────────────────────────────────────────────
  migrateEventSubTable(
    "market_buy_event",
    ["id", "event_id", "stock", "stock_bracket", "value", "count"],
    (r, eid) => [uuid(), eid, r.stock, r.stock_bracket, r.value, r.count]
  )

  // ── market_sell_event ─────────────────────────────────────────────────────
  migrateEventSubTable(
    "market_sell_event",
    ["id", "event_id", "demand", "demand_bracket", "profit", "value", "count"],
    (r, eid) => [uuid(), eid, r.demand, r.demand_bracket, r.profit, r.value, r.count]
  )

  // ── mission_completed_event ───────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM mission_completed_event ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT INTO mission_completed_event (id, event_id, awarding_faction, mission_name, reward)
      VALUES (?,?,?,?,?)
    `)
    let i = 0
    while (i < rows.length) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      dst.transaction(() => {
        for (const r of batch) {
          const newEventId = eventMap.get(r.event_id)
          if (!newEventId) { console.warn(`  ! mission_completed_event ${r.id}: missing event ${r.event_id}`); continue }
          const id = uuid()
          missionCompletedMap.set(r.id, id)
          eventIdToMissionCompletedMap.set(r.event_id, id)
          stmt.run(id, newEventId, r.awarding_faction, r.mission_name, r.reward)
        }
      })()
      i += BATCH_SIZE
    }
    logTable("mission_completed_event", rows.length)
  }

  // ── mission_completed_influence ───────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM mission_completed_influence ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT INTO mission_completed_influence
        (id, mission_id, system, influence, trend, faction_name,
         reputation, reputation_trend, effect, effect_trend)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `)
    let i = 0
    while (i < rows.length) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      dst.transaction(() => {
        for (const r of batch) {
          // Primary lookup: mission_id correctly points to mission_completed_event.id
          // Fallback: Flask bug (row 719+) stored event.id instead — resolve via event_id index
          const newMissionId =
            missionCompletedMap.get(r.mission_id) ??
            eventIdToMissionCompletedMap.get(r.mission_id)
          if (!newMissionId) { console.warn(`  ! influence ${r.id}: missing mission ${r.mission_id}`); continue }
          stmt.run(
            uuid(), newMissionId, r.system, r.influence, r.trend,
            r.faction_name, r.reputation, r.reputation_trend, r.effect, r.effect_trend
          )
        }
      })()
      i += BATCH_SIZE
    }
    logTable("mission_completed_influence", rows.length)
  }

  // ── faction_kill_bond_event ───────────────────────────────────────────────
  migrateEventSubTable(
    "faction_kill_bond_event",
    ["id", "event_id", "killer_ship", "awarding_faction", "victim_faction", "reward"],
    (r, eid) => [uuid(), eid, r.killer_ship, r.awarding_faction, r.victim_faction, r.reward]
  )

  // ── mission_failed_event ──────────────────────────────────────────────────
  migrateEventSubTable(
    "mission_failed_event",
    ["id", "event_id", "mission_name", "awarding_faction", "fine"],
    (r, eid) => [uuid(), eid, r.mission_name, r.awarding_faction, r.fine]
  )

  // ── multi_sell_exploration_data_event ─────────────────────────────────────
  migrateEventSubTable(
    "multi_sell_exploration_data_event",
    ["id", "event_id", "total_earnings"],
    (r, eid) => [uuid(), eid, r.total_earnings]
  )

  // ── redeem_voucher_event ──────────────────────────────────────────────────
  migrateEventSubTable(
    "redeem_voucher_event",
    ["id", "event_id", "amount", "faction", "type"],
    (r, eid) => [uuid(), eid, r.amount, r.faction, r.type]
  )

  // ── sell_exploration_data_event ───────────────────────────────────────────
  migrateEventSubTable(
    "sell_exploration_data_event",
    ["id", "event_id", "earnings"],
    (r, eid) => [uuid(), eid, r.earnings]
  )

  // ── commit_crime_event ────────────────────────────────────────────────────
  // Flask has: crime_type, faction, victim, bounty (no victim_faction)
  // New schema adds: victim_faction (will be NULL for migrated data)
  migrateEventSubTable(
    "commit_crime_event",
    ["id", "event_id", "crime_type", "faction", "victim", "victim_faction", "bounty"],
    (r, eid) => [uuid(), eid, r.crime_type, r.faction, r.victim, null, r.bounty]
  )

  // ── synthetic_cz ─────────────────────────────────────────────────────────
  migrateEventSubTable(
    "synthetic_cz",
    ["id", "event_id", "cz_type", "faction", "cmdr", "station_faction_name"],
    (r, eid) => [uuid(), eid, r.cz_type, r.faction, r.cmdr, r.station_faction_name]
  )

  // ── synthetic_ground_cz ───────────────────────────────────────────────────
  migrateEventSubTable(
    "synthetic_ground_cz",
    ["id", "event_id", "cz_type", "settlement", "faction", "cmdr", "station_faction_name"],
    (r, eid) => [uuid(), eid, r.cz_type, r.settlement, r.faction, r.cmdr, r.station_faction_name]
  )

  // ── activity ──────────────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM activity ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT INTO activity (id, tickid, ticktime, timestamp, cmdr)
      VALUES (?,?,?,?,?)
    `)
    dst.transaction(() => {
      for (const r of rows) {
        const id = uuid()
        activityMap.set(r.id, id)
        stmt.run(id, r.tickid, r.ticktime, r.timestamp, r.cmdr)
      }
    })()
    logTable("activity", rows.length)
  }

  // ── system ────────────────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM system ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT INTO system (id, name, address, activity_id)
      VALUES (?,?,?,?)
    `)
    dst.transaction(() => {
      for (const r of rows) {
        const newActivityId = activityMap.get(r.activity_id)
        if (!newActivityId) { console.warn(`  ! system ${r.id}: missing activity ${r.activity_id}`); continue }
        const id = uuid()
        systemMap.set(r.id, id)
        stmt.run(id, r.name, r.address, newActivityId)
      }
    })()
    logTable("system", rows.length)
  }

  // ── faction ───────────────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM faction ORDER BY id").all() as any[]
    const stmt = dst.prepare(`
      INSERT INTO faction
        (id, name, state, system_id, bvs, cbs, exobiology, exploration,
         scenarios, infprimary, infsecondary, missionfails, murdersground, murdersspace, tradebm)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `)
    let i = 0
    while (i < rows.length) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      dst.transaction(() => {
        for (const r of batch) {
          const newSystemId = systemMap.get(r.system_id)
          if (!newSystemId) { console.warn(`  ! faction ${r.id}: missing system ${r.system_id}`); continue }
          // Flask stores these as REAL; round to INT to match new schema
          const ri = (v: any) => v != null ? Math.round(v) : null
          stmt.run(
            uuid(), r.name, r.state, newSystemId,
            ri(r.bvs), ri(r.cbs), ri(r.exobiology), ri(r.exploration),
            ri(r.scenarios), ri(r.infprimary), ri(r.infsecondary),
            ri(r.missionfails), ri(r.murdersground), ri(r.murdersspace), ri(r.tradebm)
          )
        }
      })()
      i += BATCH_SIZE
    }
    logTable("faction", rows.length)
  }

  // ── backfill czspace/czground from synthetic_cz / synthetic_ground_cz ──────
  // Flask never stored these as aggregate columns on faction, but it did record
  // each individual CZ completion as a synthetic_cz / synthetic_ground_cz event.
  // We join those events back through (starsystem + tickid + cmdr) to identify
  // the owning faction row and aggregate the counts.
  {
    log("  Backfilling czspace from synthetic_cz...")

    const czAggs = dst.query(`
      SELECT
        f.id   AS faction_id,
        scz.cz_type,
        COUNT(*) AS cnt
      FROM synthetic_cz scz
      JOIN event e   ON scz.event_id = e.id
      JOIN system sys ON LOWER(sys.name) = LOWER(e.starsystem)
      JOIN activity act
        ON  sys.activity_id = act.id
        AND act.tickid = e.tickid
        AND COALESCE(act.cmdr, '') = COALESCE(e.cmdr, '')
      JOIN faction f
        ON  f.system_id = sys.id
        AND LOWER(f.name) = LOWER(scz.faction)
      WHERE scz.cz_type IN ('low', 'medium', 'high')
      GROUP BY f.id, scz.cz_type
    `).all() as { faction_id: string; cz_type: string; cnt: number }[]

    const updCzLow  = dst.prepare("UPDATE faction SET czspace_low    = ? WHERE id = ?")
    const updCzMed  = dst.prepare("UPDATE faction SET czspace_medium = ? WHERE id = ?")
    const updCzHigh = dst.prepare("UPDATE faction SET czspace_high   = ? WHERE id = ?")

    dst.transaction(() => {
      for (const row of czAggs) {
        if      (row.cz_type === 'low')    updCzLow.run(row.cnt,  row.faction_id)
        else if (row.cz_type === 'medium') updCzMed.run(row.cnt,  row.faction_id)
        else if (row.cz_type === 'high')   updCzHigh.run(row.cnt, row.faction_id)
      }
    })()
    log(`    ✓ czspace: ${czAggs.length} faction/type combos updated`)

    log("  Backfilling czground + faction_settlement from synthetic_ground_cz...")

    const cgAggs = dst.query(`
      SELECT
        f.id   AS faction_id,
        sgcz.cz_type,
        COUNT(*) AS cnt
      FROM synthetic_ground_cz sgcz
      JOIN event e   ON sgcz.event_id = e.id
      JOIN system sys ON LOWER(sys.name) = LOWER(e.starsystem)
      JOIN activity act
        ON  sys.activity_id = act.id
        AND act.tickid = e.tickid
        AND COALESCE(act.cmdr, '') = COALESCE(e.cmdr, '')
      JOIN faction f
        ON  f.system_id = sys.id
        AND LOWER(f.name) = LOWER(sgcz.faction)
      WHERE sgcz.cz_type IN ('low', 'medium', 'high')
      GROUP BY f.id, sgcz.cz_type
    `).all() as { faction_id: string; cz_type: string; cnt: number }[]

    const updCgLow  = dst.prepare("UPDATE faction SET czground_low    = ? WHERE id = ?")
    const updCgMed  = dst.prepare("UPDATE faction SET czground_medium = ? WHERE id = ?")
    const updCgHigh = dst.prepare("UPDATE faction SET czground_high   = ? WHERE id = ?")

    dst.transaction(() => {
      for (const row of cgAggs) {
        if      (row.cz_type === 'low')    updCgLow.run(row.cnt,  row.faction_id)
        else if (row.cz_type === 'medium') updCgMed.run(row.cnt,  row.faction_id)
        else if (row.cz_type === 'high')   updCgHigh.run(row.cnt, row.faction_id)
      }
    })()
    log(`    ✓ czground: ${cgAggs.length} faction/type combos updated`)

    // faction_settlement: group ground CZ events by (faction, settlement, cz_type)
    const settlements = dst.query(`
      SELECT
        f.id             AS faction_id,
        sgcz.settlement  AS name,
        sgcz.cz_type     AS type,
        COUNT(*)         AS count
      FROM synthetic_ground_cz sgcz
      JOIN event e   ON sgcz.event_id = e.id
      JOIN system sys ON LOWER(sys.name) = LOWER(e.starsystem)
      JOIN activity act
        ON  sys.activity_id = act.id
        AND act.tickid = e.tickid
        AND COALESCE(act.cmdr, '') = COALESCE(e.cmdr, '')
      JOIN faction f
        ON  f.system_id = sys.id
        AND LOWER(f.name) = LOWER(sgcz.faction)
      WHERE sgcz.settlement IS NOT NULL AND sgcz.settlement != ''
      GROUP BY f.id, sgcz.settlement, sgcz.cz_type
    `).all() as { faction_id: string; name: string; type: string; count: number }[]

    if (settlements.length > 0) {
      const stmtSettle = dst.prepare(`
        INSERT INTO faction_settlement (id, faction_id, name, type, count)
        VALUES (?,?,?,?,?)
      `)
      dst.transaction(() => {
        for (const s of settlements) {
          stmtSettle.run(uuid(), s.faction_id, s.name, s.type, s.count)
        }
      })()
    }
    log(`    ✓ faction_settlement: ${settlements.length} rows inserted`)
  }

  // ── flask_users ───────────────────────────────────────────────────────────
  {
    const rows = src.query("SELECT * FROM users ORDER BY id").all() as any[]
    const now = new Date().toISOString()
    const stmt = dst.prepare(`
      INSERT OR IGNORE INTO flask_users
        (id, username, password_hash, discord_id, discord_username, is_admin, active, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `)
    dst.transaction(() => {
      for (const r of rows) {
        stmt.run(
          uuid(), r.username, r.password_hash,
          r.discord_id ?? null, "",
          r.is_admin ? 1 : 0, r.active ? 1 : 0,
          now, now
        )
      }
    })()
    logTable("flask_users", rows.length)
  }

  // ── Re-enable foreign keys and final integrity check ─────────────────────
  dst.exec("PRAGMA foreign_keys=ON;")

  // ── Summary ───────────────────────────────────────────────────────────────
  log("")
  log("Migration complete! Row counts in target DB:")
  const tables = [
    "event", "market_buy_event", "market_sell_event",
    "mission_completed_event", "mission_completed_influence",
    "faction_kill_bond_event", "mission_failed_event",
    "multi_sell_exploration_data_event", "redeem_voucher_event",
    "sell_exploration_data_event", "commit_crime_event",
    "synthetic_cz", "synthetic_ground_cz",
    "activity", "system", "faction", "faction_settlement", "faction_station",
    "objective", "objective_target", "objective_target_settlement",
    "cmdr", "colony", "protected_faction", "flask_users",
  ]
  for (const t of tables) {
    const n = (dst.query(`SELECT COUNT(*) as n FROM ${t}`).get() as any).n
    console.log(`  ${t.padEnd(40)} ${String(n).padStart(8)}`)
  }

  log("")
  log(`Target DB written to: ${TARGET_DB}`)
  log("To run the server against migrated data:")
  log(`  TURSO_URL=file:./data/sinistra_migrated.db bun src/main.ts`)

  src.close()
  dst.close()
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
