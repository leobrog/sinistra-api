import { Effect } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import type { BinsQueryParams } from "./dtos.js"
import { BinsEntry, BinsBuckets, BucketDetail, BinsResponse } from "./dtos.js"
import { TursoClient } from "../../database/client.js"
import { DatabaseError } from "../../domain/errors.js"
import { buildDateFilter, type DateFilter } from "../../services/date-filters.js"
import {
  bgsPointsMissions,
  bgsPointsExploration,
  bgsPointsBounty,
  bgsPointsCount,
  nextThreshold,
  remaining,
  computeMaxSwing,
  predictInfluenceGain,
  MISSIONS_FIRST_THRESHOLD,
  EXPLORATION_FIRST_THRESHOLD,
  BOUNTY_FIRST_THRESHOLD,
  MISSION_FAIL_FIRST_THRESHOLD,
  MURDER_FIRST_THRESHOLD,
} from "../../services/bins.js"
import type { Client } from "@libsql/client"

/**
 * Build a parameterized date filter fragment (same helper used across handlers).
 */
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

/**
 * Build a BucketDetail from a raw value and the bucket's parameters.
 */
const makeBucket = (
  raw: number,
  pts: number,
  firstThreshold: number,
  multiplier: 2 | 4
): BucketDetail => {
  const next = nextThreshold(pts, firstThreshold, multiplier)
  return new BucketDetail({
    raw,
    pts,
    nextThreshold: next,
    remaining: remaining(raw, next),
  })
}

/**
 * Compute BGS bins for a single (system, faction) pair.
 */
