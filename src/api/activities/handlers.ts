import { Effect, Option } from "effect"
import { HttpApiBuilder, HttpServerRequest } from "@effect/platform"
import { v4 as uuid } from "uuid"
import { Api } from "../index.js"
import { ActivityRepository } from "../../domain/repositories.js"
import type { PutActivityRequest } from "./dtos.js"
import { Activity, Faction, FactionSettlement, FactionStation, System } from "../../domain/models.js"
import { ActivityId, FactionId, FactionSettlementId, FactionStationId, SystemId } from "../../domain/ids.js"
import { SQL } from 'bun'
import { PgClient } from "../../database/client.js"
import { DatabaseError } from "../../domain/errors.js"

/**
 * Convert PUT request DTO to domain Activity entity
 */
const requestToActivity = (req: PutActivityRequest): Activity => {
  const activityId = uuid() as ActivityId

  const systems = req.systems.map((sys) => {
    const systemId = uuid() as SystemId

    const factions = sys.factions.map((fac) => {
      const factionId = uuid() as FactionId

      const czgroundSettlements: FactionSettlement[] = (fac.czground?.settlements ?? []).map(
        (s) =>
          new FactionSettlement({
            id: uuid() as FactionSettlementId,
            factionId,
            name: s.name,
            type: s.type,
            count: s.count,
          })
      )

      const stations: FactionStation[] = (fac.stations ?? []).map((st) => {
        const twcargo = st.twcargo
          ? Option.some({ sum: st.twcargo.sum, count: st.twcargo.count })
          : Option.none()

        const mapLMH = (lmh: typeof st.twescapepods) =>
          lmh
            ? Option.some({
                low: lmh.low ? Option.some({ sum: lmh.low.sum, count: lmh.low.count }) : Option.none(),
                medium: lmh.medium ? Option.some({ sum: lmh.medium.sum, count: lmh.medium.count }) : Option.none(),
                high: lmh.high ? Option.some({ sum: lmh.high.sum, count: lmh.high.count }) : Option.none(),
              })
            : Option.none()

        const twmassacre = st.twmassacre
          ? Option.some({
              cyclops: st.twmassacre.cyclops ? Option.some({ sum: st.twmassacre.cyclops.sum, count: st.twmassacre.cyclops.count }) : Option.none(),
              basilisk: st.twmassacre.basilisk ? Option.some({ sum: st.twmassacre.basilisk.sum, count: st.twmassacre.basilisk.count }) : Option.none(),
              medusa: st.twmassacre.medusa ? Option.some({ sum: st.twmassacre.medusa.sum, count: st.twmassacre.medusa.count }) : Option.none(),
              hydra: st.twmassacre.hydra ? Option.some({ sum: st.twmassacre.hydra.sum, count: st.twmassacre.hydra.count }) : Option.none(),
              orthrus: st.twmassacre.orthrus ? Option.some({ sum: st.twmassacre.orthrus.sum, count: st.twmassacre.orthrus.count }) : Option.none(),
              scout: st.twmassacre.scout ? Option.some({ sum: st.twmassacre.scout.sum, count: st.twmassacre.scout.count }) : Option.none(),
            })
          : Option.none()

        return new FactionStation({
          id: uuid() as FactionStationId,
          factionId,
          name: st.name,
          twreactivate: Option.fromNullable(st.twreactivate),
          twcargo,
          twescapepods: mapLMH(st.twescapepods),
          twpassengers: mapLMH(st.twpassengers),
          twmassacre,
        })
      })

      const mapCZLevels = (cz: typeof fac.czspace) =>
        cz
          ? Option.some({
              low: Option.fromNullable(cz.low),
              medium: Option.fromNullable(cz.medium),
              high: Option.fromNullable(cz.high),
            })
          : Option.none()

      const mapTrade = (t: typeof fac.tradebuy) =>
        t
          ? Option.some({
              high: t.high
                ? Option.some({ items: Option.fromNullable(t.high.items), value: Option.fromNullable(t.high.value), profit: Option.fromNullable(t.high.profit) })
                : Option.none(),
              low: t.low
                ? Option.some({ items: Option.fromNullable(t.low.items), value: Option.fromNullable(t.low.value), profit: Option.fromNullable(t.low.profit) })
                : Option.none(),
              zero: t.zero
                ? Option.some({ items: Option.fromNullable(t.zero.items), value: Option.fromNullable(t.zero.value), profit: Option.fromNullable(t.zero.profit) })
                : Option.none(),
            })
          : Option.none()

      const mapSandR = (s: typeof fac.sandr) =>
        s
          ? Option.some({
              blackboxes: Option.fromNullable(s.blackboxes),
              damagedpods: Option.fromNullable(s.damagedpods),
              occupiedpods: Option.fromNullable(s.occupiedpods),
              thargoidpods: Option.fromNullable(s.thargoidpods),
              wreckagecomponents: Option.fromNullable(s.wreckagecomponents),
              personaleffects: Option.fromNullable(s.personaleffects),
              politicalprisoners: Option.fromNullable(s.politicalprisoners),
              hostages: Option.fromNullable(s.hostages),
            })
          : Option.none()

      return new Faction({
        id: factionId,
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
        czspace: mapCZLevels(fac.czspace),
        czground: mapCZLevels(fac.czground),
        czgroundSettlements,
        sandr: mapSandR(fac.sandr),
        tradebuy: mapTrade(fac.tradebuy),
        tradesell: mapTrade(fac.tradesell),
        stations,
      })
    })

    const mapTWKills = (tw: typeof sys.twkills) =>
      tw
        ? Option.some({
            cyclops: Option.fromNullable(tw.cyclops),
            basilisk: Option.fromNullable(tw.basilisk),
            medusa: Option.fromNullable(tw.medusa),
            hydra: Option.fromNullable(tw.hydra),
            orthrus: Option.fromNullable(tw.orthrus),
            scout: Option.fromNullable(tw.scout),
            revenant: Option.fromNullable(tw.revenant),
            banshee: Option.fromNullable(tw.banshee),
            scytheGlaive: Option.fromNullable(tw["scythe-glaive"]),
          })
        : Option.none()

    const mapTWSandR = (tw: typeof sys.twsandr) =>
      tw
        ? Option.some({
            blackboxes: Option.fromNullable(tw.blackboxes),
            damagedpods: Option.fromNullable(tw.damagedpods),
            occupiedpods: Option.fromNullable(tw.occupiedpods),
            tissuesamples: Option.fromNullable(tw.tissuesamples),
            thargoidpods: Option.fromNullable(tw.thargoidpods),
          })
        : Option.none()

    return new System({
      id: systemId,
      name: sys.name,
      address: sys.address,
      activityId,
      factions,
      twkills: mapTWKills(sys.twkills),
      twsandr: mapTWSandR(sys.twsandr),
      twreactivate: Option.fromNullable(sys.twreactivate),
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
  client: SQL
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
          client`SELECT tickid FROM activity ORDER BY timestamp DESC LIMIT 1`,
        catch: (error) =>
          new DatabaseError({ operation: "query.activity.current_tick", error }),
      })

      if ((result as any).length === 0) {
        return null
      }

      return String((result as any)[0]![0])
    })
  }

  if (normalized === "lt" || normalized === "last") {
    // Get second most recent tickid
    return Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          client`SELECT DISTINCT tickid FROM activity ORDER BY timestamp DESC LIMIT 2`,
        catch: (error) =>
          new DatabaseError({ operation: "query.activity.last_tick", error }),
      })

      if ((result as any).length < 2) {
        return null
      }

      return String((result as any)[1]![0])
    })
  }

  // Treat as specific tickid
  return Effect.succeed(period)
}

/**
 * Activities API handlers
 */
export const ActivitiesApiLive = HttpApiBuilder.group(Api, "activities", (handlers) =>
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
    .handle("getActivities", (_request) =>
      Effect.gen(function* () {
        const activityRepo = yield* ActivityRepository
        const client = yield* PgClient
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
          try: () => client.unsafe(sql as any),
          catch: (error) =>
            new DatabaseError({ operation: "query.activities", error }),
        })

        // Load full activities with nested data
        const activities: Activity[] = []

        for (const row of result as any[]) {
          const activityId = String(row[0]) as ActivityId
          const activityOption = yield* activityRepo.findById(activityId)

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
