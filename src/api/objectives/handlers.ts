import { Effect, Option } from "effect"
import { HttpApiBuilder, HttpServerRequest } from "@effect/platform"
import { v4 as uuid } from "uuid"
import { Api } from "../index.js"
import { ObjectiveRepository } from "../../domain/repositories.js"
import { CreateObjectiveRequest, UpdateObjectiveRequest, TargetInput } from "./dtos.js"
import { Objective, ObjectiveTarget, ObjectiveTargetSettlement } from "../../domain/models.js"
import type { ObjectiveId, ObjectiveTargetId, ObjectiveTargetSettlementId } from "../../domain/ids.js"
import { TursoClient } from "../../database/client.js"
import { DatabaseError, ObjectiveNotFoundError } from "../../domain/errors.js"

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

/**
 * Objectives API handlers
 */
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
    // Get objectives with filters
    .handle("getObjectives", (_request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* TursoClient
        const httpRequest = yield* HttpServerRequest.HttpServerRequest

        // Parse query parameters
        const query = httpRequest.url.split("?")[1] || ""
        const params = new URLSearchParams(query)
        const systemFilter = params.get("system") || undefined
        const factionFilter = params.get("faction") || undefined
        const activeOnly = params.get("active")?.toLowerCase() === "true"

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
        const result: { rows: any[] } = yield* Effect.tryPromise({
          try: () => client.execute({ sql, args }),
          catch: (error) => new DatabaseError({ operation: "query.objectives", error }),
        })

        // Load full objectives
        const objectives: Objective[] = []
        for (const row of result.rows) {
          const objectiveId = String(row[0]) as ObjectiveId
          const objectiveOption = yield* objectiveRepo.findById(objectiveId)

          if (Option.isSome(objectiveOption)) {
            objectives.push(objectiveOption.value)
          }
        }

        return objectives
      })
    )
    .handle("getObjectivesAlt", (_request) =>
      Effect.gen(function* () {
        const objectiveRepo = yield* ObjectiveRepository
        const client = yield* TursoClient
        const httpRequest = yield* HttpServerRequest.HttpServerRequest

        // Parse query parameters (same logic as getObjectives)
        const query = httpRequest.url.split("?")[1] || ""
        const params = new URLSearchParams(query)
        const systemFilter = params.get("system") || undefined
        const factionFilter = params.get("faction") || undefined
        const activeOnly = params.get("active")?.toLowerCase() === "true"

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

        const result = yield* Effect.tryPromise({
          try: () => client.execute({ sql, args }),
          catch: (error) => new DatabaseError({ operation: "query.objectives", error }),
        })

        const objectives: Objective[] = []
        for (const row of result.rows) {
          const objectiveId = ObjectiveId.make(String(row[0]))
          const objectiveOption = yield* objectiveRepo.findById(objectiveId)

          if (Option.isSome(objectiveOption)) {
            objectives.push(objectiveOption.value)
          }
        }

        return objectives
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
          startdate: updates.startdate !== undefined ? Option.some(updates.startdate) : existing.startdate,
          enddate: updates.enddate !== undefined ? Option.some(updates.enddate) : existing.enddate,
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
          startdate: updates.startdate !== undefined ? Option.some(updates.startdate) : existing.startdate,
          enddate: updates.enddate !== undefined ? Option.some(updates.enddate) : existing.enddate,
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
