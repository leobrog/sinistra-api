import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { ProtectedFactionRepository } from "../../domain/repositories.ts";
import { ProtectedFaction } from "../../domain/models.ts";
import { DatabaseError, ProtectedFactionNotFoundError, ProtectedFactionAlreadyExistsError } from "../../domain/errors.ts";
import { mapRowToProtectedFaction } from "../../lib/utils.ts";

export const ProtectedFactionRepositoryLive = Layer.effect(
    ProtectedFactionRepository,
    Effect.gen(function* () {
        const client = yield* TursoClient
        const decodeProtectedFaction = Schema.decodeUnknown(ProtectedFaction)

        return ProtectedFactionRepository.of({
            create: (faction) => Effect.tryPromise({
                try: () => client.execute({
                    sql: `INSERT INTO protected_faction (id, name, webhook_url, description, protected)
                          VALUES (?, ?, ?, ?, ?)`,
                    args: [
                        faction.id,
                        faction.name,
                        Option.getOrNull(faction.webhookUrl),
                        Option.getOrNull(faction.description),
                        faction.protected ? 1 : 0, // Boolean to INTEGER
                    ],
                }),
                catch: (error: any) => {
                    if (error?.message?.includes("UNIQUE constraint failed: protected_faction.name")) {
                        return new ProtectedFactionAlreadyExistsError({ name: faction.name })
                    }
                    return new DatabaseError({
                        operation: 'create.protectedFaction', error
                    })
                }
            }).pipe(Effect.asVoid),

            findById: (id) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM protected_faction WHERE id = ?",
                        args: [id]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findById.protectedFaction', error
                    })
                })

                const row = result.rows[0]
                if (!row) return Option.none()

                const faction = yield* decodeProtectedFaction(mapRowToProtectedFaction(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.protectedFaction', error
                    }))
                )

                return Option.some(faction)
            }),

            findByName: (name) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM protected_faction WHERE name = ?",
                        args: [name]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findByName.protectedFaction', error
                    })
                })

                const row = result.rows[0]
                if (!row) return Option.none()

                const faction = yield* decodeProtectedFaction(mapRowToProtectedFaction(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.protectedFaction', error
                    }))
                )

                return Option.some(faction)
            }),

            findAll: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute("SELECT * FROM protected_faction ORDER BY name"),
                    catch: (error) => new DatabaseError({
                        operation: 'findAll.protectedFaction', error
                    })
                })

                const rawFactions = result.rows.map(mapRowToProtectedFaction)

                const factions = yield* Effect.forEach(rawFactions, (raw) =>
                    decodeProtectedFaction(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.protectedFaction', error
                        }))
                    )
                )

                return factions
            }),

            findProtected: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute("SELECT * FROM protected_faction WHERE protected = 1 ORDER BY name"),
                    catch: (error) => new DatabaseError({
                        operation: 'findProtected.protectedFaction', error
                    })
                })

                const rawFactions = result.rows.map(mapRowToProtectedFaction)

                const factions = yield* Effect.forEach(rawFactions, (raw) =>
                    decodeProtectedFaction(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.protectedFaction', error
                        }))
                    )
                )

                return factions
            }),

            update: (faction) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: `UPDATE protected_faction
                              SET name = ?, webhook_url = ?, description = ?, protected = ?
                              WHERE id = ?`,
                        args: [
                            faction.name,
                            Option.getOrNull(faction.webhookUrl),
                            Option.getOrNull(faction.description),
                            faction.protected ? 1 : 0,
                            faction.id
                        ]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: "update.protectedFaction", error
                    })
                })

                if(result.rowsAffected === 0) {
                    return yield* Effect.fail(new ProtectedFactionNotFoundError({ id: faction.id }))
                }
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client.execute({
                    sql: "DELETE FROM protected_faction WHERE id = ?",
                    args: [id]
                }),
                catch: (error) => new DatabaseError({ operation: 'delete.protectedFaction', error })
            }).pipe(Effect.asVoid)
        })
    })
)
