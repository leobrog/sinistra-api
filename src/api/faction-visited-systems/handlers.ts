import { Effect } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import { TursoClient } from "../../database/client.js"
import { DatabaseError } from "../../domain/errors.js"

interface RawFaction {
  Name?: string
  FactionState?: string
  Government?: string
  Influence?: number
  Allegiance?: string
  Happiness?: string
  MyReputation?: number
  PendingStates?: { State?: string; Trend?: number }[]
  RecoveringStates?: { State?: string; Trend?: number }[]
}

interface RawFsdJump {
  StarSystem?: string
  SystemAddress?: number
  timestamp?: string
  Factions?: RawFaction[]
}

export const FactionVisitedSystemsApiLive = HttpApiBuilder.group(
  Api,
  "factionVisitedSystems",
  (handlers) =>
    handlers.handle("getFactionVisitedSystems", () =>
      Effect.gen(function* () {
        const client = yield* TursoClient

        const result = yield* Effect.tryPromise({
          try: () =>
            client.execute({
              sql: `
                WITH latest AS (
                  SELECT starsystem, MAX(timestamp) AS max_ts
                  FROM event
                  WHERE event = 'FSDJump'
                    AND timestamp >= datetime('now', '-24 hours')
                  GROUP BY starsystem
                )
                SELECT e.raw_json
                FROM event e
                JOIN latest
                  ON e.starsystem = latest.starsystem
                 AND e.timestamp  = latest.max_ts
                WHERE e.event = 'FSDJump'
                  AND e.raw_json IS NOT NULL
              `,
              args: [],
            }),
          catch: (error) => new DatabaseError({ operation: "getFactionVisitedSystems.query", error }),
        })

        const systems: {
          StarSystem: string
          SystemAddress: number | null
          Timestamp: string | null
          Factions: {
            Name: string
            FactionState: string | null
            Government: string | null
            Influence: number | null
            Allegiance: string | null
            Happiness: string | null
            MyReputation: number | null
            PendingStates: { State?: string | null; Trend?: number | null }[] | null
            RecoveringStates: { State?: string | null; Trend?: number | null }[] | null
          }[]
        }[] = []

        for (const row of result.rows) {
          const rawStr = row["raw_json"] as string | null
          if (!rawStr) continue

          let parsed: RawFsdJump
          try {
            parsed = JSON.parse(rawStr) as RawFsdJump
          } catch {
            continue
          }

          if (!parsed.StarSystem || !Array.isArray(parsed.Factions)) continue

          const factions = parsed.Factions.map((fac) => ({
            Name: fac.Name ?? "Unknown",
            FactionState: fac.FactionState ?? null,
            Government: fac.Government ?? null,
            Influence: fac.Influence ?? null,
            Allegiance: fac.Allegiance ?? null,
            Happiness: fac.Happiness ?? null,
            MyReputation: fac.MyReputation ?? null,
            PendingStates: fac.PendingStates ?? null,
            RecoveringStates: fac.RecoveringStates ?? null,
          }))

          systems.push({
            StarSystem: parsed.StarSystem,
            SystemAddress: parsed.SystemAddress ?? null,
            Timestamp: parsed.timestamp ?? null,
            Factions: factions,
          })
        }

        return systems
      })
    )
)
