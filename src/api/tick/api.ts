import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"

export const TickResponse = Schema.Struct({
  lastGalaxyTick: Schema.String,
})

export const TickNotFoundError = Schema.TaggedError<TickNotFoundError>()(
  "TickNotFoundError",
  { message: Schema.String }
)
export type TickNotFoundError = typeof TickNotFoundError.Type

export const ForceTickRequest = Schema.Struct({
  ticktime: Schema.String,
})

export const ForceTickResponse = Schema.Struct({
  status: Schema.String,
  ticktime: Schema.String,
})

export const TickApi = HttpApiGroup.make("tick")
  .add(
    HttpApiEndpoint.get("getTick", "/api/tick")
      .addSuccess(TickResponse)
      .addError(TickNotFoundError, { status: 502 })
  )
  .add(
    HttpApiEndpoint.post("forceTick", "/api/tick/force")
      .setPayload(ForceTickRequest)
      .addSuccess(ForceTickResponse)
      .addError(ApiKeyError, { status: 401 })
      .middleware(ApiKeyAuth)
  )
  .prefix("/")
