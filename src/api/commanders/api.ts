import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import * as Dtos from "./dtos.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"
import { DatabaseError } from "../../domain/errors.js"

export const CommandersApi = HttpApiGroup.make("commanders")
  .add(
    HttpApiEndpoint.post("syncCmdrs", "/api/sync/cmdrs")
      .addSuccess(Dtos.SyncCmdrsResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .addError(Dtos.SyncCmdrsError, { status: 500 })
      .setUrlParams(
        Schema.Struct({
          inara: Schema.optional(Schema.String),
        })
      )
      .middleware(ApiKeyAuth)
  )
  .prefix("/")
