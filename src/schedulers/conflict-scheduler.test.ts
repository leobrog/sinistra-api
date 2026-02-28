/**
 * Conflict Scheduler — runConflictCheck integration tests
 *
 * Uses an in-memory SQLite database and mocked fetch.
 * Covers all four diff cases:
 *   1. New conflict (system appears for the first time)
 *   2. Day scored (wonDays incremented, neither at 4)
 *   3. War won   (our faction reaches 4 wins)
 *   4. War lost  (rival faction reaches 4 wins)
 *   5. Unchanged (wonDays same — silently refreshes state, no Discord post)
 *   6. Silent cleanup (system disappears from current tick — delete, no post)
 */

import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Effect } from "effect"
import { createClient } from "@libsql/client"
import { runConflictCheck } from "./conflict-scheduler.js"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FACTION = "Communism Interstellar Union"
const RIVAL = "Rival Corp"
const WEBHOOK = "https://discord.com/api/webhooks/test/token"
const TICK = "2026-02-25T12:00:00Z"
const SYSTEM = "Alpha Centauri"

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS event (
    id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    tickid TEXT NOT NULL,
    ticktime TEXT NOT NULL,
    cmdr TEXT,
    starsystem TEXT,
    systemaddress INTEGER,
    raw_json TEXT
  );

  CREATE TABLE IF NOT EXISTS conflict_state (
    system        TEXT PRIMARY KEY,
    faction1      TEXT NOT NULL,
    faction2      TEXT NOT NULL,
    war_type      TEXT NOT NULL,
    won_days1     INTEGER NOT NULL DEFAULT 0,
    won_days2     INTEGER NOT NULL DEFAULT 0,
    stake1        TEXT,
    stake2        TEXT,
    last_tick_id  TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
`

const makeClient = async () => {
  const client = createClient({ url: "file::memory:" })
  await client.executeMultiple(SCHEMA)
  return client
}

const insertEvent = (
  client: ReturnType<typeof createClient>,
  system: string,
  wonDays1: number,
  wonDays2: number,
  tickId = TICK
) =>
  client.execute({
    sql: `INSERT INTO event (id, event, timestamp, tickid, ticktime, raw_json)
          VALUES (?, 'FSDJump', ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      new Date().toISOString(),
      tickId,
      tickId,
      JSON.stringify({
        event: "FSDJump",
        StarSystem: system,
        Conflicts: [
          {
            WarType: "war",
            Faction1: { Name: FACTION, Stake: "Our Station", WonDays: wonDays1 },
            Faction2: { Name: RIVAL, Stake: "Their Outpost", WonDays: wonDays2 },
          },
        ],
      }),
    ],
  })

const insertPrevState = (
  client: ReturnType<typeof createClient>,
  system: string,
  wonDays1: number,
  wonDays2: number
) =>
  client.execute({
    sql: `INSERT INTO conflict_state
            (system, faction1, faction2, war_type, won_days1, won_days2, stake1, stake2, last_tick_id, updated_at)
          VALUES (?, ?, ?, 'war', ?, ?, 'Our Station', 'Their Outpost', 'prev-tick', datetime('now'))`,
    args: [system, FACTION, RIVAL, wonDays1, wonDays2],
  })

const loadState = async (client: ReturnType<typeof createClient>, system: string) => {
  const result = await client.execute({
    sql: "SELECT * FROM conflict_state WHERE system = ?",
    args: [system],
  })
  return result.rows[0] ?? null
}

// ---------------------------------------------------------------------------
// Mock fetch helper — captures all posted Discord content
// ---------------------------------------------------------------------------

