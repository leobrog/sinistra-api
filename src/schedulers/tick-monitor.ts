/**
 * Tick Monitor Fiber
 *
 * Polls Zoy's galtick.json every 5 minutes (configurable).
 * On a new tick: saves to tick_state, notifies via BGS Discord webhook.
 */

import { Effect, Ref, Duration, PubSub } from "effect"
import type { Client } from "@libsql/client"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"
import { TickBus } from "../services/TickBus.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ZoyTickResponse {
  lastGalaxyTick?: string
}

const fetchCurrentTick = (apiUrl: string): Effect.Effect<string | null> =>
  Effect.tryPromise({
    try: async () => {
      const resp = await fetch(apiUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: "application/json" },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as ZoyTickResponse
      return data.lastGalaxyTick ?? null
    },
    catch: (e) => new Error(`Tick fetch failed: ${e}`),
  }).pipe(
    Effect.catchAll((e) =>
      Effect.logWarning(`Tick poll error: ${e}`).pipe(Effect.as(null))
    )
  )

const saveTick = (client: Client, tickid: string): Effect.Effect<void> =>
  Effect.tryPromise({
    try: () =>
      client.execute({
        sql: `INSERT INTO tick_state (id, tickid, ticktime, last_updated)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(tickid) DO UPDATE SET
                ticktime = excluded.ticktime,
                last_updated = excluded.last_updated`,
        args: [crypto.randomUUID(), tickid, tickid, new Date().toISOString()],
      }),
    catch: (e) => new Error(`Failed to save tick: ${e}`),
  }).pipe(
    Effect.asVoid,
    Effect.catchAll((e) => Effect.logWarning(`Tick save error: ${e}`))
  )

const notifyDiscord = (webhookUrls: string[], tickid: string): Effect.Effect<void> =>
  Effect.forEach(
    webhookUrls,
    (webhookUrl) =>
      Effect.tryPromise({
        try: () =>
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `**✅ New FDEV (Zoy) BGS Tick detected!**\nTime: \`${tickid}\``,
            }),
            signal: AbortSignal.timeout(10_000),
          }),
        catch: (e) => new Error(`Discord notify failed: ${e}`),
      }).pipe(
        Effect.asVoid,
        Effect.catchAll((e) => Effect.logWarning(`Tick Discord notification error: ${e}`))
      ),
    { discard: true, concurrency: "unbounded" }
  )

// ---------------------------------------------------------------------------
// Main fiber
// ---------------------------------------------------------------------------

export const runTickMonitor: Effect.Effect<never, never, AppConfig | TursoClient | TickBus> = Effect.gen(
  function* () {
    const config = yield* AppConfig
    const client = yield* TursoClient
    const bus = yield* TickBus

    yield* Effect.logInfo("Tick monitor started")

    // Seed from DB so we don't re-notify on restart
    const initResult = yield* Effect.tryPromise({
      try: () =>
        client.execute("SELECT tickid FROM tick_state ORDER BY last_updated DESC LIMIT 1"),
      catch: () => ({ rows: [] as any[] }),
    }).pipe(Effect.orElse(() => Effect.succeed({ rows: [] as any[] })))

    const lastTickRef = yield* Ref.make<string | null>(
      (initResult.rows[0]?.tickid as string | undefined) ?? null
    )

    yield* Effect.logInfo(
      `Tick monitor initialized. Last known tick: ${(yield* Ref.get(lastTickRef)) ?? "none"}`
    )

    // Poll once per interval
    const pollOnce = Effect.gen(function* () {
      yield* Effect.sleep(Duration.millis(config.tick.pollIntervalMs))

      const newTick = yield* fetchCurrentTick(config.tick.apiUrl)
      const lastTick = yield* Ref.get(lastTickRef)

      if (newTick && newTick !== lastTick) {
        yield* Effect.logInfo(`New tick detected: ${lastTick ?? "none"} → ${newTick}`)
        yield* Ref.set(lastTickRef, newTick)
        yield* saveTick(client, newTick)
        yield* PubSub.publish(bus, newTick)

        const bgsWebhooks = config.discord.webhooks.bgs
        if (bgsWebhooks.length > 0) {
          yield* notifyDiscord(bgsWebhooks, newTick)
          yield* Effect.logInfo(`Tick notification sent to Discord`)
        }
      } else {
        yield* Effect.logDebug("Tick unchanged")
      }
    })

    return yield* Effect.forever(pollOnce)
  }
).pipe(
  Effect.catchAll((e) => Effect.logError(`Tick monitor fatal error: ${e}`))
) as Effect.Effect<never, never, AppConfig | TursoClient | TickBus>
