import { Effect, Context, Layer, Schema } from "effect"
import { SignJWT, jwtVerify } from "jose"
import { AppConfig } from "../lib/config.js"

export interface JwtPayload {
  userId: string
  username: string
  isAdmin: boolean
  tenantName?: string
}

export class JwtError extends Schema.TaggedError<JwtError>()("JwtError", {
  message: Schema.String,
}) {}

export class JwtService extends Context.Tag("JwtService")<
  JwtService,
  {
    sign(payload: JwtPayload): Effect.Effect<string, JwtError>
    verify(token: string): Effect.Effect<JwtPayload, JwtError>
  }
>() {}

export const JwtServiceLive = Layer.effect(
  JwtService,
  Effect.gen(function* () {
    const config = yield* AppConfig

    const secret = new TextEncoder().encode(config.jwt.secret)
    const expiresIn = config.jwt.expiresIn

    return JwtService.of({
      sign: (payload) =>
        Effect.tryPromise({
          try: async () => {
            const token = await new SignJWT({
              userId: payload.userId,
              username: payload.username,
              isAdmin: payload.isAdmin,
              tenantName: payload.tenantName,
            })
              .setProtectedHeader({ alg: "HS256" })
              .setIssuedAt()
              .setExpirationTime(expiresIn)
              .sign(secret)

            return token
          },
          catch: (_error) => new JwtError({ message: "Failed to sign JWT" }),
        }),

      verify: (token) =>
        Effect.tryPromise({
          try: async () => {
            const { payload } = await jwtVerify(token, secret, {
              algorithms: ["HS256"],
            })

            const result: JwtPayload = {
              userId: payload.userId as string,
              username: payload.username as string,
              isAdmin: payload.isAdmin as boolean,
            }

            // Only add tenantName if it exists
            if (payload.tenantName !== undefined) {
              result.tenantName = payload.tenantName as string
            }

            return result
          },
          catch: (_error) => new JwtError({ message: "Failed to verify JWT" }),
        }),
    })
  })
)
