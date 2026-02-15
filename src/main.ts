import { BunHttpServer } from "@effect/platform-bun"
import { HttpApiBuilder, HttpMiddleware } from "@effect/platform"
import { Layer, Effect } from "effect"
import { Api } from "./api/index.ts"

// API Handlers
import { EventsApiLive } from "./api/events/handlers.ts"
import { ActivitiesApiLive } from "./api/activities/handlers.ts"
import { ObjectivesApiLive } from "./api/objectives/handlers.ts"
import { SummaryApiLive } from "./api/summary/handlers.ts"
import { ColoniesApiLive } from "./api/colonies/handlers.ts"
import { ProtectedFactionsApiLive } from "./api/protected-factions/handlers.ts"
import { SystemApiLive } from "./api/system/handlers.ts"
import { AuthApiLive } from "./api/auth/handlers.ts"
import { DiscordSummaryApiLive } from "./api/discord-summary/handlers.ts"
import { CommandersApiLive } from "./api/commanders/handlers.ts"
import { DiscoveryApiLive } from "./api/discovery/handlers.ts"

// Repositories
import { EventRepositoryLive } from "./database/repositories/EventRepository.ts"
import { ActivityRepositoryLive } from "./database/repositories/ActivityRepository.ts"
import { ObjectiveRepositoryLive } from "./database/repositories/ObjectiveRepository.ts"
import { CmdrRepositoryLive } from "./database/repositories/CmdrRepository.ts"
import { ColonyRepositoryLive } from "./database/repositories/ColonyRepository.ts"
import { ProtectedFactionRepositoryLive } from "./database/repositories/ProtectedFactionRepository.ts"
import { EddnRepositoryLive } from "./database/repositories/EddnRepository.ts"
import { FlaskUserRepositoryLive } from "./database/repositories/FlaskUserRepository.ts"

// Middleware & Infrastructure
import { ApiKeyAuthLive } from "./api/middleware/apikey.ts"
import { TursoClientLive } from "./database/client.ts"
import { AppConfigLive } from "./lib/config.ts"
import { JwtServiceLive } from "./services/jwt.ts"

// Build API from composed endpoint groups
const ApiLive = HttpApiBuilder.api(Api).pipe(
  // API Handler Layers
  Layer.provide(EventsApiLive),
  Layer.provide(ActivitiesApiLive),
  Layer.provide(ObjectivesApiLive),
  Layer.provide(SummaryApiLive),
  Layer.provide(ColoniesApiLive),
  Layer.provide(ProtectedFactionsApiLive),
  Layer.provide(SystemApiLive),
  Layer.provide(AuthApiLive),
  Layer.provide(DiscordSummaryApiLive),
  Layer.provide(CommandersApiLive),
  Layer.provide(DiscoveryApiLive),

  // Middleware
  Layer.provide(ApiKeyAuthLive),

  // Services
  Layer.provide(JwtServiceLive),

  // Repositories
  Layer.provide(EventRepositoryLive),
  Layer.provide(ActivityRepositoryLive),
  Layer.provide(ObjectiveRepositoryLive),
  Layer.provide(CmdrRepositoryLive),
  Layer.provide(ColonyRepositoryLive),
  Layer.provide(ProtectedFactionRepositoryLive),
  Layer.provide(EddnRepositoryLive),
  Layer.provide(FlaskUserRepositoryLive),

  // Infrastructure
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
