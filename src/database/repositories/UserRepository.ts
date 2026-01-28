import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { UserRepository } from "../../domain/repositories.ts";
import { User } from "../../domain/models.ts";
import { DatabaseError, UserNotFoundError, UserAlreadyExistsError } from "../../domain/errors.ts";
import { mapRowToUser } from "../../lib/utils.ts";

export const UserRepositoryLive = Layer.effect(
    UserRepository,
    Effect.gen(function* () {
        const client = yield* TursoClient
        const decodeUser = Schema.decodeUnknown(User)

        return UserRepository.of({
            create: (user) => Effect.tryPromise({
                try: () => client.execute({
                    sql: "INSERT INTO users (id, email, name, password, company, plan_tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    args: [
                        user.id,
                        user.email,
                        user.name,
                        user.password,
                        Option.getOrNull(user.company),
                        user.planTier,
                        user.createdAt.getTime(),
                        user.updatedAt.getTime(),
                    ],
                }),
                catch: (error: any) => {
                    if (error?.message?.includes("UNIQUE constraint failed: users.email")) {
                        return new UserAlreadyExistsError({ email: user.email })
                    }
                    return new DatabaseError({
                        operation: 'create.user', error
                    })
                }
            }).pipe(Effect.asVoid),

            findById: (id) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM users WHERE id = ?",
                        args: [id]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findById.user', error
                    })
                })

                const row = result.rows[0]
                if (!row) return Option.none()

                const user = yield* decodeUser(mapRowToUser(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.user', error
                    }))
                )

                return Option.some(user)
            }),

            findByEmail: (email) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM users WHERE email = ?",
                        args: [email]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findByEmail.user', error
                    })
                })

                const row = result.rows[0]
                if (!row) return Option.none()

                const user = yield* decodeUser(mapRowToUser(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.user', error
                    }))
                )

                return Option.some(user)
            }),

            update: (user) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: `UPDATE users
                              SET email = ?, name = ?, password = ?, company = ?, plan_tier = ?, updated_at = ?
                              WHERE id = ?`,
                        args: [
                            user.email,
                            user.name,
                            user.password,
                            Option.getOrNull(user.company),
                            user.planTier,
                            user.updatedAt.getTime(),
                            user.id
                        ]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: "update.user", error
                    })
                })

                if(result.rowsAffected === 0) {
                    return yield* Effect.fail(new UserNotFoundError({ id: user.id }))
                }
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client.execute({
                    sql: "DELETE FROM users WHERE id = ?",
                    args: [id]
                }),
                catch: (error) => new DatabaseError({ operation: 'delete.user', error })
            }).pipe(Effect.asVoid)
        })
    })
)