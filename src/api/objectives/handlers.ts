import { Effect, Option } from "effect"
import { HttpApiBuilder, HttpServerRequest } from "@effect/platform"
import { v4 as uuid } from "uuid"
import { Api } from "../index.js"
import { ObjectiveRepository } from "../../domain/repositories.js"
import type { CreateObjectiveRequest, ProgressDetail } from "./dtos.js"
import { Objective, ObjectiveTarget, ObjectiveTargetSettlement } from "../../domain/models.js"
import { ObjectiveId, ObjectiveTargetId, ObjectiveTargetSettlementId } from "../../domain/ids.js"
import { TursoClient } from "../../database/client.js"
import { DatabaseError, ObjectiveNotFoundError } from "../../domain/errors.js"

// ============================================================================
// Progress Calculation
// ============================================================================

type DateFilter = { condition: string; args: (string | number | null)[] }

const buildDateFilter = (
  period: string,
  currentTickId: string | null,
  customStart?: Date,
  customEnd?: Date,
): DateFilter => {
  if (period === "custom" && customStart) {
    const end = customEnd ?? new Date()
    return {
      condition: "e.timestamp BETWEEN ? AND ?",
      args: [
        customStart.toISOString().split("T")[0] + "T00:00:00Z",
        end.toISOString().split("T")[0] + "T23:59:59Z",
      ],
    }
  }
  if (period === "ct") {
    if (currentTickId) return { condition: "e.tickid = ?", args: [currentTickId] }
    return { condition: "1=0", args: [] }
  }
  return { condition: "1=1", args: [] }
}

const makeEmptyProgress = (targetoverall: number): ProgressDetail => ({
  overallProgress: 0,
  overallTarget: targetoverall,
  overallPercentage: 0,
  cmdrProgress: [],
  settlementProgress: [],
})

