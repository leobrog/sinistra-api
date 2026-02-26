import { Effect } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import type { CZSummaryQueryParams } from "./dtos.js"
import { PgClient } from "../../database/client.js"
import { DatabaseError } from "../../domain/errors.js"
import { buildDateFilter, type DateFilter } from "../../services/date-filters.js"

const buildDateFilterParam = (
  filter: DateFilter,
  alias: string = "e"
): { sql: string; args: (string | number | null)[] } => {
  if (filter.type === "tick" && filter.tickId) {
    return { sql: `${alias}.tickid = ?`, args: [filter.tickId] }
  }
  if (filter.type === "date" && filter.startDate && filter.endDate) {
    return {
      sql: `${alias}.timestamp BETWEEN ? AND ?`,
      args: [filter.startDate, filter.endDate],
    }
  }
  return { sql: "1=1", args: [] }
}

const executeCZQuery = (
  params: CZSummaryQueryParams,
  type: "space" | "ground"
): Effect.Effect<unknown[], DatabaseError, PgClient> =>
  Effect.gen(function* () {
    const client = yield* PgClient

    let dateFilter: DateFilter
    if (params.period) {
      dateFilter = yield* buildDateFilter(params.period, client)
    } else {
      dateFilter = { type: "date", label: "All Time" }
    }

    const dateParam = buildDateFilterParam(dateFilter)
    let filterSql = dateParam.sql
    const filterArgs: (string | number | null)[] = [...dateParam.args]
    if (params.system_name) {
      filterSql += " AND e.starsystem = ?"
      filterArgs.push(params.system_name)
    }

    const sql =
      type === "space"
        ? `
          SELECT
            e.starsystem AS starsystem,
            scz.faction,
            scz.cz_type,
            e.cmdr,
            COUNT(*) AS cz_count
          FROM synthetic_cz scz
          JOIN event e ON e.id = scz.event_id
          WHERE ${filterSql}
          GROUP BY e.starsystem, scz.faction, scz.cz_type, e.cmdr
          ORDER BY cz_count DESC
        `
        : `
          SELECT
            e.starsystem AS starsystem,
            sgcz.faction,
            sgcz.settlement,
            sgcz.cz_type,
            e.cmdr,
            COUNT(*) AS cz_count
          FROM synthetic_ground_cz sgcz
          JOIN event e ON e.id = sgcz.event_id
          WHERE ${filterSql} AND sgcz.settlement IS NOT NULL
          GROUP BY e.starsystem, sgcz.faction, sgcz.settlement, sgcz.cz_type, e.cmdr
          ORDER BY cz_count DESC
        `

    const result = yield* Effect.tryPromise({
      try: () => client.unsafe(sql as any),
      catch: (error) =>
        new DatabaseError({ operation: `execute ${type}-cz-summary`, error }),
    })

    return result
  }).pipe(
    Effect.catchAll((error) => {
      if (error instanceof Error && !(error instanceof DatabaseError)) {
        return Effect.fail(new DatabaseError({ operation: "build date filter", error }))
      }
      return Effect.fail(error)
    })
  )

export const getSpaceCZSummary = HttpApiBuilder.handler(
  Api,
  "cz",
  "getSpaceCZSummary",
  ({ urlParams }) => executeCZQuery(urlParams, "space")
)

export const getGroundCZSummary = HttpApiBuilder.handler(
  Api,
  "cz",
  "getGroundCZSummary",
  ({ urlParams }) => executeCZQuery(urlParams, "ground")
)

export const CZApiLive = HttpApiBuilder.group(Api, "cz", (handlers) =>
  handlers
    .handle("getSpaceCZSummary", getSpaceCZSummary)
    .handle("getGroundCZSummary", getGroundCZSummary)
)
