import { Effect, Option, Schema } from "effect"
import { HttpApiBuilder, HttpServerRequest } from "@effect/platform"
import { ActivitiesApi } from "./api.ts"
import { ActivityRepository } from "../../domain/repositories.ts"
import { PutActivityRequest, FactionInput, SystemInput } from "./dtos.ts"
import { Activity, System, Faction } from "../../domain/models.ts"
import { ActivityId, SystemId, FactionId } from "../../domain/ids.ts"
import { TursoClient } from "../../database/client.ts"
import { DatabaseError } from "../../domain/errors.ts"

/**
 * Convert PUT request DTO to domain Activity entity
 */
const requestToActivity = (req: PutActivityRequest): Activity => {
  const activityId = ActivityId.make()

  const systems = req.systems.map((sys) => {
    const systemId = SystemId.make()

    const factions = sys.factions.map((fac) =>
      new Faction({
        id: FactionId.make(),
        name: fac.name,
        state: fac.state,
        systemId,
        bvs: Option.fromNullable(fac.bvs),
        cbs: Option.fromNullable(fac.cbs),
        exobiology: Option.fromNullable(fac.exobiology),
        exploration: Option.fromNullable(fac.exploration),
        scenarios: Option.fromNullable(fac.scenarios),
        infprimary: Option.fromNullable(fac.infprimary),
        infsecondary: Option.fromNullable(fac.infsecondary),
        missionfails: Option.fromNullable(fac.missionfails),
        murdersground: Option.fromNullable(fac.murdersground),
        murdersspace: Option.fromNullable(fac.murdersspace),
        tradebm: Option.fromNullable(fac.tradebm),
      })
    )

    return new System({
      id: systemId,
      name: sys.name,
      address: sys.address,
      activityId,
      factions,
    })
  })

  return new Activity({
    id: activityId,
    tickid: req.tickid,
    ticktime: req.ticktime,
    timestamp: req.timestamp,
    cmdr: Option.fromNullable(req.cmdr),
    systems,
  })
}

/**
 * Resolve tick filter to actual tickid
 * Supports: ct (current tick), lt (last tick), current, last, or specific tickid
 */
const resolveTickFilter = (
  period: string | undefined,
  client: TursoClient
): Effect.Effect<string | null, DatabaseError> => {
  if (!period) {
    return Effect.succeed(null)
  }

  const normalized = period.trim().toLowerCase()

  if (normalized === "ct" || normalized === "current") {
    // Get most recent tickid
    return Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          client.execute({
            sql: "SELECT tickid FROM activity ORDER BY timestamp DESC LIMIT 1",
            args: [],
          }),
        catch: (error) =>
          new DatabaseError({ operation: "query.activity.current_tick", error }),
      })

      if (result.rows.length === 0) {
        return null
      }

      return String(result.rows[0][0])
    })
  }

  if (normalized === "lt" || normalized === "last") {
    // Get second most recent tickid
    return Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          client.execute({
            sql: "SELECT DISTINCT tickid FROM activity ORDER BY timestamp DESC LIMIT 2",
            args: [],
          }),
        catch: (error) =>
          new DatabaseError({ operation: "query.activity.last_tick", error }),
      })

      if (result.rows.length < 2) {
        return null
      }

      return String(result.rows[1][0])
    })
  }

  // Treat as specific tickid
  return Effect.succeed(period)
}

/**
 * Activities API handlers
 */
export const ActivitiesApiLive = HttpApiBuilder.group(ActivitiesApi, "activities", (handlers) =>
  handlers
    .handle("putActivity", (request) =>
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository

        // Convert request to domain entity
        const activity = requestToActivity(request.payload)

        // Upsert activity
        yield* activityRepo.upsert(activity)

        return {
          status: "activity saved" as const,
        }
      })
    )
    .handle("getActivities", (request) =>
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository
        const client = yield* TursoClient
        const httpRequest = yield* HttpServerRequest.HttpServerRequest

        // Parse query parameters
        const query = httpRequest.url.split("?")[1] || ""
        const params = new URLSearchParams(query)
        const period = params.get("period") || undefined
        const cmdr = params.get("cmdr") || undefined
        const systemName = params.get("system") || undefined
        const factionName = params.get("faction") || undefined

        // Resolve tick filter
        const tickFilter = yield* resolveTickFilter(period, client)

        // Build SQL query with filters
        let sql = `
          SELECT DISTINCT a.*
          FROM activity a
        `
        const args: any[] = []
        const whereClauses: string[] = []

        if (tickFilter) {
          whereClauses.push("a.tickid = ?")
          args.push(tickFilter)
        }

        if (cmdr) {
          whereClauses.push("a.cmdr = ?")
          args.push(cmdr)
        }

        if (systemName) {
          sql += ` JOIN system s ON s.activity_id = a.id`
          whereClauses.push("s.name = ?")
          args.push(systemName)
        }

        if (factionName) {
          if (!systemName) {
            sql += ` JOIN system s ON s.activity_id = a.id`
          }
          sql += ` JOIN faction f ON f.system_id = s.id`
          whereClauses.push("f.name = ?")
          args.push(factionName)
        }

        if (whereClauses.length > 0) {
          sql += ` WHERE ` + whereClauses.join(" AND ")
        }

        sql += ` ORDER BY a.timestamp DESC`

        // Execute query
        const result = yield* Effect.tryPromise({
          try: () => client.execute({ sql, args }),
          catch: (error) =>
            new DatabaseError({ operation: "query.activities", error }),
        })

        // Load full activities with nested data
        const activities: Activity[] = []

        for (const row of result.rows) {
          const activityId = String(row[0])
          const activityOption = yield* activityRepo.findById(ActivityId.make(activityId))

          if (Option.isSome(activityOption)) {
            activities.push(activityOption.value)
          }
        }

        // Filter systems and factions if specified
        if (systemName || factionName) {
          return activities.map((activity) => {
            const filteredSystems = activity.systems.filter((sys) => {
              if (systemName && sys.name !== systemName) return false

              if (factionName) {
                const matchingFactions = sys.factions.filter(
                  (fac) => fac.name === factionName
                )
                if (matchingFactions.length === 0) return false

                // Replace factions with filtered list
                return true
              }

              return true
            })

            return new Activity({
              ...activity,
              systems: filteredSystems,
            })
          })
        }

        return activities
      })
    )
)
