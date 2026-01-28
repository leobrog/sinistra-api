import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { ApiKeyRepository } from "../../domain/repositories.ts";
import { UserApiKey } from "../../domain/models.ts";
import { DatabaseError, ApiKeyNameAlreadyExistsError } from "../../domain/errors.ts";

export const ApiKeyRepositoryLive = Layer.effect(
    ApiKeyRepository,
    Effect.gen(function* () {
        const client = yield* TursoClient
        const decodeApiKey = Schema.decodeUnknown(UserApiKey)

        return ApiKeyRepository.of({
            create: (apiKey) => Effect.tryPromise({
                try: () => client.execute({
                    sql: "INSERT INTO api_keys (id, user_id, key, name, last_used_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    args: [
                        apiKey.id,
                        apiKey.userId,
                        apiKey.key,
                        apiKey.name,
                        Option.getOrNull(apiKey.lastUsedAt)?.getTime() ?? null,
                        Option.getOrNull(apiKey.expiresAt)?.getTime() ?? null,
                        apiKey.createdAt.getTime(),
                    ],
                }),
                catch: (error: any) => {
                    if (error?.message?.includes("UNIQUE constraint failed: api_keys.user_id, api_keys.name")) {
                        return new ApiKeyNameAlreadyExistsError({ name: apiKey.name })
                    }
                    return new DatabaseError({
                        operation: 'create.apiKey', error
                    })
                }
            }).pipe(Effect.asVoid),

            find: (apiKey) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM api_keys WHERE key = ?",
                        args: [apiKey]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'find.apikey', error
                    })
                })

                const row = result.rows[0]
                if (!row) return Option.none()

                const foundApiKey = yield* decodeApiKey({
                    ...row,
                    userId: row.user_id,
                    lastUsedAt: row.last_used_at ? new Date(row.last_used_at as number).toISOString() : undefined,
                    expiresAt: row.expires_at ? new Date(row.expires_at as number).toISOString() : undefined,
                    createdAt: new Date(row.created_at as number).toISOString(),
                }).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.apiKey', error
                    }))
                )

                return Option.some(foundApiKey.key)
            }),

            findByUserId: (userId) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM api_keys WHERE user_id = ?",
                        args: [userId]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findByUserId.apiKey', error
                    })
                })

                const apiKeys = []
                for (const row of result.rows) {
                    const apiKey = yield* decodeApiKey({
                        ...row,
                        userId: row.user_id,
                        lastUsedAt: row.last_used_at ? new Date(row.last_used_at as number).toISOString() : undefined,
                        expiresAt: row.expires_at ? new Date(row.expires_at as number).toISOString() : undefined,
                        createdAt: new Date(row.created_at as number).toISOString(),
                    }).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.apiKey', error
                        }))
                    )
                    apiKeys.push(apiKey)
                }

                return apiKeys
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client.execute({
                    sql: "DELETE FROM api_keys WHERE id = ?",
                    args: [id]
                }),
                catch: (error) => new DatabaseError({ operation: 'delete.apiKey', error })
            }).pipe(Effect.asVoid)
        })
    })
)