const mockFetch = () => {
  const calls: string[] = []
  ;(globalThis as any).fetch = mock(async (_url: string, init?: RequestInit) => {
    if (init?.body) {
      const body = JSON.parse(init.body as string)
      calls.push(body.content ?? "")
    }
    return new Response(null, { status: 204 })
  })
  return calls
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runConflictCheck", () => {
  beforeEach(() => {
    mock.restore()
  })

  // -------------------------------------------------------------------------
  it("1. new conflict — inserts state and posts ⚔️ message", async () => {
    const client = await makeClient()
    const calls = mockFetch()

    // Current tick has a conflict; no previous state
    await insertEvent(client, SYSTEM, 0, 0)

    await Effect.runPromise(runConflictCheck(client, FACTION, [WEBHOOK], TICK))

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain("⚔️")
    expect(calls[0]).toContain(SYSTEM)
    expect(calls[0]).toContain(FACTION)
    expect(calls[0]).toContain(RIVAL)

    const state = await loadState(client, SYSTEM)
    expect(state).not.toBeNull()
    expect(Number(state!.won_days1)).toBe(0)
    expect(Number(state!.won_days2)).toBe(0)
  })

  // -------------------------------------------------------------------------
  it("2. day scored — updates state and posts 📅 message", async () => {
    const client = await makeClient()
    const calls = mockFetch()

    // Previous: 1-0, current tick: 2-0 (we scored)
    await insertPrevState(client, SYSTEM, 1, 0)
    await insertEvent(client, SYSTEM, 2, 0)

    await Effect.runPromise(runConflictCheck(client, FACTION, [WEBHOOK], TICK))

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain("📅")
    expect(calls[0]).toContain("←")
    expect(calls[0]).toContain("2 days")

    const state = await loadState(client, SYSTEM)
    expect(Number(state!.won_days1)).toBe(2)
    expect(Number(state!.won_days2)).toBe(0)
  })

  // -------------------------------------------------------------------------
  it("3. war won — deletes state and posts 🏆 message", async () => {
    const client = await makeClient()
    const calls = mockFetch()

    // Previous: 3-1, current tick: our faction hits 4
    await insertPrevState(client, SYSTEM, 3, 1)
    await insertEvent(client, SYSTEM, 4, 1)

    await Effect.runPromise(runConflictCheck(client, FACTION, [WEBHOOK], TICK))

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain("🏆")
    expect(calls[0]).toContain(SYSTEM)
    expect(calls[0]).toContain("4")

    const state = await loadState(client, SYSTEM)
    expect(state).toBeNull()
  })

  // -------------------------------------------------------------------------
  it("4. war lost — deletes state and posts 💀 message", async () => {
    const client = await makeClient()
    const calls = mockFetch()

    // Previous: 1-3, current tick: rival hits 4
    await insertPrevState(client, SYSTEM, 1, 3)
    await insertEvent(client, SYSTEM, 1, 4)

    await Effect.runPromise(runConflictCheck(client, FACTION, [WEBHOOK], TICK))

    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain("💀")
    expect(calls[0]).toContain(SYSTEM)
    expect(calls[0]).toContain(RIVAL)

    const state = await loadState(client, SYSTEM)
    expect(state).toBeNull()
  })

  // -------------------------------------------------------------------------
  it("5. unchanged — updates tick ref, no Discord post", async () => {
    const client = await makeClient()
    const calls = mockFetch()

    // Same score: 2-1 in both prev state and current tick
    await insertPrevState(client, SYSTEM, 2, 1)
    await insertEvent(client, SYSTEM, 2, 1)

    await Effect.runPromise(runConflictCheck(client, FACTION, [WEBHOOK], TICK))

    expect(calls).toHaveLength(0)

    const state = await loadState(client, SYSTEM)
    expect(Number(state!.won_days1)).toBe(2)
    expect(String(state!.last_tick_id)).toBe(TICK)
  })

  // -------------------------------------------------------------------------
  it("6. silent cleanup — removes state, no Discord post", async () => {
    const client = await makeClient()
    const calls = mockFetch()

    // Previous state exists, but no events in current tick (conflict gone)
    await insertPrevState(client, SYSTEM, 2, 1)
    // (no insertEvent — empty tick)

    await Effect.runPromise(runConflictCheck(client, FACTION, [WEBHOOK], TICK))

    expect(calls).toHaveLength(0)

    const state = await loadState(client, SYSTEM)
    expect(state).toBeNull()
  })

  // -------------------------------------------------------------------------
  it("7. no webhook configured — runs without posting", async () => {
    const client = await makeClient()
    const calls = mockFetch()

    await insertEvent(client, SYSTEM, 0, 0)

    await Effect.runPromise(runConflictCheck(client, FACTION, [], TICK))

    expect(calls).toHaveLength(0)

    const state = await loadState(client, SYSTEM)
    expect(state).not.toBeNull()
  })

  // -------------------------------------------------------------------------
  it("8. multiple systems — each processed independently", async () => {
    const client = await makeClient()
    const calls = mockFetch()

    // System A: new conflict
    await insertEvent(client, "Sol", 0, 0)
    // System B: day scored
    await insertPrevState(client, "Deciat", 1, 0)
    await insertEvent(client, "Deciat", 2, 0)

    await Effect.runPromise(runConflictCheck(client, FACTION, [WEBHOOK], TICK))

    expect(calls).toHaveLength(2)
    expect(calls.some((m) => m.includes("⚔️") && m.includes("Sol"))).toBe(true)
    expect(calls.some((m) => m.includes("📅") && m.includes("Deciat"))).toBe(true)
  })

  // -------------------------------------------------------------------------
  it("9. multiple webhooks — posts to all configured URLs", async () => {
    const client = await makeClient()
    const WEBHOOK2 = "https://discord.com/api/webhooks/test/token2"
    const postedUrls: string[] = []
    ;(globalThis as any).fetch = mock(async (url: string, init?: RequestInit) => {
      if (init?.body) postedUrls.push(url)
      return new Response(null, { status: 204 })
    })

    await insertEvent(client, SYSTEM, 0, 0)

    await Effect.runPromise(runConflictCheck(client, FACTION, [WEBHOOK, WEBHOOK2], TICK))

    expect(postedUrls).toHaveLength(2)
    expect(postedUrls).toContain(WEBHOOK)
    expect(postedUrls).toContain(WEBHOOK2)
  })
})
