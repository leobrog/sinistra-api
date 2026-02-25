import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { CZSummaryQueryParamsSchema, SpaceCZSummaryResponseSchema, GroundCZSummaryResponseSchema } from "./dtos.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"
import { DatabaseError } from "../../domain/errors.js"

export const CZApi = HttpApiGroup.make("cz")
  .add(
    HttpApiEndpoint.get("getSpaceCZSummary", "/api/cz/space-summary")
      .addSuccess(SpaceCZSummaryResponseSchema)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setUrlParams(CZSummaryQueryParamsSchema)
      .middleware(ApiKeyAuth)
  )
  .add(
    HttpApiEndpoint.get("getGroundCZSummary", "/api/cz/ground-summary")
      .addSuccess(GroundCZSummaryResponseSchema)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setUrlParams(CZSummaryQueryParamsSchema)
      .middleware(ApiKeyAuth)
  )
  .prefix("/")
