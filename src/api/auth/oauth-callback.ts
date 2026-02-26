/**
 * Discord OAuth callback middleware.
 *
 * Intercepts GET /api/auth/discord/callback, exchanges the code for Discord
 * user data, creates the user if needed, fetches their guild roles, then
 * sets the `valk_user` cookie (base64-encoded JSON) and redirects to the
 * frontend — mirroring Flask's discord_auth.py behaviour.
 *
 * Runs outside HttpApiBuilder so we can return a raw redirect response.
 */

import { Effect, Option } from "effect"
import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import type { HttpApp } from "@effect/platform"
import { AppConfig } from "../../lib/config.js"
import { FlaskUserRepository } from "../../domain/repositories.js"
import { FlaskUser } from "../../domain/models.js"
import type { UserId, HashedPassword } from "../../domain/ids.js"
import { exchangeOAuthCode, getUserRoles } from "../../services/discord.js"

export const oauthCallbackMiddleware = (
  app: HttpApp.Default
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  never,
  HttpServerRequest.HttpServerRequest | AppConfig | FlaskUserRepository
> =>
  Effect.gen(function* () {
    const req = yield* HttpServerRequest.HttpServerRequest
    const url = new URL(req.url, "http://placeholder")

    // Initiate Discord OAuth flow
    if (req.method === "GET" && url.pathname === "/api/auth/discord/login") {
      const config = yield* AppConfig
      const authUrl = new URL("https://discord.com/api/oauth2/authorize")
      authUrl.searchParams.set("client_id", config.discord.oauth.clientId)
      authUrl.searchParams.set("redirect_uri", config.discord.oauth.redirectUri)
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("scope", "identify")
      return HttpServerResponse.redirect(authUrl.toString(), { status: 302 })
    }

    // Only intercept the OAuth callback — everything else falls through
    if (req.method !== "GET" || url.pathname !== "/api/auth/discord/callback") {
      return yield* app
    }

    const config = yield* AppConfig
    const frontendUrl = config.server.frontendUrl

    const code = url.searchParams.get("code")
    const oauthError = url.searchParams.get("error")

    if (oauthError || !code) {
      return HttpServerResponse.redirect(`${frontendUrl}/login?error=discord_denied`, {
        status: 302,
      })
    }

    return yield* Effect.gen(function* () {
      const discordUser = yield* exchangeOAuthCode(
        code,
        config.discord.oauth.clientId,
        config.discord.oauth.clientSecret,
        config.discord.oauth.redirectUri
      )

      const flaskUserRepo = yield* FlaskUserRepository
      const existingUser = yield* flaskUserRepo.findByDiscordId(discordUser.id)
      const discordUsername = `${discordUser.username}#${discordUser.discriminator}`

      let flaskUser: FlaskUser

      if (Option.isSome(existingUser)) {
        flaskUser = Option.getOrThrow(existingUser)
      } else {
        const sanitizedUsername = discordUser.username.toLowerCase().replace(/\s+/g, "_")
        const usernameExists = yield* flaskUserRepo.findByUsername(sanitizedUsername)
        const finalUsername = Option.isSome(usernameExists)
          ? `${sanitizedUsername}_${Math.floor(Math.random() * 9000 + 1000)}`
          : sanitizedUsername

        flaskUser = new FlaskUser({
          id: crypto.randomUUID() as UserId,
          username: finalUsername,
          passwordHash: "" as HashedPassword,
          discordId: Option.some(discordUser.id),
          discordUsername: Option.some(discordUsername),
          isAdmin: false,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          cmdrId: Option.none(),
        })

        yield* flaskUserRepo.create(flaskUser)
      }

      // Fetch guild roles; fall back to empty array if bot isn't configured
      const roles = yield* getUserRoles(
        discordUser.id,
        config.discord.bot.serverId,
        config.discord.bot.token
      ).pipe(Effect.orElse(() => Effect.succeed([] as string[])))

      const cookieData = {
        id: flaskUser.id,
        username: flaskUser.username,
        discord_id: discordUser.id,
        discord_username: discordUsername,
        is_admin: flaskUser.isAdmin,
        tenant_name: config.faction.name,
        roles,
      }

      const cookieValue = btoa(JSON.stringify(cookieData))
      const cookieHeader = `valk_user=${cookieValue}; Path=/; Max-Age=604800; SameSite=Lax`

      return HttpServerResponse.setHeader(
        HttpServerResponse.redirect(`${frontendUrl}/`, { status: 302 }),
        "Set-Cookie",
        cookieHeader
      )
    }).pipe(
      Effect.catchAll(() =>
        Effect.succeed(
          HttpServerResponse.redirect(`${frontendUrl}/login?error=server_error`, { status: 302 })
        )
      )
    )
  })
