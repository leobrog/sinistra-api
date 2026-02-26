import { Effect } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import { PgClient } from "../../database/client.js"
import { DatabaseError } from "../../domain/errors.js"
import { buildDateFilter, type DateFilter } from "../../services/date-filters.js"
import type { BountyVoucherQueryParams } from "./dtos.js"
import { VoucherEntry, VoucherListResponse } from "./dtos.js"

/**
 * Build parameterized SQL for date filter
 */
const buildDateFilterParam = (
  filter: DateFilter
): { sql: string; args: (string | number | null)[] } => {
  if (filter.type === "tick" && filter.tickId) {
    return { sql: `e.tickid = ?`, args: [filter.tickId] }
  }
  if (filter.type === "date" && filter.startDate && filter.endDate) {
    return {
      sql: `e.timestamp BETWEEN ? AND ?`,
      args: [filter.startDate, filter.endDate],
    }
  }
  return { sql: "1=1", args: [] }
}

/**
 * Get list of redeem voucher events
 */
export const handleGetVouchers = (params: BountyVoucherQueryParams) =>
  Effect.gen(function* () {
    const client = yield* PgClient

    // Build date filter
    const dateFilter = params.period
      ? yield* buildDateFilter(params.period, client)
      : { type: "date" as const, label: "All Time" }

    const dateParam = buildDateFilterParam(dateFilter)

    // Build WHERE clause
    const conditions: string[] = [dateParam.sql]
    const args: (string | number | null)[] = [...dateParam.args]

    if (params.cmdr) {
      conditions.push("e.cmdr = ?")
      args.push(params.cmdr)
    }

    if (params.system) {
      conditions.push("e.starsystem = ?")
      args.push(params.system)
    }

    if (params.faction) {
      conditions.push("rv.faction = ?")
      args.push(params.faction)
    }

    if (params.type) {
      conditions.push("rv.type = ?")
      args.push(params.type)
    }

    const whereClause = conditions.join(" AND ")

    // Query with joins to get all required fields
    const sql = `
      SELECT 
        e.cmdr,
        c.squadron_rank,
        e.starsystem AS system,
        e.timestamp,
        e.tickid,
        rv.amount,
        rv.type,
        rv.faction
      FROM redeem_voucher_event rv
      JOIN event e ON e.id = rv.event_id
      LEFT JOIN cmdr c ON c.name = e.cmdr
      WHERE ${whereClause}
      ORDER BY e.timestamp DESC
    `

    const result = yield* Effect.tryPromise({
      try: () => client.unsafe(sql as any),
      catch: (error) => new DatabaseError({ operation: "getVouchers", error }),
    })

    const vouchers = (result as any[]).map((row: any) =>
      new VoucherEntry({
        cmdr: row.cmdr,
        squadron_rank: row.squadron_rank ?? undefined,
        system: row.system ?? undefined,
        timestamp: row.timestamp ?? undefined,
        tickid: row.tickid ?? undefined,
        amount: row.amount,
        type: row.type,
        faction: row.faction ?? undefined,
      })
    )

    return new VoucherListResponse({
      vouchers: vouchers as readonly VoucherEntry[],
      count: vouchers.length,
    })
  }).pipe(
    Effect.catchAll((error) => {
      // Map generic Error from buildDateFilter to DatabaseError
      if (error instanceof Error && !(error instanceof DatabaseError)) {
        return Effect.fail(
          new DatabaseError({
            operation: "build date filter",
            error,
          })
        )
      }
      return Effect.fail(error)
    })
  )

export const getVouchersHandler = HttpApiBuilder.handler(
  Api,
  "bountyVouchers",
  "getVouchers",
  ({ urlParams }) => handleGetVouchers(urlParams)
)

export const BountyVouchersApiLive = HttpApiBuilder.group(Api, "bountyVouchers", (handlers) =>
  handlers.handle("getVouchers", getVouchersHandler)
)
