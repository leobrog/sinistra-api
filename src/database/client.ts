import { createClient, type Client } from "@libsql/client";
import { Config, Context, Effect, Layer } from "effect"
import { AppConfig } from "../lib/config.js"

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

export class EddnTursoClient extends Context.Tag('EddnTursoClient')<
    EddnTursoClient,
    Client
>() {}

export const EddnTursoClientLive = Layer.effect(
    EddnTursoClient,
    Effect.gen(function* () {
        const config = yield* AppConfig
        const client = createClient({
            url: config.database.eddnUrl,
            authToken: "",
        })

        yield* Effect.tryPromise({
            try: () => client.execute("PRAGMA busy_timeout = 30000"),
            catch: (e) => new Error(`EDDN: Failed to set busy_timeout: ${e}`),
        })

        yield* Effect.tryPromise({
            try: () => client.execute("PRAGMA wal_autocheckpoint = 1000"),
            catch: (e) => new Error(`EDDN: Failed to set wal_autocheckpoint: ${e}`),
        })

        yield* Effect.tryPromise({
            try: () => client.execute("PRAGMA wal_checkpoint(TRUNCATE)"),
            catch: (e) => new Error(`EDDN: Startup WAL checkpoint failed: ${e}`),
        })

        return EddnTursoClient.of(client)
    })
)