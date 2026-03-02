import { Effect } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import { AppConfig } from "../../lib/config.js"
import { TickNotFoundError } from "./api.js"

export const TickApiLive = HttpApiBuilder.group(Api, "tick", (handlers) =>
  handlers.handle("getTick", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig

      const data = yield* Effect.tryPromise({
        try: async () => {
          const resp = await fetch(config.tick.apiUrl, {
            signal: AbortSignal.timeout(10_000),
            headers: { Accept: "application/json" },
          })
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          return resp.json() as Promise<Record<string, unknown>>
        },
        catch: (error) => new TickNotFoundError({ message: `Failed to fetch tick data: ${error}` }),
      })

      if (!data["lastGalaxyTick"]) {
        return yield* Effect.fail(new TickNotFoundError({ message: "No tick data available" }))
      }

      return data as { lastGalaxyTick: string }
    })
  )
)
