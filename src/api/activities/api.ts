import { HttpApiGroup, HttpApiEndpoint, HttpApiSchema } from "@effect/platform"
import { PutActivityRequest, PutActivityResponse, GetActivitiesResponse } from "./dtos.ts"
import { DatabaseError } from "../../domain/errors.ts"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.ts"

/**
 * Activities API Group
 *
 * Handles BGS activity tracking per tick with nested systems and factions.
 */
export const ActivitiesApi = HttpApiGroup.make("activities")
  // PUT /activities - Upsert activity
  .add(
    HttpApiEndpoint.put("putActivity", "/activities")
      .addSuccess(PutActivityResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 400 })
      .setPayload(PutActivityRequest)
      .middleware(ApiKeyAuth)
  )
  // GET /api/activities - Query activities with filters
  .add(
    HttpApiEndpoint.get("getActivities", "/api/activities")
      .addSuccess(GetActivitiesResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
  )
  .prefix("/")
