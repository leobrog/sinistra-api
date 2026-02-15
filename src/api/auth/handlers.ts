import { Effect, Option } from "effect"
import { HttpApiSchema } from "effect"
import { AppConfig } from "../../lib/config"
import { FlaskUserRepository } from "../../domain/repositories"
import { JwtService } from "../../services/jwt"
import { exchangeOAuthCode } from "../../services/discord"
import { FlaskUser } from "../../domain/models"
import { UserId } from "../../domain/ids"
import type { DiscordVerifyRequest, DiscordOAuthCallbackQuery } from "./dtos"
import { UserResponse } from "./dtos"

/**
 * Handle POST /api/verify_discord
 * Verify a Discord user and check if they have an account.
 * If they do, return their details with JWT token.
 * If not, return placeholder details for account creation.
 */
export const handleVerifyDiscord = (request: DiscordVerifyRequest) =>
  Effect.gen(function* () {
    const flaskUserRepo = yield* FlaskUserRepository
    const jwtService = yield* JwtService
    const config = yield* AppConfig

    const { discord_id, discord_username } = request

    // Check if user exists with this Discord ID
    const existingUser = yield* flaskUserRepo.findByDiscordId(discord_id)

    if (Option.isSome(existingUser)) {
      const user = Option.getOrThrow(existingUser)

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
    const sanitizedUsername = discord_username.split("#")[0].toLowerCase().replace(/\s+/g, "_")

    // Check if username is available
    const usernameExists = yield* flaskUserRepo.findByUsername(sanitizedUsername)
    const finalUsername = Option.isSome(usernameExists)
      ? `${sanitizedUsername}_${Math.floor(Math.random() * 9000 + 1000)}`
      : sanitizedUsername

    // Return placeholder details (don't create account yet)
    return new UserResponse({
      id: null,
      username: finalUsername,
      discord_id,
      discord_username,
      is_admin: false,
      tenant_name: config.faction.name,
      account_status: "new",
      token: null,
    })
  })

/**
 * Handle GET /api/auth/discord/callback
 * OAuth callback that exchanges authorization code for Discord user data
 * and creates or updates the user account.
 */
export const handleDiscordOAuthCallback = (query: DiscordOAuthCallbackQuery) =>
  Effect.gen(function* () {
    const config = yield* AppConfig
    const flaskUserRepo = yield* FlaskUserRepository
    const jwtService = yield* JwtService

    // Exchange OAuth code for Discord user data
    const discordUser = yield* exchangeOAuthCode(
      query.code,
      config.discord.oauth.clientId,
      config.discord.oauth.clientSecret,
      config.discord.oauth.redirectUri
    )

    // Check if user already exists
    const existingUser = yield* flaskUserRepo.findByDiscordId(discordUser.id)

    let flaskUser: FlaskUser

    if (Option.isSome(existingUser)) {
      // Update existing user's Discord username if changed
      flaskUser = Option.getOrThrow(existingUser)
      const discordUsername = `${discordUser.username}#${discordUser.discriminator}`

      if (Option.getOrElse(flaskUser.discordUsername, () => "") !== discordUsername) {
        const updatedUser = new FlaskUser({
          ...flaskUser,
          discordUsername: Option.some(discordUsername),
          updatedAt: new Date(),
        })
        yield* flaskUserRepo.update(updatedUser)
        flaskUser = updatedUser
      }
    } else {
      // Create new user account
      const sanitizedUsername = discordUser.username.toLowerCase().replace(/\s+/g, "_")

      // Check if username exists and add random suffix if needed
      const usernameExists = yield* flaskUserRepo.findByUsername(sanitizedUsername)
      const finalUsername = Option.isSome(usernameExists)
        ? `${sanitizedUsername}_${Math.floor(Math.random() * 9000 + 1000)}`
        : sanitizedUsername

      const discordUsername = `${discordUser.username}#${discordUser.discriminator}`

      flaskUser = new FlaskUser({
        id: crypto.randomUUID() as UserId,
        username: finalUsername,
        passwordHash: "", // No password for Discord-only users
        discordId: Option.some(discordUser.id),
        discordUsername: Option.some(discordUsername),
        isAdmin: false,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      yield* flaskUserRepo.create(flaskUser)
    }

    // Generate JWT token
    const token = yield* jwtService.sign({
      userId: flaskUser.id,
      username: flaskUser.username,
      isAdmin: flaskUser.isAdmin,
      tenantName: config.faction.name,
    })

    return new UserResponse({
      id: flaskUser.id,
      username: flaskUser.username,
      discord_id: discordUser.id,
      discord_username: `${discordUser.username}#${discordUser.discriminator}`,
      is_admin: flaskUser.isAdmin,
      tenant_name: config.faction.name,
      account_status: "existing",
      token,
    })
  })
