/**
 * Schedulers entry point
 *
 * Forks all scheduler fibers as daemons, guarded by config.schedulers.enabled.
 * Import SchedulersLive and provide it with InfrastructureLayer in main.ts.
 */

import { Effect, Layer } from "effect"
import { AppConfig } from "../lib/config.js"
import { TursoClient } from "../database/client.js"
import { runEddnClient } from "./eddn-client.js"
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

      yield* Effect.forkDaemon(runEddnClient)
      yield* Effect.forkDaemon(runTickMonitor)
      yield* Effect.forkDaemon(runShoutoutScheduler)
      yield* Effect.forkDaemon(runConflictScheduler)
      yield* Effect.forkDaemon(runInaraSync)

      yield* Effect.logInfo("All schedulers forked")
    })
  )
