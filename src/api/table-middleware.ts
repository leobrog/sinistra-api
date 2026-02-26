/**
 * BGS Table browser middleware.
 *
 * Intercepts GET /api/table/:name, validates the table name against a
 * whitelist, and returns the rows as JSON — mirroring the Flask table-browser
 * endpoint used by the dashboard BGS Table Viewer page.
 *
 * Runs outside HttpApiBuilder so we can return a raw JSON response.
 */

import { Effect } from "effect"
import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import type { HttpApp } from "@effect/platform"
import { PgClient } from "../database/client.js"
import { AppConfig } from "../lib/config.js"

const ALLOWED_TABLES = new Set([
  "event",
  "market_buy_event",
  "market_sell_event",
  "mission_completed_event",
  "mission_completed_influence",
  "mission_failed_event",
  "faction_kill_bond_event",
  "redeem_voucher_event",
  "sell_exploration_data_event",
  "multi_sell_exploration_data_event",
  "activity",
  "system",
  "faction",
  "cmdr",
])

const TABLE_PATH = /^\/api\/table\/([^/]+)$/

export const tableMiddleware = <E, R>(
  app: HttpApp.Default<E, R>
): HttpApp.Default<E, R | PgClient | AppConfig> =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const url = new URL(req.url, "http://placeholder")

    const match = TABLE_PATH.exec(url.pathname)
    if (req.method !== "GET" || !match) {
      return yield* app
    }

    const tableName = match[1] as string

    if (!ALLOWED_TABLES.has(tableName)) {
      return yield* HttpServerResponse.json(
        { error: "Table not found" },
        { status: 404 }
      ).pipe(Effect.orDie)
    }

    const config = yield* AppConfig
    const apiKey = req.headers["apikey"] as string | undefined
    if (!apiKey || apiKey !== config.server.apiKey) {
      return yield* HttpServerResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ).pipe(Effect.orDie)
    }

    return yield* Effect.gen(function* () {
      const client = yield* PgClient

      const result = yield* Effect.tryPromise({
        try: () =>
          client(`SELECT * FROM ${tableName} LIMIT 1000`),
        catch: (error) => new Error(String(error)),
      })

      const rows = (result as any[]).map((row) =>
        Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
      )

      return yield* HttpServerResponse.json(rows).pipe(Effect.orDie)
    }).pipe(
      Effect.catchAll(() =>
        HttpServerResponse.json({ error: "Database error" }, { status: 500 }).pipe(Effect.orDie)
      )
    )
  }) as HttpApp.Default<E, R | PgClient | AppConfig>
