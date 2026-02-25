import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { DiscordVerifyRequest, UserResponse, LinkCmdrRequest, LinkCmdrResponse } from "./dtos.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"
import { DatabaseError } from "../../domain/errors.js"
import { JwtError } from "../../services/jwt.js"
import { CmdrNotFoundByDiscordError } from "../cmdr-location/api.js"

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
    HttpApiEndpoint.post("linkCmdr", "/api/link_cmdr")
      .addSuccess(LinkCmdrResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(CmdrNotFoundByDiscordError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPayload(LinkCmdrRequest)
      .middleware(ApiKeyAuth)
  )
  .prefix("/")
