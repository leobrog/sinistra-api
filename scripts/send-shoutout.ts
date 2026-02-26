/**
 * One-shot shoutout sender.
 *
 * Usage:
 *   bun run scripts/send-shoutout.ts [tickArg]
 *
 * tickArg can be:
 *   - A Zoy hash (e.g. "zoy-0e2a1369d94b6741eb60") — used directly
 *   - An ISO timestamp (e.g. "2026-02-25T18:21:21.000Z") — used as upper bound
 *     to find the most recent event hash before that time
 *   - Omitted — uses the most recent tick_state ISO timestamp as upper bound
 *
 * Reads TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, DISCORD_BGS_WEBHOOK,
 * DISCORD_CONFLICT_WEBHOOK, DISCORD_SHOUTOUT_WEBHOOK from .env (auto-loaded by Bun).
 */

import { createClient } from "@libsql/client"
import {
  buildTickSummary,
  buildSpaceCzSummary,
  buildGroundCzSummary,
  postEmbedsToDiscord,
} from "../src/schedulers/shoutout-scheduler.js"

const FACTION_NAME = process.env.FACTION_NAME ?? "Communism Interstellar Union"
const DB_URL = process.env.TURSO_DATABASE_URL ?? "file:./data/sinistra.db"
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN ?? ""
const BGS_WEBHOOK = process.env.DISCORD_BGS_WEBHOOK ?? ""
const CONFLICT_WEBHOOK = process.env.DISCORD_CONFLICT_WEBHOOK ?? ""
const SHOUTOUT_WEBHOOK = process.env.DISCORD_SHOUTOUT_WEBHOOK ?? ""

const client = createClient({ url: DB_URL, authToken: DB_TOKEN })

async function resolveHashTickId(): Promise<string> {
  const arg = process.argv[2]

  // If it already looks like a Zoy hash, use directly
  if (arg?.startsWith("zoy-")) return arg

  // Otherwise treat as an ISO upper bound (or look one up from tick_state)
  let upperBound: string
  if (arg) {
    upperBound = arg
  } else {
    const ts = await client.execute(
      "SELECT tickid FROM tick_state ORDER BY last_updated DESC LIMIT 1"
    )
    if (ts.rows.length === 0) throw new Error("No ticks in tick_state")
    upperBound = String(ts.rows[0].tickid)
  }

  console.log(`Using upper bound ISO timestamp: ${upperBound}`)

  const result = await client.execute({
    sql: "SELECT DISTINCT tickid FROM event WHERE tickid IS NOT NULL AND timestamp < ? ORDER BY timestamp DESC LIMIT 1",
    args: [upperBound],
  })
  const hash = result.rows[0]?.tickid as string | undefined
  if (!hash) throw new Error(`No events found before ${upperBound}`)
  return hash
}

async function run() {
  const tickHash = await resolveHashTickId()
  console.log(`Sending shoutout for completed tick hash: ${tickHash}`)

  if (BGS_WEBHOOK) {
    const embeds = await buildTickSummary(client, tickHash, FACTION_NAME)
    if (embeds.length > 0) {
      await postEmbedsToDiscord(BGS_WEBHOOK, embeds)
      console.log(`BGS summary: ${embeds.length} embed(s) sent`)
    } else {
      console.log("BGS summary: no data for this tick")
    }
  } else {
    console.log("BGS summary: DISCORD_BGS_WEBHOOK not set, skipped")
  }

  if (CONFLICT_WEBHOOK) {
    const embeds = await buildSpaceCzSummary(client, tickHash)
    if (embeds.length > 0) {
      await postEmbedsToDiscord(CONFLICT_WEBHOOK, embeds)
      console.log(`Space CZ summary: ${embeds.length} embed(s) sent`)
    } else {
      console.log("Space CZ summary: no data for this tick")
    }
  } else {
    console.log("Space CZ summary: DISCORD_CONFLICT_WEBHOOK not set, skipped")
  }

  if (SHOUTOUT_WEBHOOK) {
    const embeds = await buildGroundCzSummary(client, tickHash)
    if (embeds.length > 0) {
      await postEmbedsToDiscord(SHOUTOUT_WEBHOOK, embeds)
      console.log(`Ground CZ summary: ${embeds.length} embed(s) sent`)
    } else {
      console.log("Ground CZ summary: no data for this tick")
    }
  } else {
    console.log("Ground CZ summary: DISCORD_SHOUTOUT_WEBHOOK not set, skipped")
  }

  console.log("Done.")
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
