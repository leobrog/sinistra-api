import { Effect, Context, Layer } from "effect"
import { SignJWT, jwtVerify } from "jose"
import { AppConfig } from "../lib/config"

export interface JwtPayload {
  userId: string
  username: string
  isAdmin: boolean
  tenantName?: string
}

export class JwtError {
  readonly _tag = "JwtError"
  constructor(readonly message: string, readonly cause?: unknown) {}
}

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
          catch: (error) => new JwtError("Failed to sign JWT", error),
        }),

      verify: (token) =>
        Effect.tryPromise({
          try: async () => {
            const { payload } = await jwtVerify(token, secret, {
              algorithms: ["HS256"],
            })

            return {
              userId: payload.userId as string,
              username: payload.username as string,
              isAdmin: payload.isAdmin as boolean,
              tenantName: payload.tenantName as string | undefined,
            }
          },
          catch: (error) => new JwtError("Failed to verify JWT", error),
        }),
    })
  })
)
