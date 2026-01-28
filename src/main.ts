import { BunHttpServer } from "@effect/platform-bun"
import { HttpApiBuilder, HttpMiddleware } from "@effect/platform"
import { Layer, Effect } from "effect"
import { ApiLive } from "./api/handlers.ts"
import { UserRepositoryLive } from "./database/repositories/UserRepository.ts"
import { ApiKeyRepositoryLive } from "./database/repositories/ApiKeyRepository.ts"
import { TursoClientLive } from "./database/client.ts"
import { JwtServiceLive } from "./lib/jwt.ts"

const AppLayer = ApiLive.pipe(
  Layer.provide(UserRepositoryLive),
  Layer.provide(ApiKeyRepositoryLive),
  Layer.provide(JwtServiceLive),
  Layer.provide(TursoClientLive)
)

const ServerLayer = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(AppLayer),
  Layer.provide(BunHttpServer.layer({ port: 3000 }))
)

const program = Effect.gen(function* () {
  yield* Effect.logInfo("🚀 Server starting on port 3000")
  return yield* Layer.launch(ServerLayer)
})

Effect.runFork(program)