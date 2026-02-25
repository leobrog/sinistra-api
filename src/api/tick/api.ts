import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

export const TickResponse = Schema.Struct({
  lastGalaxyTick: Schema.String,
})

export const TickNotFoundError = Schema.TaggedError<TickNotFoundError>()(
  "TickNotFoundError",
  { message: Schema.String }
)
export type TickNotFoundError = typeof TickNotFoundError.Type

export const TickApi = HttpApiGroup.make("tick")
  .add(
    HttpApiEndpoint.get("getTick", "/api/tick")
      .addSuccess(TickResponse)
      .addError(TickNotFoundError, { status: 502 })
  )
  .prefix("/")
