import { HttpApiGroup, HttpApiEndpoint, OpenApi } from "@effect/platform";
import {
  SummaryKeyPathSchema,
  SummaryQueryParamsSchema,
  SummaryResponseSchema,
  LeaderboardQueryParamsSchema,
  LeaderboardResponseSchema,
  RecruitsResponseSchema,
} from "./dtos.ts";
import { DatabaseError } from "../../domain/errors.ts";
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.ts";

/**
 * Summary API Group
 *
 * Provides aggregated statistics and leaderboards for Elite Dangerous events.
 * Supports date/tick filtering via query parameters.
 */
export const SummaryApi = HttpApiGroup.make("summary")
  // GET /api/summary/:key - Get summary statistics for a specific query type
  .add(
    HttpApiEndpoint.get("getSummary", "/api/summary/:key")
      .addSuccess(SummaryResponseSchema)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setPath(SummaryKeyPathSchema)
      .setUrlParams(SummaryQueryParamsSchema)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Summary Statistics")
      .annotate(
        OpenApi.Description,
        "Query aggregated event statistics by key (market-events, missions-completed, etc.) with optional date/tick filters."
      )
  )
  // GET /api/summary/top5/:key - Get top 5 results for a specific query type
  .add(
    HttpApiEndpoint.get("getSummaryTop5", "/api/summary/top5/:key")
      .addSuccess(SummaryResponseSchema)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setPath(SummaryKeyPathSchema)
      .setUrlParams(SummaryQueryParamsSchema)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Top 5 Summary Statistics")
      .annotate(
        OpenApi.Description,
        "Query aggregated event statistics with results limited to top 5 entries."
      )
  )
  // GET /api/summary/leaderboard - Get comprehensive commander leaderboard
  .add(
    HttpApiEndpoint.get("getLeaderboard", "/api/summary/leaderboard")
      .addSuccess(LeaderboardResponseSchema)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setUrlParams(LeaderboardQueryParamsSchema)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Commander Leaderboard")
      .annotate(
        OpenApi.Description,
        "Retrieve comprehensive statistics for all commanders including trading, missions, combat, exploration, and influence."
      )
  )
  // GET /api/summary/recruits - Get recruit statistics
  .add(
    HttpApiEndpoint.get("getRecruits", "/api/summary/recruits")
      .addSuccess(RecruitsResponseSchema)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Recruit Statistics")
      .annotate(
        OpenApi.Description,
        "Retrieve statistics for commanders with squadron rank 'Recruit', showing their activity and progression."
      )
  )
  .prefix("/");