const computeTargetProgress = (
  client: any,
  targetType: string,
  targetSystem: string | null,
  targetFaction: string | null,
  targetindividual: number,
  targetoverall: number,
  settlementsList: ReadonlyArray<{ name: string | null; targetoverall: number | null }>,
  dateFilter: DateFilter,
): Effect.Effect<ProgressDetail, never, never> =>
  Effect.tryPromise({
    try: async (): Promise<ProgressDetail> => {
      let sql: string
      let args: (string | number | null)[] = [...dateFilter.args]
      let progressField: string
      let isGroundCZ = false

      if (targetType === "space_cz") {
        progressField = "cz_count"
        let cond = dateFilter.condition
        if (targetSystem) { cond += " AND e.starsystem = ?"; args.push(targetSystem) }
        if (targetFaction) { cond += " AND scz.faction = ?"; args.push(targetFaction) }
        sql = `SELECT e.cmdr, COUNT(*) AS cz_count
               FROM synthetic_cz scz
               JOIN event e ON e.id = scz.event_id
               WHERE ${cond}
               GROUP BY scz.faction, scz.cz_type, e.cmdr`
      } else if (targetType === "ground_cz") {
        progressField = "cz_count"
        isGroundCZ = true
        let cond = dateFilter.condition
        if (targetSystem) { cond += " AND e.starsystem = ?"; args.push(targetSystem) }
        if (targetFaction) { cond += " AND sgcz.faction = ?"; args.push(targetFaction) }
        sql = `SELECT e.cmdr, sgcz.settlement, COUNT(*) AS cz_count
               FROM synthetic_ground_cz sgcz
               JOIN event e ON e.id = sgcz.event_id
               WHERE ${cond}
               GROUP BY sgcz.faction, sgcz.settlement, sgcz.cz_type, e.cmdr`
      } else if (targetType === "bv") {
        progressField = "bounty_vouchers"
        let cond = `e.cmdr IS NOT NULL AND rv.type = 'bounty' AND ${dateFilter.condition}`
        if (targetSystem) { cond += " AND e.starsystem = ?"; args.push(targetSystem) }
        if (targetFaction) { cond += " AND rv.faction = ?"; args.push(targetFaction) }
        sql = `SELECT e.cmdr, SUM(rv.amount) AS bounty_vouchers
               FROM redeem_voucher_event rv
               JOIN event e ON e.id = rv.event_id
               WHERE ${cond}
               GROUP BY e.cmdr`
      } else if (targetType === "cb") {
        progressField = "combat_bonds"
        let cond = `e.cmdr IS NOT NULL AND rv.type = 'CombatBond' AND ${dateFilter.condition}`
        if (targetSystem) { cond += " AND e.starsystem = ?"; args.push(targetSystem) }
        if (targetFaction) { cond += " AND rv.faction = ?"; args.push(targetFaction) }
        sql = `SELECT e.cmdr, SUM(rv.amount) AS combat_bonds
               FROM redeem_voucher_event rv
               JOIN event e ON e.id = rv.event_id
               WHERE ${cond}
               GROUP BY e.cmdr`
      } else if (targetType === "inf") {
        progressField = "influence"
        let cond = `e.cmdr IS NOT NULL AND ${dateFilter.condition}`
        if (targetSystem) { cond += " AND e.starsystem = ?"; args.push(targetSystem) }
        if (targetFaction) { cond += " AND mci.faction_name = ?"; args.push(targetFaction) }
        sql = `SELECT e.cmdr, SUM(LENGTH(mci.influence)) AS influence
               FROM mission_completed_influence mci
               JOIN mission_completed_event mce ON mce.id = mci.mission_id
               JOIN event e ON e.id = mce.event_id
               WHERE ${cond}
               GROUP BY e.cmdr, mci.faction_name`
      } else if (targetType === "expl") {
        progressField = "total_exploration_sales"
        // Date filter appears twice in UNION, so double the args; system filter once on outer query
        args = [...dateFilter.args, ...dateFilter.args]
        if (targetSystem) { args.push(targetSystem) }
        const systemCond = targetSystem ? "WHERE starsystem = ?" : ""
        sql = `SELECT cmdr, SUM(total_sales) AS total_exploration_sales
               FROM (
                 SELECT e.cmdr, e.starsystem, se.earnings AS total_sales
                 FROM sell_exploration_data_event se
                 JOIN event e ON e.id = se.event_id
                 WHERE e.cmdr IS NOT NULL AND ${dateFilter.condition}
                 UNION ALL
                 SELECT e.cmdr, e.starsystem, ms.total_earnings AS total_sales
                 FROM multi_sell_exploration_data_event ms
                 JOIN event e ON e.id = ms.event_id
                 WHERE e.cmdr IS NOT NULL AND ${dateFilter.condition}
               ) ${systemCond}
               GROUP BY cmdr`
      } else if (targetType === "trade_prof") {
        progressField = "total_transaction_volume"
        let cond = `e.cmdr IS NOT NULL AND ${dateFilter.condition}`
        if (targetSystem) { cond += " AND e.starsystem = ?"; args.push(targetSystem) }
        sql = `SELECT e.cmdr,
               SUM(COALESCE(mb.value, 0)) + SUM(COALESCE(ms.value, 0)) AS total_transaction_volume
               FROM event e
               LEFT JOIN market_buy_event mb ON mb.event_id = e.id
               LEFT JOIN market_sell_event ms ON ms.event_id = e.id
               WHERE ${cond}
               GROUP BY e.cmdr
               HAVING total_transaction_volume > 0`
      } else if (targetType === "mission_fail") {
        progressField = "missions_failed"
        let cond = `e.cmdr IS NOT NULL AND ${dateFilter.condition}`
        if (targetSystem) { cond += " AND e.starsystem = ?"; args.push(targetSystem) }
        sql = `SELECT e.cmdr, COUNT(*) AS missions_failed
               FROM mission_failed_event mf
               JOIN event e ON e.id = mf.event_id
               WHERE ${cond}
               GROUP BY e.cmdr`
      } else if (targetType === "murder") {
        progressField = "murder_count"
        let cond = `e.cmdr IS NOT NULL AND LOWER(cc.crime_type) = 'murder' AND ${dateFilter.condition}`
        if (targetSystem) { cond += " AND e.starsystem = ?"; args.push(targetSystem) }
        if (targetFaction) { cond += " AND cc.victim_faction = ?"; args.push(targetFaction) }
        sql = `SELECT e.cmdr, COUNT(*) AS murder_count
               FROM commit_crime_event cc
               JOIN event e ON e.id = cc.event_id
               WHERE ${cond}
               GROUP BY e.cmdr, e.starsystem, cc.victim_faction`
      } else {
        return makeEmptyProgress(targetoverall)
      }

      const result = await client.execute({ sql, args })
      const rows: any[] = result.rows

      // Aggregate progress by CMDR
      const cmdrMap = new Map<string, number>()
      const settlementMap = new Map<string, number>()

      for (const row of rows) {
        const cmdr = row["cmdr"] as string | null
        const progress = Number(row[progressField]) || 0
        if (cmdr) {
          cmdrMap.set(cmdr, (cmdrMap.get(cmdr) ?? 0) + progress)
        }
        if (isGroundCZ) {
          const settlement = row["settlement"] as string | null
          if (settlement) {
            settlementMap.set(settlement, (settlementMap.get(settlement) ?? 0) + (Number(row["cz_count"]) || 0))
          }
        }
      }

      const cmdrProgress = Array.from(cmdrMap.entries()).map(([cmdr, progress]) => {
        const percentage = targetindividual > 0 ? Math.min(100, (progress / targetindividual) * 100) : 0
        return { cmdr, progress, target: targetindividual, percentage }
      })

      const overallProgress = cmdrProgress.reduce((sum, c) => sum + c.progress, 0)
      const overallPercentage = targetoverall > 0 ? Math.min(100, (overallProgress / targetoverall) * 100) : 0

      const settlementProgress: ProgressDetail["settlementProgress"] = isGroundCZ
        ? settlementsList
            .filter((s) => s.name !== null)
            .map((s) => {
              const progress = settlementMap.get(s.name!) ?? 0
              const target = s.targetoverall ?? 0
              const percentage = target > 0 ? Math.min(100, (progress / target) * 100) : 0
              return { settlement: s.name!, progress, target, percentage }
            })
        : []

      return { overallProgress, overallTarget: targetoverall, overallPercentage, cmdrProgress, settlementProgress }
    },
    catch: () => "progress-calc-error",
  }).pipe(Effect.catchAll(() => Effect.succeed(makeEmptyProgress(targetoverall))))

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Convert create request to domain Objective entity
 */
