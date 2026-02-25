import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { Schema } from "effect"
import { SystemEntry } from "./dtos.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"
import { DatabaseError } from "../../domain/errors.js"

export const FactionVisitedSystemsApi = HttpApiGroup.make("factionVisitedSystems")
  .add(
    HttpApiEndpoint.get("getFactionVisitedSystems", "/")
      .addSuccess(Schema.Array(SystemEntry))
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Faction Visited Systems")
      .annotate(
        OpenApi.Description,
        "Returns all systems visited via FSDJump in the last 24 hours, with faction data from the most recent jump per system."
      )
  )
  .prefix("/api/faction-visited-systems")
