import { Effect, PubSub } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import { AppConfig } from "../../lib/config.js"
import { TursoClient } from "../../database/client.js"
import { TickBus } from "../../services/TickBus.js"
import { TickNotFoundError } from "./api.js"

export const TickApiLive = HttpApiBuilder.group(Api, "tick", (handlers) =>
  handlers
    .handle("getTick", () =>
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
    .handle("forceTick", ({ payload }) =>
      Effect.gen(function* () {
        const client = yield* TursoClient
        const bus = yield* TickBus
        const ticktime = payload.ticktime

        yield* Effect.tryPromise({
          try: () =>
            client.execute({
              sql: `INSERT INTO tick_state (id, tickid, ticktime, last_updated)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(tickid) DO UPDATE SET
                      ticktime = excluded.ticktime,
                      last_updated = excluded.last_updated`,
              args: [crypto.randomUUID(), ticktime, ticktime, new Date().toISOString()],
            }),
          catch: (e) => new Error(`Failed to insert tick: ${e}`),
        }).pipe(Effect.orDie)

        yield* PubSub.publish(bus, ticktime)

        return { status: "ok", ticktime }
      })
    )
)
