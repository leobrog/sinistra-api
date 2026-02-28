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
            try: () => client.execute("PRAGMA busy_timeout = 30000"),
            catch: (e) => new Error(`Failed to set busy_timeout: ${e}`),
        })

        //HACK not needed in postgres
        yield* Effect.tryPromise({
            try: () => client.execute("PRAGMA wal_autocheckpoint = 1000"),
            catch: (e) => new Error(`Failed to set wal_autocheckpoint: ${e}`),
        })

        // Truncate any bloated WAL from a previous run before serving requests
        yield* Effect.tryPromise({
            try: () => client.execute("PRAGMA wal_checkpoint(TRUNCATE)"),
            catch: (e) => new Error(`Startup WAL checkpoint failed: ${e}`),
        })

        return TursoClient.of(client)
    })
)