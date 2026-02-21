import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { ColonyRepository } from "../../domain/repositories.ts";
import { Colony } from "../../domain/models.ts";
import { DatabaseError, ColonyNotFoundError } from "../../domain/errors.ts";
import { mapRowToColony } from "../../lib/utils.ts";

export const ColonyRepositoryLive = Layer.effect(
    ColonyRepository,
    Effect.gen(function* () {
        const client = yield* TursoClient
        const decodeColony = Schema.decodeUnknown(Colony)

        return ColonyRepository.of({
            create: (colony) => Effect.tryPromise({
                try: () => client.execute({
                    sql: `INSERT INTO colony (id, cmdr, starsystem, ravenurl, priority)
                          VALUES (?, ?, ?, ?, ?)`,
                    args: [
                        colony.id,
                        Option.getOrNull(colony.cmdr),
                        Option.getOrNull(colony.starsystem),
                        Option.getOrNull(colony.ravenurl),
                        colony.priority,
                    ],
                }),
                catch: (error: any) => new DatabaseError({
                    operation: 'create.colony', error
                })
            }).pipe(Effect.asVoid),

            findById: (id) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM colony WHERE id = ?",
                        args: [id]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findById.colony', error
                    })
                })

                const row = result.rows[0]
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
                    try: () => client.execute("SELECT * FROM colony ORDER BY priority DESC, cmdr"),
                    catch: (error) => new DatabaseError({
                        operation: 'findAll.colony', error
                    })
                })

                const rawColonies = result.rows.map(mapRowToColony)

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
                    try: () => client.execute({
                        sql: "SELECT * FROM colony WHERE cmdr = ? ORDER BY priority DESC",
                        args: [cmdr]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findByCmdr.colony', error
                    })
                })

                const rawColonies = result.rows.map(mapRowToColony)

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
                    try: () => client.execute({
                        sql: "SELECT * FROM colony WHERE starsystem = ? ORDER BY priority DESC",
                        args: [system]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findBySystem.colony', error
                    })
                })

                const rawColonies = result.rows.map(mapRowToColony)

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
                    try: () => client.execute("SELECT * FROM colony WHERE priority > 0 ORDER BY priority DESC"),
                    catch: (error) => new DatabaseError({
                        operation: 'findPriority.colony', error
                    })
                })

                const rawColonies = result.rows.map(mapRowToColony)

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
                    try: () => client.execute({
                        sql: `UPDATE colony
                              SET cmdr = ?, starsystem = ?, ravenurl = ?, priority = ?
                              WHERE id = ?`,
                        args: [
                            Option.getOrNull(colony.cmdr),
                            Option.getOrNull(colony.starsystem),
                            Option.getOrNull(colony.ravenurl),
                            colony.priority,
                            colony.id
                        ]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: "update.colony", error
                    })
                })

                if(result.rowsAffected === 0) {
                    return yield* Effect.fail(new ColonyNotFoundError({ id: colony.id }))
                }
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client.execute({
                    sql: "DELETE FROM colony WHERE id = ?",
                    args: [id]
                }),
                catch: (error) => new DatabaseError({ operation: 'delete.colony', error })
            }).pipe(Effect.asVoid)
        })
    })
)