const createRequestToObjective = (req: CreateObjectiveRequest): Objective => {
  const objectiveId = uuid() as ObjectiveId

  const targets = req.targets.map((targetInput) => {
    const targetId = uuid() as ObjectiveTargetId

    const settlements = targetInput.settlements.map((settlementInput) =>
      new ObjectiveTargetSettlement({
        id: uuid() as ObjectiveTargetSettlementId,
        targetId,
        name: Option.fromNullable(settlementInput.name),
        targetindividual: Option.fromNullable(settlementInput.targetindividual),
        targetoverall: Option.fromNullable(settlementInput.targetoverall),
        progress: Option.fromNullable(settlementInput.progress),
      })
    )

    return new ObjectiveTarget({
      id: targetId,
      objectiveId,
      type: Option.fromNullable(targetInput.type),
      station: Option.fromNullable(targetInput.station),
      system: Option.fromNullable(targetInput.system),
      faction: Option.fromNullable(targetInput.faction),
      progress: Option.fromNullable(targetInput.progress),
      targetindividual: Option.fromNullable(targetInput.targetindividual),
      targetoverall: Option.fromNullable(targetInput.targetoverall),
      settlements,
    })
  })

  return new Objective({
    id: objectiveId,
    title: Option.some(req.title),
    priority: Option.fromNullable(req.priority),
    type: Option.fromNullable(req.type),
    system: Option.fromNullable(req.system),
    faction: Option.fromNullable(req.faction),
    description: Option.fromNullable(req.description),
    startdate: Option.fromNullable(req.startdate),
    enddate: Option.fromNullable(req.enddate),
    targets,
  })
}

