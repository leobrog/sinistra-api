import { Schema } from "effect"

// Query parameter schema for system search
export class SystemSummaryQuery extends Schema.Class<SystemSummaryQuery>("SystemSummaryQuery")({
  system_name: Schema.optional(Schema.String),
  faction: Schema.optional(Schema.String),
  controlling_faction: Schema.optional(Schema.String),
  controlling_power: Schema.optional(Schema.String),
  power: Schema.optional(Schema.String),
  state: Schema.optional(Schema.String),
  state_government: Schema.optional(Schema.String), // Format: "state:government"
  government: Schema.optional(Schema.String),
  recovering_state: Schema.optional(Schema.String),
  pending_state: Schema.optional(Schema.String),
  has_conflict: Schema.optional(Schema.String), // "true", "1", "yes"
  population: Schema.optional(Schema.String), // Exact, range (min-max), or comparison (<val, >val)
  powerplay_state: Schema.optional(Schema.String),
  cf_in_conflict: Schema.optional(Schema.String), // "true", "1", "yes"
}) {}

// System info from EDDN
export class EddnSystemInfo extends Schema.Class<EddnSystemInfo>("EddnSystemInfo")({
  id: Schema.String,
  system_name: Schema.String,
  system_address: Schema.optionalWith(Schema.Number, { nullable: true }),
  controlling_faction: Schema.optionalWith(Schema.String, { nullable: true }),
  controlling_power: Schema.optionalWith(Schema.String, { nullable: true }),
  population: Schema.optionalWith(Schema.Number, { nullable: true }),
  allegiance: Schema.optionalWith(Schema.String, { nullable: true }),
  government: Schema.optionalWith(Schema.String, { nullable: true }),
  security: Schema.optionalWith(Schema.String, { nullable: true }),
  economy: Schema.optionalWith(Schema.String, { nullable: true }),
  second_economy: Schema.optionalWith(Schema.String, { nullable: true }),
  timestamp: Schema.optionalWith(Schema.String, { nullable: true }),
}) {}

// Faction from EDDN
export class EddnFaction extends Schema.Class<EddnFaction>("EddnFaction")({
  id: Schema.String,
  system_name: Schema.String,
  name: Schema.String,
  allegiance: Schema.optionalWith(Schema.String, { nullable: true }),
  government: Schema.optionalWith(Schema.String, { nullable: true }),
  influence: Schema.optionalWith(Schema.Number, { nullable: true }),
  state: Schema.optionalWith(Schema.String, { nullable: true }),
  happiness: Schema.optionalWith(Schema.String, { nullable: true }),
  active_states: Schema.optionalWith(Schema.String, { nullable: true }), // JSON array as string
  pending_states: Schema.optionalWith(Schema.String, { nullable: true }), // JSON array as string
  recovering_states: Schema.optionalWith(Schema.String, { nullable: true }), // JSON array as string
  timestamp: Schema.optionalWith(Schema.String, { nullable: true }),
}) {}

// Conflict from EDDN
export class EddnConflict extends Schema.Class<EddnConflict>("EddnConflict")({
  id: Schema.String,
  system_name: Schema.String,
  war_type: Schema.optionalWith(Schema.String, { nullable: true }),
  status: Schema.optionalWith(Schema.String, { nullable: true }),
  faction1: Schema.optionalWith(Schema.String, { nullable: true }),
  faction1_stake: Schema.optionalWith(Schema.String, { nullable: true }),
  faction1_days_won: Schema.optionalWith(Schema.Number, { nullable: true }),
  faction2: Schema.optionalWith(Schema.String, { nullable: true }),
  faction2_stake: Schema.optionalWith(Schema.String, { nullable: true }),
  faction2_days_won: Schema.optionalWith(Schema.Number, { nullable: true }),
  timestamp: Schema.optionalWith(Schema.String, { nullable: true }),
}) {}

// Powerplay from EDDN
export class EddnPowerplay extends Schema.Class<EddnPowerplay>("EddnPowerplay")({
  id: Schema.String,
  system_name: Schema.String,
  power: Schema.optionalWith(Schema.String, { nullable: true }), // JSON array as string
  powerplay_state: Schema.optionalWith(Schema.String, { nullable: true }),
  timestamp: Schema.optionalWith(Schema.String, { nullable: true }),
}) {}

// Single system detail response
export class SystemDetailResponse extends Schema.Class<SystemDetailResponse>("SystemDetailResponse")({
  system_info: EddnSystemInfo,
  conflicts: Schema.Array(EddnConflict),
  factions: Schema.Array(EddnFaction),
  powerplays: Schema.Array(EddnPowerplay),
}) {}

// Multi-system list response (when filters are used)
export class SystemListResponse extends Schema.Class<SystemListResponse>("SystemListResponse")({
  systems: Schema.Array(SystemDetailResponse),
  count: Schema.Number,
}) {}

// Error response for too many results
export class SystemSearchErrorResponse extends Schema.Class<SystemSearchErrorResponse>("SystemSearchErrorResponse")({
  error: Schema.String,
  count: Schema.Number,
  systems: Schema.Array(Schema.String), // Just system names
}) {}
