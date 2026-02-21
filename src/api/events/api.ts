import { HttpApiGroup, HttpApiEndpoint } from "@effect/platform"
import { PostEventsRequest, PostEventsResponse } from "./dtos.js"
import { DatabaseError } from "../../domain/errors.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"

/**
 * Events API Group
 *
 * Handles ingestion of Elite Dangerous journal events from external clients.
 */
export const EventsApi = HttpApiGroup.make("events")
  .add(
    HttpApiEndpoint.post("postEvents", "/events")
      .addSuccess(PostEventsResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setPayload(PostEventsRequest)
      .middleware(ApiKeyAuth)
  )
  .prefix("/")