// ============================================================================
// Shared GET logic
// ============================================================================

const buildGetObjectivesEffect = (
  objectiveRepo: typeof ObjectiveRepository.Service,
  client: any,
  httpRequest: typeof HttpServerRequest.HttpServerRequest.Service,
) =>
  Effect.gen(function* () {
    // Parse query parameters
    const query = httpRequest.url.split("?")[1] || ""
    const params = new URLSearchParams(query)
    const systemFilter = params.get("system") || undefined
    const factionFilter = params.get("faction") || undefined
    const activeOnly = params.get("active")?.toLowerCase() === "true"
    const periodOverride = params.get("period") || undefined

    // Build SQL query with filters
    let sql = "SELECT id FROM objective"
    const args: any[] = []
    const whereClauses: string[] = []

    if (systemFilter) {
      whereClauses.push("system = ?")
      args.push(systemFilter)
    }
    if (factionFilter) {
      whereClauses.push("faction = ?")
      args.push(factionFilter)
    }
    if (activeOnly) {
      const now = new Date().toISOString()
      whereClauses.push("startdate <= ? AND enddate >= ?")
      args.push(now, now)
    }
    if (whereClauses.length > 0) {
      sql += " WHERE " + whereClauses.join(" AND ")
    }

    // Execute query
    const result = (yield* Effect.tryPromise({
      try: () => client.execute({ sql, args }),
      catch: (error) => new DatabaseError({ operation: "query.objectives", error }),
    })) as { rows: any[] }

    // Load full objectives
    const objectives: Objective[] = []
    for (const row of result.rows) {
      const objectiveId = String(row[0]) as ObjectiveId
      const objectiveOption = yield* objectiveRepo.findById(objectiveId)
      if (Option.isSome(objectiveOption)) {
        objectives.push(objectiveOption.value)
      }
    }

    // Get current tick ID for progress calculation
    const tickResult = (yield* Effect.tryPromise({
      try: () =>
        client.execute({
          sql: "SELECT tickid FROM event WHERE tickid IS NOT NULL ORDER BY timestamp DESC LIMIT 1",
          args: [],
        }),
      catch: () => new DatabaseError({ operation: "query.currentTick", error: "tick query failed" }),
    }).pipe(Effect.orElse(() => Effect.succeed({ rows: [] as any[] })))) as { rows: any[] }

    const currentTickId =
      tickResult.rows.length > 0 ? (String(tickResult.rows[0]["tickid"] ?? "") || null) : null

    // Enrich each objective with calculated progressDetail
    const enrichedObjectives: any[] = []
    for (const objective of objectives) {
      const startdate = Option.getOrNull(objective.startdate)
      const enddate = Option.getOrNull(objective.enddate) ?? undefined
      const period = periodOverride ?? (startdate ? "custom" : "ct")
      const dateFilter = buildDateFilter(period, currentTickId, startdate ?? undefined, enddate)

      const enrichedTargets: any[] = []
      for (const target of objective.targets) {
        const targetType = Option.getOrNull(target.type) ?? ""
        const targetSystem = Option.getOrNull(target.system) || Option.getOrNull(objective.system) || null
        const targetFaction = Option.getOrNull(target.faction) || Option.getOrNull(objective.faction) || null
        const targetindividual = Option.getOrNull(target.targetindividual) ?? 0
        const targetoverall = Option.getOrNull(target.targetoverall) ?? 0
        const settlementsList = target.settlements.map((s) => ({
          name: Option.getOrNull(s.name),
          targetoverall: Option.getOrNull(s.targetoverall),
        }))

        const progressDetail = yield* computeTargetProgress(
          client,
          targetType,
          targetSystem ?? null,
          targetFaction ?? null,
          targetindividual,
          targetoverall,
          settlementsList,
          dateFilter,
        )

        enrichedTargets.push({
          id: target.id,
          type: Option.getOrElse(target.type, () => ""),
          station: Option.getOrElse(target.station, () => ""),
          system: Option.getOrElse(target.system, () => Option.getOrElse(objective.system, () => "")),
          faction: Option.getOrElse(target.faction, () => Option.getOrElse(objective.faction, () => "")),
          progress: progressDetail.overallProgress,
          targetindividual,
          targetoverall,
          settlements: target.settlements.map((s) => {
            const sName = Option.getOrNull(s.name)
            const calcProgress = sName
              ? (progressDetail.settlementProgress.find((sp) => sp.settlement === sName)?.progress ?? 0)
              : 0
            return {
              id: s.id,
              name: Option.getOrElse(s.name, () => ""),
              targetindividual: Option.getOrElse(s.targetindividual, () => 0),
              targetoverall: Option.getOrElse(s.targetoverall, () => 0),
              progress: calcProgress,
            }
          }),
          progressDetail,
        })
      }

      enrichedObjectives.push({
        id: objective.id,
        title: Option.getOrElse(objective.title, () => ""),
        priority: Option.getOrElse(objective.priority, () => 0),
        type: Option.getOrElse(objective.type, () => ""),
        system: Option.getOrElse(objective.system, () => ""),
        faction: Option.getOrElse(objective.faction, () => ""),
        description: Option.getOrElse(objective.description, () => ""),
        startdate: startdate ? startdate.toISOString().replace(/\.\d{3}Z$/, "Z") : undefined,
        enddate: enddate ? enddate.toISOString().replace(/\.\d{3}Z$/, "Z") : undefined,
        targets: enrichedTargets,
      })
    }

    return enrichedObjectives
  })

