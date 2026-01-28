import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { Effect, Layer, Redacted, Option } from "effect"
import { UserLoginError } from "../../domain/errors.ts"
import { AuthenticatedUser } from "../../domain/context.ts"
import { JwtService } from "../../lib/jwt.ts"
import { UserRepository } from "../../domain/repositories.ts"
import { UserId } from "../../domain/ids.ts"

// 1. Middleware Tag (Interface)
export class Authentication extends HttpApiMiddleware.Tag<Authentication>()("Authentication", {
  failure: UserLoginError,
  provides: AuthenticatedUser,
  security: {
    bearer: HttpApiSecurity.bearer // Declares dependency on Bearer token
  }
}) {}

// 2. Middleware Implementation (Live Layer)
export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    // 1. Resolve dependencies (runs once at startup)
    const jwt = yield* JwtService
    const userRepo = yield* UserRepository

    // 2. Return the Security Handler Object
    return {
      bearer: (token: Redacted.Redacted<string>) =>
        Effect.gen(function* () {
          // Verify Token
          const payload = yield* jwt.verify(Redacted.value(token)).pipe(
            Effect.catchAll(() => Effect.fail(new UserLoginError({ message: "Invalid token" })))
          )

          if (!payload.sub) {
            return yield* Effect.fail(new UserLoginError({ message: "Invalid token subject" }))
          }

          // Fetch User
          // We must handle potential DB errors here to satisfy the middleware signature
          const user = yield* userRepo.findById(UserId.make(payload.sub)).pipe(
            Effect.catchAll(() => Effect.fail(new UserLoginError({ message: "Database error during auth" })))
          )

          // Return Authenticated Context
          return yield* Option.match(user, {
            onNone: () => Effect.fail(new UserLoginError({ message: "User not found" })),
            onSome: (u) => Effect.succeed(AuthenticatedUser.of({ user: u }))
          })
        })
    }
  })
)