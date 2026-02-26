import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import { DatabaseError } from "../../domain/errors.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"

export const CmdrLocationResponse = Schema.Struct({
  cmdr_name: Schema.String,
  current_system: Schema.NullOr(Schema.String),
  timestamp: Schema.NullOr(Schema.String),
})

export const CmdrNotFoundByDiscordError = Schema.TaggedError<CmdrNotFoundByDiscordError>()(
  "CmdrNotFoundByDiscordError",
  { message: Schema.String }
)
export type CmdrNotFoundByDiscordError = typeof CmdrNotFoundByDiscordError.Type

export const CmdrLocationApi = HttpApiGroup.make("cmdrLocation")
  .add(
    HttpApiEndpoint.get("getCmdrSystem", "/api/cmdr_system")
      .addSuccess(CmdrLocationResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(CmdrNotFoundByDiscordError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setUrlParams(
        Schema.Struct({
          discord_id: Schema.String,
        })
      )
      .middleware(ApiKeyAuth)
  )
  .prefix("/")