// ============================================================================
// Objectives API handlers
// ============================================================================

export const ObjectivesApiLive = HttpApiBuilder.group(Api, "objectives", (handlers) =>
  handlers
    // Create objective (both paths use same handler)
    .handle("createObjective", (request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const objective = createRequestToObjective(request.payload)
        yield* objectiveRepo.create(objective)

        return {
          status: "Objective created successfully" as const,
          id: objective.id,
        }
      })
    )
    .handle("createObjectiveAlt", (request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const objective = createRequestToObjective(request.payload)
        yield* objectiveRepo.create(objective)

        return {
          status: "Objective created successfully" as const,
          id: objective.id,
        }
      })
    )
    // Get objectives with filters and calculated progressDetail
    .handle("getObjectives", (_request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* TursoClient
        const httpRequest = yield* HttpServerRequest.HttpServerRequest
        return yield* buildGetObjectivesEffect(objectiveRepo, client, httpRequest)
      })
    )
    .handle("getObjectivesAlt", (_request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* TursoClient
        const httpRequest = yield* HttpServerRequest.HttpServerRequest
        return yield* buildGetObjectivesEffect(objectiveRepo, client, httpRequest)
      })
    )
    // Update objective
    .handle("updateObjective", (request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        // Find existing objective
        const existingOption = yield* objectiveRepo.findById(request.path.id)

        if (Option.isNone(existingOption)) {
          return yield* Effect.fail(
            new ObjectiveNotFoundError({ id: request.path.id })
          )
        }

        const existing = existingOption.value
        const updates = request.payload

        // Build updated objective
        const updated = new Objective({
          id: existing.id,
          title: updates.title !== undefined ? Option.some(updates.title) : existing.title,
          priority: updates.priority !== undefined ? Option.some(updates.priority) : existing.priority,
          type: updates.type !== undefined ? Option.some(updates.type) : existing.type,
          system: updates.system !== undefined ? Option.some(updates.system) : existing.system,
          faction: updates.faction !== undefined ? Option.some(updates.faction) : existing.faction,
          description: updates.description !== undefined ? Option.some(updates.description) : existing.description,
          startdate: updates.startdate !== undefined ? Option.fromNullable(updates.startdate) : existing.startdate,
          enddate: updates.enddate !== undefined ? Option.fromNullable(updates.enddate) : existing.enddate,
          targets:
            updates.targets !== undefined
              ? updates.targets.map((targetInput) => {
                  const targetId = uuid() as ObjectiveTargetId
                  const settlements = targetInput.settlements.map((s) =>
                    new ObjectiveTargetSettlement({
                      id: uuid() as ObjectiveTargetSettlementId,
                      targetId,
                      name: Option.fromNullable(s.name),
                      targetindividual: Option.fromNullable(s.targetindividual),
                      targetoverall: Option.fromNullable(s.targetoverall),
                      progress: Option.fromNullable(s.progress),
                    })
                  )
                  return new ObjectiveTarget({
                    id: targetId,
                    objectiveId: existing.id,
                    type: Option.fromNullable(targetInput.type),
                    station: Option.fromNullable(targetInput.station),
                    system: Option.fromNullable(targetInput.system),
                    faction: Option.fromNullable(targetInput.faction),
                    progress: Option.fromNullable(targetInput.progress),
                    targetindividual: Option.fromNullable(targetInput.targetindividual),
                    targetoverall: Option.fromNullable(targetInput.targetoverall),
                    settlements,
                  })
                })
              : existing.targets,
        })

        yield* objectiveRepo.update(updated)

        return {
          status: "Objective updated successfully" as const,
          id: existing.id,
        }
      })
    )
    .handle("updateObjectiveAlt", (request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        const existingOption = yield* objectiveRepo.findById(request.path.id)

        if (Option.isNone(existingOption)) {
          return yield* Effect.fail(
            new ObjectiveNotFoundError({ id: request.path.id })
          )
        }

        const existing = existingOption.value
        const updates = request.payload

        const updated = new Objective({
          id: existing.id,
          title: updates.title !== undefined ? Option.some(updates.title) : existing.title,
          priority: updates.priority !== undefined ? Option.some(updates.priority) : existing.priority,
          type: updates.type !== undefined ? Option.some(updates.type) : existing.type,
          system: updates.system !== undefined ? Option.some(updates.system) : existing.system,
          faction: updates.faction !== undefined ? Option.some(updates.faction) : existing.faction,
          description: updates.description !== undefined ? Option.some(updates.description) : existing.description,
          startdate: updates.startdate !== undefined ? Option.fromNullable(updates.startdate) : existing.startdate,
          enddate: updates.enddate !== undefined ? Option.fromNullable(updates.enddate) : existing.enddate,
          targets:
            updates.targets !== undefined
              ? updates.targets.map((targetInput) => {
                  const targetId = uuid() as ObjectiveTargetId
                  const settlements = targetInput.settlements.map((s) =>
                    new ObjectiveTargetSettlement({
                      id: uuid() as ObjectiveTargetSettlementId,
                      targetId,
                      name: Option.fromNullable(s.name),
                      targetindividual: Option.fromNullable(s.targetindividual),
                      targetoverall: Option.fromNullable(s.targetoverall),
                      progress: Option.fromNullable(s.progress),
                    })
                  )
                  return new ObjectiveTarget({
                    id: targetId,
                    objectiveId: existing.id,
                    type: Option.fromNullable(targetInput.type),
                    station: Option.fromNullable(targetInput.station),
                    system: Option.fromNullable(targetInput.system),
                    faction: Option.fromNullable(targetInput.faction),
                    progress: Option.fromNullable(targetInput.progress),
                    targetindividual: Option.fromNullable(targetInput.targetindividual),
                    targetoverall: Option.fromNullable(targetInput.targetoverall),
                    settlements,
                  })
                })
              : existing.targets,
        })

        yield* objectiveRepo.update(updated)

        return {
          status: "Objective updated successfully" as const,
          id: existing.id,
        }
      })
    )
    // Delete objective
    .handle("deleteObjective", (request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        yield* objectiveRepo.delete(request.path.id)

        return {
          message: `Objective ${request.path.id} and related data deleted successfully`,
        }
      })
    )
    .handle("deleteObjectiveAlt", (request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository

        yield* objectiveRepo.delete(request.path.id)

        return {
          message: `Objective ${request.path.id} and related data deleted successfully`,
        }
      })
    )
)