const computeBinsForPair = (
  system: string,
  faction: string,
  dateFilter: DateFilter,
  client: Client
): Effect.Effect<BinsEntry, DatabaseError> =>
  Effect.gen(function* () {
    const { sql: dateSql, args: dateArgs } = buildDateFilterParam(dateFilter)

    // ── Missions: sum of influence-plus characters for this faction/system ────
    const missionsSql = `
      SELECT COALESCE(SUM(LENGTH(mci.influence)), 0) AS pluses
      FROM mission_completed_influence mci
      JOIN mission_completed_event mce ON mce.id = mci.mission_id
      JOIN event e ON e.id = mce.event_id
      WHERE mci.faction_name = ? AND e.starsystem = ? AND ${dateSql}
    `
    const missionsResult = yield* Effect.tryPromise({
      try: () =>
        client.execute({ sql: missionsSql, args: [faction, system, ...dateArgs] }),
      catch: (error) => new DatabaseError({ operation: "getBins.missions", error }),
    })
    const missionsRaw = Number((missionsResult.rows[0] as any)?.pluses ?? 0)

    // ── Exploration: total credits sold in this system (no per-faction split) ─
    const explorationSql = `
      SELECT COALESCE(SUM(total_sales), 0) AS credits
      FROM (
        SELECT se.earnings AS total_sales
        FROM sell_exploration_data_event se
        JOIN event e ON e.id = se.event_id
        WHERE e.starsystem = ? AND ${dateSql}
        UNION ALL
        SELECT ms.total_earnings AS total_sales
        FROM multi_sell_exploration_data_event ms
        JOIN event e ON e.id = ms.event_id
        WHERE e.starsystem = ? AND ${dateSql}
      )
    `
    const explorationResult = yield* Effect.tryPromise({
      try: () =>
        client.execute({
          sql: explorationSql,
          args: [system, ...dateArgs, system, ...dateArgs],
        }),
      catch: (error) => new DatabaseError({ operation: "getBins.exploration", error }),
    })
    const explorationRaw = Number((explorationResult.rows[0] as any)?.credits ?? 0)

    // ── Bounty vouchers redeemed for this faction/system ─────────────────────
    const bountySql = `
      SELECT COALESCE(SUM(rv.amount), 0) AS credits
      FROM redeem_voucher_event rv
      JOIN event e ON e.id = rv.event_id
      WHERE rv.faction = ? AND e.starsystem = ? AND rv.type = 'bounty' AND ${dateSql}
    `
    const bountyResult = yield* Effect.tryPromise({
      try: () =>
        client.execute({ sql: bountySql, args: [faction, system, ...dateArgs] }),
      catch: (error) => new DatabaseError({ operation: "getBins.bounty", error }),
    })
    const bountyRaw = Number((bountyResult.rows[0] as any)?.credits ?? 0)

    // ── Mission fails for this faction/system (negative bucket) ──────────────
    const missionFailSql = `
      SELECT COUNT(*) AS cnt
      FROM mission_failed_event mf
      JOIN event e ON e.id = mf.event_id
      WHERE mf.awarding_faction = ? AND e.starsystem = ? AND ${dateSql}
    `
    const missionFailResult = yield* Effect.tryPromise({
      try: () =>
        client.execute({ sql: missionFailSql, args: [faction, system, ...dateArgs] }),
      catch: (error) => new DatabaseError({ operation: "getBins.missionFail", error }),
    })
    const missionFailRaw = Number((missionFailResult.rows[0] as any)?.cnt ?? 0)

    // ── Murders against this faction/system (negative bucket) ─────────────────
    const murderSql = `
      SELECT COUNT(*) AS cnt
      FROM commit_crime_event cc
      JOIN event e ON e.id = cc.event_id
      WHERE cc.victim_faction = ? AND e.starsystem = ? AND LOWER(cc.crime_type) = 'murder' AND ${dateSql}
    `
    const murderResult = yield* Effect.tryPromise({
      try: () =>
        client.execute({ sql: murderSql, args: [faction, system, ...dateArgs] }),
      catch: (error) => new DatabaseError({ operation: "getBins.murder", error }),
    })
    const murderRaw = Number((murderResult.rows[0] as any)?.cnt ?? 0)

    // ── EDDN: latest influence + population for this faction/system ───────────
    const eddnSql = `
      SELECT ef.influence,
             (SELECT esi.population
              FROM eddn_system_info esi
              WHERE esi.system_name = ef.system_name
              ORDER BY esi.updated_at DESC
              LIMIT 1) AS population
      FROM eddn_faction ef
      WHERE ef.system_name = ? AND ef.name = ?
      ORDER BY ef.updated_at DESC
      LIMIT 1
    `
    const eddnResult = yield* Effect.tryPromise({
      try: () => client.execute({ sql: eddnSql, args: [system, faction] }),
      catch: (error) => new DatabaseError({ operation: "getBins.eddn", error }),
    })
    const eddnRow = eddnResult.rows[0] as Record<string, unknown> | undefined
    const currentInfluence =
      eddnRow?.influence != null ? Number(eddnRow.influence) : null
    const population =
      eddnRow?.population != null ? Number(eddnRow.population) : null

    // ── Faction count for this system ─────────────────────────────────────────
    const factionCountSql = `
      SELECT COUNT(DISTINCT name) AS cnt
      FROM eddn_faction
      WHERE system_name = ?
    `
    const factionCountResult = yield* Effect.tryPromise({
      try: () => client.execute({ sql: factionCountSql, args: [system] }),
      catch: (error) => new DatabaseError({ operation: "getBins.factionCount", error }),
    })
    const factionCountRaw = (factionCountResult.rows[0] as any)?.cnt
    const factionCount =
      factionCountRaw != null && !isNaN(Number(factionCountRaw))
        ? Number(factionCountRaw)
        : null

    // ── Compute BGS points per bucket ─────────────────────────────────────────
    const missionsPts = bgsPointsMissions(missionsRaw)
    const explorationPts = bgsPointsExploration(explorationRaw)
    const bountyPts = bgsPointsBounty(bountyRaw)
    const missionFailPts = bgsPointsCount(missionFailRaw, MISSION_FAIL_FIRST_THRESHOLD)
    const murderPts = bgsPointsCount(murderRaw, MURDER_FIRST_THRESHOLD)

    const totalPositivePts = missionsPts + explorationPts + bountyPts
    const totalNegativePts = missionFailPts + murderPts
    const netPts = totalPositivePts - totalNegativePts
    const cappedPts = Math.min(Math.max(netPts, 0), 10)
    const pctCap = (cappedPts / 10) * 100

    // ── Influence prediction ──────────────────────────────────────────────────
    const maxSwing =
      population != null && population > 0 ? computeMaxSwing(population) : null

    let predictedInfluenceChange: number | null = null
    let predictedInfluence: number | null = null
    if (maxSwing != null && currentInfluence != null) {
      const pred = predictInfluenceGain(netPts, currentInfluence, maxSwing)
      predictedInfluenceChange = pred.predictedInfluenceChange
      predictedInfluence = currentInfluence + pred.predictedInfluenceChange
    }

    return new BinsEntry({
      system,
      faction,
      period: dateFilter.label,
      population: population ?? undefined,
      factionCount: factionCount ?? undefined,
      currentInfluence: currentInfluence ?? undefined,
      maxSwing: maxSwing ?? undefined,
      buckets: new BinsBuckets({
        missions: makeBucket(missionsRaw, missionsPts, MISSIONS_FIRST_THRESHOLD, 4),
        exploration: makeBucket(
          explorationRaw,
          explorationPts,
          EXPLORATION_FIRST_THRESHOLD,
          4
        ),
        bounty: makeBucket(bountyRaw, bountyPts, BOUNTY_FIRST_THRESHOLD, 2),
        missionFail: makeBucket(
          missionFailRaw,
          missionFailPts,
          MISSION_FAIL_FIRST_THRESHOLD,
          4
        ),
        murder: makeBucket(murderRaw, murderPts, MURDER_FIRST_THRESHOLD, 4),
      }),
      totalPositivePts,
      totalNegativePts,
      netPts,
      cappedPts,
      pctCap,
      predictedInfluenceChange: predictedInfluenceChange ?? undefined,
      predictedInfluence: predictedInfluence ?? undefined,
    })
  })

