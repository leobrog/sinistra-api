import { createClient, type Client } from "@libsql/client";
import { Config, Context, Effect, Layer } from "effect"

export class TursoClient extends Context.Tag('TursoClient')<
    TursoClient,
    Client
>() {}

export const TursoClientLive = Layer.effect(
    TursoClient,
    Effect.gen(function* () {
        const url = yield* Config.string('TURSO_DATABASE_URL')
        const authToken = yield* Config.string('TURSO_AUTH_TOKEN')
        const client = createClient({
            url,
            authToken,
        })

        yield* Effect.tryPromise({
            try: () => client.execute("PRAGMA busy_timeout = 3000"),
            catch: (e) => new Error(`Failed to set busy_timeout: ${e}`),
        })

        return TursoClient.of(client)
    })
)