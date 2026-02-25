import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
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
import { TickApiLive } from "./api/tick/handlers.ts"
import { CmdrLocationApiLive } from "./api/cmdr-location/handlers.ts"
import { CZApiLive } from "./api/cz/handlers.ts"
import { BountyVouchersApiLive } from "./api/bounty-vouchers/handlers.ts"

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

// Schedulers
import { SchedulersLive } from "./schedulers/index.ts"

// OAuth callback (outside HttpApiBuilder — needs raw redirect + Set-Cookie)
import { oauthCallbackMiddleware } from "./api/auth/oauth-callback.ts"
// BGS Table browser (outside HttpApiBuilder — raw DB query endpoint)
import { tableMiddleware } from "./api/table-middleware.ts"

// Build API from composed endpoint groups
const ApiHandlersLayer = Layer.mergeAll(
  EventsApiLive,
  ActivitiesApiLive,
  ObjectivesApiLive,
  SummaryApiLive,
  ColoniesApiLive,
  ProtectedFactionsApiLive,
  SystemApiLive,
  AuthApiLive,
  DiscordSummaryApiLive,
  CommandersApiLive,
  DiscoveryApiLive,
  TickApiLive,
  CmdrLocationApiLive,
  CZApiLive,
  BountyVouchersApiLive
)

const RepositoriesLayer = Layer.mergeAll(
  EventRepositoryLive,
  ActivityRepositoryLive,
  ObjectiveRepositoryLive,
  CmdrRepositoryLive,
  ColonyRepositoryLive,
  ProtectedFactionRepositoryLive,
  EddnRepositoryLive,
  FlaskUserRepositoryLive
)

const ServicesLayer = Layer.mergeAll(JwtServiceLive, ApiKeyAuthLive)

const InfrastructureLayer = Layer.mergeAll(TursoClientLive, AppConfigLive)

const SchedulerLayer = SchedulersLive.pipe(Layer.provide(InfrastructureLayer))

const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(ApiHandlersLayer),
  Layer.provide(ServicesLayer),
  Layer.provide(RepositoriesLayer),
  Layer.provide(InfrastructureLayer)
)

const ServerLayer = HttpApiBuilder.serve((app) =>
  HttpMiddleware.logger(tableMiddleware(oauthCallbackMiddleware(app)))
).pipe(
  Layer.provide(ApiLive),
  Layer.provide(RepositoriesLayer),
  Layer.provide(InfrastructureLayer),
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

// Launch server and schedulers together
Layer.launch(Layer.mergeAll(ServerLayer, SchedulerLayer)).pipe(
  Effect.tap(() => Effect.logInfo("🚀 Sinistra API Server started on port 3000")),
  Effect.scoped,
  BunRuntime.runMain
)