export const handleGetBins = (params: BinsQueryParams) =>
  Effect.gen(function* () {
    const client = yield* TursoClient

    const dateFilter = yield* buildDateFilter(params.period, client)

    // Fetch distinct (system, faction) pairs from active objectives
    const objectivesSql = params.system
      ? `SELECT DISTINCT system, faction FROM objective
         WHERE system IS NOT NULL AND faction IS NOT NULL AND system = ?`
      : `SELECT DISTINCT system, faction FROM objective
         WHERE system IS NOT NULL AND faction IS NOT NULL`

    const objectivesArgs: (string | number | null)[] = params.system
      ? [params.system]
      : []

    const objectivesResult = yield* Effect.tryPromise({
      try: () => client.execute({ sql: objectivesSql, args: objectivesArgs }),
      catch: (error) => new DatabaseError({ operation: "getBins.objectives", error }),
    })

    const pairs = objectivesResult.rows.map((row: any) => ({
      system: String(row.system ?? row[0]),
      faction: String(row.faction ?? row[1]),
    }))

    // Compute bins for each pair (up to 4 concurrent)
    const entries = yield* Effect.forEach(
      pairs,
      (pair) => computeBinsForPair(pair.system, pair.faction, dateFilter, client),
      { concurrency: 4 }
    )

    return new BinsResponse({
      bins: entries as readonly BinsEntry[],
      count: entries.length,
    })
  }).pipe(
    Effect.catchAll((error) => {
      if (error instanceof Error && !(error instanceof DatabaseError)) {
        return Effect.fail(
          new DatabaseError({ operation: "build date filter", error })
        )
      }
      return Effect.fail(error)
    })
  )

export const getBinsHandler = HttpApiBuilder.handler(
  Api,
  "bins",
  "getBins",
  ({ urlParams }) => handleGetBins(urlParams)
)

export const BinsApiLive = HttpApiBuilder.group(Api, "bins", (handlers) =>
  handlers.handle("getBins", getBinsHandler)
)
