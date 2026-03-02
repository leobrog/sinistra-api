import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { BinsQueryParams, BinsResponse } from "./dtos.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"
import { DatabaseError } from "../../domain/errors.js"

export const BinsApi = HttpApiGroup.make("bins")
  .add(
    HttpApiEndpoint.get("getBins", "/")
      .addSuccess(BinsResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setUrlParams(BinsQueryParams)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get BGS Bins")
      .annotate(
        OpenApi.Description,
        `Compute BGS bucket details for all active objective factions.

Returns one entry per (system, faction) pair drawn from the objective table.
Each entry shows the current raw value, BGS points earned, next threshold,
and remaining work needed for every tracked bucket (missions, exploration,
bounty, mission-fails, murders), plus a simplified influence-change prediction.

Query parameters:
- period: Date/tick filter (default "ct" = current tick)
- system: Restrict results to one system name`
      )
  )
  .prefix("/api/bins")
