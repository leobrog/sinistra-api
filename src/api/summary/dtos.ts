import { Schema } from "effect";
import { DateFilterPeriodSchema } from "../../services/date-filters.js";

/**
 * Summary query keys supported by the system.
 * These correspond to predefined SQL queries for various event aggregations.
 */
export const SummaryKeySchema = Schema.Literal(
  "market-events",
  "missions-completed",
  "missions-failed",
  "bounty-vouchers",
  "combat-bonds",
  "influence-by-faction",
  "influence-eic",
  "exploration-sales",
  "bounty-fines",
  "murder-count"
);

export type SummaryKey = typeof SummaryKeySchema.Type;

/**
 * Request query parameters for summary endpoints
 */
export const SummaryQueryParamsSchema = Schema.Struct({
  /** Period filter (e.g., "ct", "lt", "cw", "cm", etc.) */
  period: Schema.optional(DateFilterPeriodSchema).pipe(Schema.withDefault(() => undefined as const)),
  /** Custom start date (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ) */
  start_date: Schema.optional(Schema.String),
  /** Custom end date (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ) */
  end_date: Schema.optional(Schema.String),
  /** Optional system name filter */
  system_name: Schema.optional(Schema.String),
});

export type SummaryQueryParams = typeof SummaryQueryParamsSchema.Type;

/**
 * Path parameters for summary/:key endpoints
 */
export const SummaryKeyPathSchema = Schema.Struct({
  key: SummaryKeySchema,
});

export type SummaryKeyPath = typeof SummaryKeyPathSchema.Type;

/**
 * Market events summary result row
 */
export const MarketEventsSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  total_buy: Schema.Number,
  total_sell: Schema.Number,
  total_transaction_volume: Schema.Number,
  total_trade_quantity: Schema.Number,
});

/**
 * Missions completed summary result row
 */
export const MissionsCompletedSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  missions_completed: Schema.Number,
});

/**
 * Missions failed summary result row
 */
export const MissionsFailedSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  missions_failed: Schema.Number,
});

/**
 * Bounty vouchers summary result row
 */
export const BountyVouchersSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  starsystem: Schema.String,
  faction: Schema.String,
  bounty_vouchers: Schema.Number,
});

/**
 * Combat bonds summary result row
 */
export const CombatBondsSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  starsystem: Schema.String,
  faction: Schema.String,
  combat_bonds: Schema.Number,
});

/**
 * Influence by faction summary result row
 */
export const InfluenceByFactionSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  faction_name: Schema.String,
  influence: Schema.Number,
});

/**
 * Exploration sales summary result row
 */
export const ExplorationSalesSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  total_exploration_sales: Schema.Number,
});

/**
 * Bounty fines summary result row
 */
export const BountyFinesSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  bounty_fines: Schema.Number,
});

/**
 * Murder count summary result row
 */
export const MurderCountSummarySchema = Schema.Struct({
  cmdr: Schema.String,
  starsystem: Schema.String,
  faction: Schema.String,
  murder_count: Schema.Number,
});

/**
 * Generic summary response (array of rows)
 * The actual shape depends on the query key
 */
export const SummaryResponseSchema = Schema.Array(Schema.Unknown);

export type SummaryResponse = typeof SummaryResponseSchema.Type;

/**
 * Leaderboard query parameters
 */
export const LeaderboardQueryParamsSchema = Schema.Struct({
  /** Period filter (e.g., "ct", "lt", "cw", "cm", etc.) */
  period: Schema.optional(DateFilterPeriodSchema).pipe(Schema.withDefault(() => undefined as const)),
  /** Optional system name filter */
  system_name: Schema.optional(Schema.String),
});

export type LeaderboardQueryParams = typeof LeaderboardQueryParamsSchema.Type;

/**
 * Leaderboard row
 */
export const LeaderboardRowSchema = Schema.Struct({
  cmdr: Schema.String,
  rank: Schema.NullOr(Schema.String),
  total_buy: Schema.Number,
  total_sell: Schema.Number,
  profit: Schema.Number,
  profitability: Schema.Number,
  total_quantity: Schema.Number,
  total_volume: Schema.Number,
  missions_completed: Schema.Number,
  missions_failed: Schema.Number,
  bounty_vouchers: Schema.NullOr(Schema.Number),
  combat_bonds: Schema.NullOr(Schema.Number),
  exploration_sales: Schema.NullOr(Schema.Number),
  influence_eic: Schema.NullOr(Schema.Number),
  bounty_fines: Schema.NullOr(Schema.Number),
});

export type LeaderboardRow = typeof LeaderboardRowSchema.Type;

export const LeaderboardResponseSchema = Schema.Array(LeaderboardRowSchema);

export type LeaderboardResponse = typeof LeaderboardResponseSchema.Type;

/**
 * Recruit summary row
 */
export const RecruitRowSchema = Schema.Struct({
  commander: Schema.String,
  has_data: Schema.String,
  last_active: Schema.NullOr(Schema.String),
  days_since_join: Schema.NullOr(Schema.Number),
  tonnage: Schema.Number,
  mission_count: Schema.Number,
  bounty_claims: Schema.NullOr(Schema.Number),
  exp_value: Schema.NullOr(Schema.Number),
  combat_bonds: Schema.NullOr(Schema.Number),
  bounty_fines: Schema.NullOr(Schema.Number),
});

export type RecruitRow = typeof RecruitRowSchema.Type;

export const RecruitsResponseSchema = Schema.Array(RecruitRowSchema);

export type RecruitsResponse = typeof RecruitsResponseSchema.Type;
