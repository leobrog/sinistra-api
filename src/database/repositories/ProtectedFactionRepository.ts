import { Effect, Layer, Option, Schema } from "effect";
import { PgClient } from "../client.ts";
import { ProtectedFactionRepository } from "../../domain/repositories.ts";
import { ProtectedFaction } from "../../domain/models.ts";
import { DatabaseError, ProtectedFactionNotFoundError, ProtectedFactionAlreadyExistsError } from "../../domain/errors.ts";
import { mapRowToProtectedFaction } from "../../lib/utils.ts";

export const ProtectedFactionRepositoryLive = Layer.effect(
    ProtectedFactionRepository,
    Effect.gen(function* () {
        const client = yield* PgClient
        const decodeProtectedFaction = Schema.decodeUnknown(ProtectedFaction)

        return ProtectedFactionRepository.of({
            create: (faction) => Effect.tryPromise({
                try: () => client`INSERT INTO protected_faction (id, name, webhook_url, description, protected)
                          VALUES (${faction.id}, ${faction.name}, ${Option.getOrNull(faction.webhookUrl)}, ${Option.getOrNull(faction.description)}, ${faction.protected ? 1 : 0})`,
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
                    try: () => client`SELECT * FROM protected_faction WHERE id = ${id}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findById.protectedFaction', error
                    })
                })

                const row = (result as any)[0]
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
                    try: () => client`SELECT * FROM protected_faction WHERE name = ${name}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findByName.protectedFaction', error
                    })
                })

                const row = (result as any)[0]
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
                    try: () => client`SELECT * FROM protected_faction ORDER BY name`,
                    catch: (error) => new DatabaseError({
                        operation: 'findAll.protectedFaction', error
                    })
                })

                const rawFactions = result.map(mapRowToProtectedFaction)

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
                    try: () => client`SELECT * FROM protected_faction WHERE protected = 1 ORDER BY name`,
                    catch: (error) => new DatabaseError({
                        operation: 'findProtected.protectedFaction', error
                    })
                })

                const rawFactions = result.map(mapRowToProtectedFaction)

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
                    try: () => client`UPDATE protected_faction
                              SET name = ${faction.name}, webhook_url = ${Option.getOrNull(faction.webhookUrl)}, description = ${Option.getOrNull(faction.description)}, protected = ${faction.protected ? 1 : 0}
                              WHERE id = ${faction.id}`,
                    catch: (error) => new DatabaseError({
                        operation: "update.protectedFaction", error
                    })
                })

                if((result as any).length === 0) {
                    return yield* Effect.fail(new ProtectedFactionNotFoundError({ id: faction.id }))
                }
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client`DELETE FROM protected_faction WHERE id = ${id}`,
                catch: (error) => new DatabaseError({ operation: 'delete.protectedFaction', error })
            }).pipe(Effect.asVoid)
        })
    })
)
