import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { DiscordVerifyRequest, DiscordOAuthCallbackQuery, UserResponse } from "./dtos.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"
import { DatabaseError, UserAlreadyExistsError, UserNotFoundError } from "../../domain/errors.js"
import { JwtError } from "../../services/jwt.js"
import { DiscordOAuthError } from "../../services/discord.js"

export const AuthApi = HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("verifyDiscord", "/api/verify_discord")
      .addSuccess(UserResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .addError(JwtError, { status: 500 })
      .setPayload(DiscordVerifyRequest)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Verify Discord User")
      .annotate(
        OpenApi.Description,
        `Verify a Discord user and check if they have an account in the database.

If the user exists, returns their details including admin status and JWT token.
If not, returns a placeholder with suggested username for account creation.

This endpoint requires API key authentication.`
      )
  )
  .add(
    HttpApiEndpoint.get("discordOAuthCallback", "/api/auth/discord/callback")
      .addSuccess(UserResponse)
      .addError(DatabaseError, { status: 500 })
      .addError(JwtError, { status: 500 })
      .addError(UserAlreadyExistsError, { status: 409 })
      .addError(UserNotFoundError, { status: 404 })
      .addError(DiscordOAuthError, { status: 500 })
      .setUrlParams(DiscordOAuthCallbackQuery)
      .annotate(OpenApi.Title, "Discord OAuth Callback")
      .annotate(
        OpenApi.Description,
        `OAuth callback endpoint for Discord authentication.

Exchanges the authorization code for Discord user data and creates or updates the user account.
Returns user details with JWT token for session authentication.

This endpoint is called by Discord after user authorization.`
      )
  )
  .prefix("/")
