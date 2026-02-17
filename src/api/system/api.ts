import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { Schema } from "effect"
import {
  SystemSummaryQuery,
  SystemDetailResponse,
  SystemListResponse,
  SystemSearchErrorResponse,
} from "./dtos.js"

// Union type for response (can be single system, list, or error)
const SystemSummaryResponse = Schema.Union(SystemDetailResponse, SystemListResponse, SystemSearchErrorResponse)

export const SystemApi = HttpApiGroup.make("system")
  .add(
    HttpApiEndpoint.get("getSystemSummary", "/:systemName")
      .addSuccess(SystemSummaryResponse)
      .setPath(Schema.Struct({ systemName: Schema.optionalWith(Schema.String, { nullable: true }) }))
      .setUrlParams(SystemSummaryQuery)
      .annotate(OpenApi.Title, "Get System Summary")
      .annotate(
        OpenApi.Description,
        `Queries EDDN system data with optional filters.

Supports the following query parameters:
- system_name: Search by system name (partial match)
- faction: All systems where this faction is present
- controlling_faction: All systems controlled by this faction
- controlling_power: All systems influenced by this power
- power: All systems influenced by this power (from system_info or powerplay)
- state: All systems with a faction in this state
- government: All systems with a faction of this government type
- state_government: Format "state:government" - systems with factions of that government in that state
- recovering_state: All systems with a faction in this recovering state
- pending_state: All systems with a faction in this pending state
- has_conflict: "true"/"1"/"yes" - all systems with at least one conflict
- population: Exact, range (min-max), or comparison (<val, >val)
- powerplay_state: All systems with this powerplay state
- cf_in_conflict: "true"/"1"/"yes" - systems controlled by controlling_faction with a conflict (requires controlling_faction)

Returns up to 400 systems. Use filters to narrow results.`
      )
  )
  .add(
    HttpApiEndpoint.get("getSystemSummaryNoParam", "/")
      .addSuccess(SystemSummaryResponse)
      .setUrlParams(SystemSummaryQuery)
      .annotate(OpenApi.Title, "Search Systems")
      .annotate(OpenApi.Description, "Search systems using query parameters. Same as getSystemSummary but without path parameter.")
  )
  .prefix("/api/system-summary")
  .annotateEndpoints(OpenApi.Security, "apiKey")
