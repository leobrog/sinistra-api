import { Config, Context, Effect, Layer, Redacted } from "effect";
import * as Jose from 'jose'
import { JwtSigningError, JwtVerifyError } from "../domain/errors.ts";


export class JwtService extends Context.Tag("JwtService")<
    JwtService,
    {
        readonly sign: (payload: Record<string, unknown>) => Effect.Effect<string, JwtSigningError>
        readonly verify: (token: string) => Effect.Effect<Jose.JWTPayload, JwtVerifyError>
    }
>(){}

const makeJwtService = Effect.gen(function* () {
    const secret = yield* Config.string("JWT_SECRET").pipe(
        Config.map(Redacted.make)
    )

    const secretBytes = new TextEncoder().encode(Redacted.value(secret))

    const sign = (payload: Record<string, unknown>) => Effect.tryPromise({
        try: () => new Jose.SignJWT(payload)
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("24h") // Token valid for 24 hours
          .sign(secretBytes),
        catch: (error) => new JwtSigningError({ message: `Token signing failed: ${error}`})
    })

    const verify = (token: string) => Effect.tryPromise({
        try: async () => {
            const { payload } = await Jose.jwtVerify(token, secretBytes)
            return payload
        },
        catch: (error) => new JwtVerifyError({ message: `Token verification failed: ${error}`})
    })

    return  { sign, verify }
})

export const JwtServiceLive = Layer.effect(JwtService, makeJwtService)