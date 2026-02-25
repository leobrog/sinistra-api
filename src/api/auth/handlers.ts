import { Effect, Option } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import { AppConfig } from "../../lib/config.js"
import { FlaskUserRepository, CmdrRepository } from "../../domain/repositories.js"
import { FlaskUser } from "../../domain/models.js"
import { JwtService } from "../../services/jwt.js"
import { UserResponse, LinkCmdrResponse } from "./dtos.js"
import { CmdrNotFoundByDiscordError } from "../cmdr-location/api.js"

/**
 * Auth API handlers
 */
export const AuthApiLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  handlers
    .handle("verifyDiscord", (request) =>
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository
        const jwtService = yield* JwtService
        const config = yield* AppConfig

        const { discord_id, discord_username } = request.payload

    // Check if user exists with this Discord ID
    const existingUser = yield* flaskUserRepo.findByDiscordId(discord_id)

    if (Option.isSome(existingUser)) {
      const user: FlaskUser = Option.getOrThrow(existingUser)

      // Generate JWT token for existing user
      const token = yield* jwtService.sign({
        userId: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        tenantName: config.faction.name,
      })

      return new UserResponse({
        id: user.id,
        username: user.username,
        discord_id,
        discord_username,
        is_admin: user.isAdmin,
        tenant_name: config.faction.name,
        account_status: "existing",
        token,
      })
    }

    // User doesn't exist - generate a sanitized username from Discord username
    const sanitizedUsername = (discord_username.split("#")[0] || discord_username).toLowerCase().replace(/\s+/g, "_")

    // Check if username is available
    const usernameExists = yield* flaskUserRepo.findByUsername(sanitizedUsername)
    const finalUsername = Option.isSome(usernameExists)
      ? `${sanitizedUsername}_${Math.floor(Math.random() * 9000 + 1000)}`
      : sanitizedUsername

    // Return placeholder details (don't create account yet)
    return new UserResponse({
      id: undefined, // No account created yet
      username: finalUsername,
      discord_id,
      discord_username,
      is_admin: false,
      tenant_name: config.faction.name,
      account_status: "new",
      token: undefined, // No token for new users
    })
      })
    )
    .handle("linkCmdr", (request) =>
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository
        const cmdrRepo = yield* CmdrRepository

        const { discord_id, cmdr_name } = request.payload

        const userOpt = yield* flaskUserRepo.findByDiscordId(discord_id)
        if (Option.isNone(userOpt)) {
          return yield* Effect.fail(
            new CmdrNotFoundByDiscordError({ message: `User not found for discord_id: ${discord_id}` })
          )
        }
        const user = userOpt.value

        const cmdrOpt = yield* cmdrRepo.findByName(cmdr_name)
        if (Option.isNone(cmdrOpt)) {
          return yield* Effect.fail(
            new CmdrNotFoundByDiscordError({ message: `Cmdr '${cmdr_name}' not found` })
          )
        }
        const cmdr = cmdrOpt.value

        yield* flaskUserRepo.update(
          new FlaskUser({ ...user, cmdrId: Option.some(cmdr.id), updatedAt: new Date() })
        )

        return new LinkCmdrResponse({
          message: `Cmdr ${cmdr_name} linked to user ${user.username}`,
          status: "linked",
          cmdr_name,
          username: user.username,
        })
      })
    )
)
