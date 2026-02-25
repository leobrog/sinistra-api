/**
 * Schedulers entry point
 *
 * Forks all scheduler fibers as daemons, guarded by config.schedulers.enabled.
 * Import SchedulersLive and provide it with InfrastructureLayer in main.ts.
 */

import { Effect, Layer, PubSub } from "effect"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"
import { TickBus } from "../services/TickBus.js"
import { runTickMonitor } from "./tick-monitor.js"
import { runShoutoutScheduler } from "./shoutout-scheduler.js"
import { runConflictScheduler } from "./conflict-scheduler.js"
import { runInaraSync } from "./inara-sync.js"

export const SchedulersLive: Layer.Layer<never, never, AppConfig | TursoClient> =
  Layer.effectDiscard(
    Effect.gen(function* () {
      const config = yield* AppConfig

      if (!config.schedulers.enabled) {
        yield* Effect.logInfo("Schedulers disabled (ENABLE_SCHEDULERS=false)")
        return
      }

      // Create TickBus — shared PubSub connecting tick-monitor → conflict-scheduler
      const bus = yield* PubSub.unbounded<string>()

      yield* Effect.forkDaemon(
        Effect.provideService(runTickMonitor, TickBus, bus)
      )
      yield* Effect.forkDaemon(
        Effect.provideService(runShoutoutScheduler, TickBus, bus)
      )
      yield* Effect.forkDaemon(
        Effect.provideService(runConflictScheduler, TickBus, bus)
      )
      yield* Effect.forkDaemon(runInaraSync)

      yield* Effect.logInfo("All schedulers forked")
    })
  )
