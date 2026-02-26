import { Effect, Layer, Option, Schema } from "effect";
import { PgClient } from "../client.ts";
import { ColonyRepository } from "../../domain/repositories.ts";
import { Colony } from "../../domain/models.ts";
import { DatabaseError, ColonyNotFoundError } from "../../domain/errors.ts";
import { mapRowToColony } from "../../lib/utils.ts";

export const ColonyRepositoryLive = Layer.effect(
    ColonyRepository,
    Effect.gen(function* () {
        const client = yield* PgClient
        const decodeColony = Schema.decodeUnknown(Colony)

        return ColonyRepository.of({
            create: (colony) => Effect.tryPromise({
                try: () => client`INSERT INTO colony (id, cmdr, starsystem, ravenurl, priority)
                          VALUES (${colony.id}, ${Option.getOrNull(colony.cmdr)}, ${Option.getOrNull(colony.starsystem)}, ${Option.getOrNull(colony.ravenurl)}, ${colony.priority})`,
                catch: (error: any) => new DatabaseError({
                    operation: 'create.colony', error
                })
            }).pipe(Effect.asVoid),

            findById: (id) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM colony WHERE id = ${id}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findById.colony', error
                    })
                })

                const row = (result as any)[0]
                if (!row) return Option.none()

                const colony = yield* decodeColony(mapRowToColony(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.colony', error
                    }))
                )

                return Option.some(colony)
            }),

            findAll: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM colony ORDER BY priority DESC, cmdr`,
                    catch: (error) => new DatabaseError({
                        operation: 'findAll.colony', error
                    })
                })

                const rawColonies = result.map(mapRowToColony)

                const colonies = yield* Effect.forEach(rawColonies, (raw) =>
                    decodeColony(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.colony', error
                        }))
                    )
                )

                return colonies
            }),

            findByCmdr: (cmdr) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM colony WHERE cmdr = ${cmdr} ORDER BY priority DESC`,
                    catch: (error) => new DatabaseError({
                        operation: 'findByCmdr.colony', error
                    })
                })

                const rawColonies = result.map(mapRowToColony)

                const colonies = yield* Effect.forEach(rawColonies, (raw) =>
                    decodeColony(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.colony', error
                        }))
                    )
                )

                return colonies
            }),

            findBySystem: (system) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM colony WHERE starsystem = ${system} ORDER BY priority DESC`,
                    catch: (error) => new DatabaseError({
                        operation: 'findBySystem.colony', error
                    })
                })

                const rawColonies = result.map(mapRowToColony)

                const colonies = yield* Effect.forEach(rawColonies, (raw) =>
                    decodeColony(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.colony', error
                        }))
                    )
                )

                return colonies
            }),

            findPriority: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM colony WHERE priority > 0 ORDER BY priority DESC`,
                    catch: (error) => new DatabaseError({
                        operation: 'findPriority.colony', error
                    })
                })

                const rawColonies = result.map(mapRowToColony)

                const colonies = yield* Effect.forEach(rawColonies, (raw) =>
                    decodeColony(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.colony', error
                        }))
                    )
                )

                return colonies
            }),

            update: (colony) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`UPDATE colony
                              SET cmdr = ${Option.getOrNull(colony.cmdr)}, starsystem = ${Option.getOrNull(colony.starsystem)}, ravenurl = ${Option.getOrNull(colony.ravenurl)}, priority = ${colony.priority}
                              WHERE id = ${colony.id}`,
                    catch: (error) => new DatabaseError({
                        operation: "update.colony", error
                    })
                })

                if((result as any).length === 0) {
                    return yield* Effect.fail(new ColonyNotFoundError({ id: colony.id }))
                }
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client`DELETE FROM colony WHERE id = ${id}`,
                catch: (error) => new DatabaseError({ operation: 'delete.colony', error })
            }).pipe(Effect.asVoid)
        })
    })
)
