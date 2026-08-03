import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

export const TickResponse = Schema.Struct({
  lastGalaxyTick: Schema.String,
})

export class TickNotFoundError extends Schema.TaggedError<TickNotFoundError>()(
  "TickNotFoundError",
  { message: Schema.String }
) {}

export const TickApi = HttpApiGroup.make("tick")
  .add(
    HttpApiEndpoint.get("getTick", "/api/tick")
      .addSuccess(TickResponse)
      .addError(TickNotFoundError, { status: 502 })
  )
  .prefix("/")
