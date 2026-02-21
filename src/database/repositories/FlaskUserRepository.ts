import { Effect, Layer, Option, Schema } from "effect"
import { TursoClient } from "../client.ts"
import { FlaskUserRepository } from "../../domain/repositories.ts"
import { FlaskUser } from "../../domain/models.ts"
import { DatabaseError, UserAlreadyExistsError, UserNotFoundError } from "../../domain/errors.ts"
import { UserId } from "../../domain/ids.ts"

// Row mapper for flask_users table
const mapRowToFlaskUser = (row: Record<string, unknown>) => ({
  id: row.id as string,
  username: row.username as string,
  passwordHash: row.password_hash as string,
  discordId: row.discord_id === null ? undefined : (row.discord_id as string),
  discordUsername: row.discord_username === null ? undefined : (row.discord_username as string),
  isAdmin: Boolean(row.is_admin),
  active: Boolean(row.active),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})

export const FlaskUserRepositoryLive = Layer.effect(
  FlaskUserRepository,
  Effect.gen(function* () {
    const client = yield* TursoClient
    const decodeFlaskUser = Schema.decodeUnknown(FlaskUser)

    return FlaskUserRepository.of({
      create: (user) =>
        Effect.gen(function* () {
          // Check if user already exists
          const existingByUsername = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT id FROM flask_users WHERE username = ?",
                args: [user.username],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "checkUsername.flaskUser",
                error,
              }),
          })

          if (existingByUsername.rows.length > 0) {
            return yield* Effect.fail(
              new UserAlreadyExistsError({
                email: user.username, // Using username as email identifier
              })
            )
          }

          // Check if discord_id already exists (if provided)
          if (Option.isSome(user.discordId)) {
            const existingByDiscord = yield* Effect.tryPromise({
              try: () =>
                client.execute({
                  sql: "SELECT id FROM flask_users WHERE discord_id = ?",
                  args: [Option.getOrNull(user.discordId)],
                }),
              catch: (error) =>
                new DatabaseError({
                  operation: "checkDiscordId.flaskUser",
                  error,
                }),
            })

            if (existingByDiscord.rows.length > 0) {
              return yield* Effect.fail(
                new UserAlreadyExistsError({
                  email: Option.getOrElse(user.discordId, () => "unknown"), // Using Discord ID as identifier
                })
              )
            }
          }

          // Insert new user
          yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: `INSERT INTO flask_users (id, username, password_hash, discord_id, discord_username, is_admin, active, created_at, updated_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                  user.id,
                  user.username,
                  user.passwordHash,
                  Option.getOrNull(user.discordId),
                  Option.getOrNull(user.discordUsername),
                  user.isAdmin ? 1 : 0,
                  user.active ? 1 : 0,
                  user.createdAt.toISOString(),
                  user.updatedAt.toISOString(),
                ],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "create.flaskUser",
                error,
              }),
          })
        }).pipe(Effect.asVoid),

      findById: (id) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM flask_users WHERE id = ?",
                args: [id],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "findById.flaskUser",
                error,
              }),
          })

          const row = result.rows[0]
          if (!row) return Option.none()

          const user = yield* decodeFlaskUser(mapRowToFlaskUser(row)).pipe(
            Effect.mapError(
              (error) =>
                new DatabaseError({
                  operation: "decode.flaskUser",
                  error,
                })
            )
          )

          return Option.some(user)
        }),

      findByUsername: (username) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM flask_users WHERE username = ?",
                args: [username],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "findByUsername.flaskUser",
                error,
              }),
          })

          const row = result.rows[0]
          if (!row) return Option.none()

          const user = yield* decodeFlaskUser(mapRowToFlaskUser(row)).pipe(
            Effect.mapError(
              (error) =>
                new DatabaseError({
                  operation: "decode.flaskUser",
                  error,
                })
            )
          )

          return Option.some(user)
        }),

      findByDiscordId: (discordId) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: "SELECT * FROM flask_users WHERE discord_id = ? AND active = 1",
                args: [discordId],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "findByDiscordId.flaskUser",
                error,
              }),
          })

          const row = result.rows[0]
          if (!row) return Option.none()

          const user = yield* decodeFlaskUser(mapRowToFlaskUser(row)).pipe(
            Effect.mapError(
              (error) =>
                new DatabaseError({
                  operation: "decode.flaskUser",
                  error,
                })
            )
          )

          return Option.some(user)
        }),

      update: (user) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              client.execute({
                sql: `UPDATE flask_users
                      SET username = ?, password_hash = ?, discord_id = ?, discord_username = ?, is_admin = ?, active = ?, updated_at = ?
                      WHERE id = ?`,
                args: [
                  user.username,
                  user.passwordHash,
                  Option.getOrNull(user.discordId),
                  Option.getOrNull(user.discordUsername),
                  user.isAdmin ? 1 : 0,
                  user.active ? 1 : 0,
                  user.updatedAt.toISOString(),
                  user.id,
                ],
              }),
            catch: (error) =>
              new DatabaseError({
                operation: "update.flaskUser",
                error,
              }),
          })

          if (result.rowsAffected === 0) {
            return yield* Effect.fail(
              new UserNotFoundError({
                id: user.id as UserId,
              })
            )
          }
        }).pipe(Effect.asVoid),

      delete: (id) =>
        Effect.tryPromise({
          try: () =>
            client.execute({
              sql: "DELETE FROM flask_users WHERE id = ?",
              args: [id],
            }),
          catch: (error) =>
            new DatabaseError({
              operation: "delete.flaskUser",
              error,
            }),
        }).pipe(Effect.asVoid),
    })
  })
)
