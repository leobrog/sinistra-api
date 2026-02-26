import { Effect, Layer, Option, Schema } from "effect";
import { PgClient } from "../client.ts";
import { UserRepository } from "../../domain/repositories.ts";
import { User } from "../../domain/models.ts";
import { DatabaseError, UserNotFoundError, UserAlreadyExistsError } from "../../domain/errors.ts";
import { mapRowToUser } from "../../lib/utils.ts";

export const UserRepositoryLive = Layer.effect(
    UserRepository,
    Effect.gen(function* () {
        const client = yield* PgClient
        const decodeUser = Schema.decodeUnknown(User)

        return UserRepository.of({
            create: (user) => Effect.tryPromise({
                try: () => client`INSERT INTO users (id, email, name, password, company, plan_tier, created_at, updated_at) VALUES (${user.id}, ${user.email}, ${user.name}, ${user.password}, ${Option.getOrNull(user.company)}, ${user.planTier}, ${user.createdAt.getTime()}, ${user.updatedAt.getTime()})`,
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
                    try: () => client`SELECT * FROM users WHERE id = ${id}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findById.user', error
                    })
                })

                const row = (result as any)[0]
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
                    try: () => client`SELECT * FROM users WHERE email = ${email}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findByEmail.user', error
                    })
                })

                const row = (result as any)[0]
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
                    try: () => client`UPDATE users
                              SET email = ${user.email}, name = ${user.name}, password = ${user.password}, company = ${Option.getOrNull(user.company)}, plan_tier = ${user.planTier}, updated_at = ${user.updatedAt.getTime()}
                              WHERE id = ${user.id}`,
                    catch: (error) => new DatabaseError({
                        operation: "update.user", error
                    })
                })

                if((result as any).length === 0) {
                    return yield* Effect.fail(new UserNotFoundError({ id: user.id }))
                }
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client`DELETE FROM users WHERE id = ${id}`,
                catch: (error) => new DatabaseError({ operation: 'delete.user', error })
            }).pipe(Effect.asVoid)
        })
    })
)