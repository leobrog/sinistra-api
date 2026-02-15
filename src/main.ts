import { BunHttpServer } from "@effect/platform-bun"
import { HttpApiBuilder, HttpMiddleware } from "@effect/platform"
import { Layer, Effect } from "effect"
import { Api } from "./api/index.ts"
import { EventsApiLive } from "./api/events/handlers.ts"
import { ActivitiesApiLive } from "./api/activities/handlers.ts"
import { ObjectivesApiLive } from "./api/objectives/handlers.ts"
import { EventRepositoryLive } from "./database/repositories/EventRepository.ts"
import { ActivityRepositoryLive } from "./database/repositories/ActivityRepository.ts"
import { ObjectiveRepositoryLive } from "./database/repositories/ObjectiveRepository.ts"
import { ApiKeyAuthLive } from "./api/middleware/apikey.ts"
import { TursoClientLive } from "./database/client.ts"
import { AppConfigLive } from "./lib/config.ts"

// Build API from composed endpoint groups
const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(EventsApiLive),
  Layer.provide(ActivitiesApiLive),
  Layer.provide(ObjectivesApiLive),
  Layer.provide(ApiKeyAuthLive),
  Layer.provide(EventRepositoryLive),
  Layer.provide(ActivityRepositoryLive),
  Layer.provide(ObjectiveRepositoryLive),
  Layer.provide(TursoClientLive),
  Layer.provide(AppConfigLive)
)

const ServerLayer = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(ApiLive),
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

const program = Effect.gen(function* () {
  yield* Effect.logInfo("🚀 Sinistra API Server starting on port 3000")
  return yield* Layer.launch(ServerLayer)
})

Effect.runFork(program)
