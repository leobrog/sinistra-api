import { Schema } from "effect"

/**
 * Request DTO for POST /events
 *
 * Accepts an array of Elite Dangerous journal events from external clients.
 * Each event is a raw JSON object that will be parsed and stored.
 */

// Base event schema - common fields present in all events
export const EventDataSchema = Schema.Struct({
  // Required fields
  event: Schema.String,
  timestamp: Schema.optional(Schema.String),

  // Tick tracking
  tickid: Schema.optional(Schema.String),
  ticktime: Schema.optional(Schema.String),

  // Commander and location
  Cmdr: Schema.optional(Schema.String),
  StarSystem: Schema.optional(Schema.String),
  SystemAddress: Schema.optional(Schema.Union(Schema.Number, Schema.NumberFromString)),

  // Event-specific fields (all optional, validated later)
  // MarketBuy
  Stock: Schema.optional(Schema.NullOr(Schema.Int)),
  StockBracket: Schema.optional(Schema.NullOr(Schema.Int)),
  TotalCost: Schema.optional(Schema.NullOr(Schema.Int)),
  Count: Schema.optional(Schema.NullOr(Schema.Int)),

  // MarketSell / SellExplorationData / MultiSellExplorationData
  Demand: Schema.optional(Schema.NullOr(Schema.Int)),
  DemandBracket: Schema.optional(Schema.NullOr(Schema.Int)),
  Profit: Schema.optional(Schema.NullOr(Schema.Int)),
  TotalSale: Schema.optional(Schema.NullOr(Schema.Int)),
  StationFaction: Schema.optional(Schema.Unknown),

  // MissionCompleted
  Faction: Schema.optional(Schema.String),
  Name: Schema.optional(Schema.String),
  Reward: Schema.optional(Schema.NullOr(Schema.Int)),
  FactionEffects: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),

  // FactionKillBond
  KillerShip: Schema.optional(Schema.String),
  AwardingFaction: Schema.optional(Schema.String),
  VictimFaction: Schema.optional(Schema.String),

  // MissionFailed
  Fine: Schema.optional(Schema.NullOr(Schema.Int)),

  // MultiSellExplorationData
  TotalEarnings: Schema.optional(Schema.NullOr(Schema.Int)),

  // RedeemVoucher
  Amount: Schema.optional(Schema.NullOr(Schema.Int)),
  Type: Schema.optional(Schema.String),
  Factions: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),

  // FSDJump / Location conflict data
  Conflicts: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),

  // CommitCrime
  CrimeType: Schema.optional(Schema.String),
  Victim: Schema.optional(Schema.String),
  Bounty: Schema.optional(Schema.NullOr(Schema.Int)),

  // SyntheticCZ / SyntheticGroundCZ
  low: Schema.optional(Schema.NullOr(Schema.Int)),
  medium: Schema.optional(Schema.NullOr(Schema.Int)),
  high: Schema.optional(Schema.NullOr(Schema.Int)),
  faction: Schema.optional(Schema.String),
  cmdr: Schema.optional(Schema.String),
  station_faction_name: Schema.optional(Schema.String),
  settlement: Schema.optional(Schema.String),
})

export type EventData = typeof EventDataSchema.Type

/**
 * Request schema: array of events
 */
export const PostEventsRequest = Schema.Array(EventDataSchema)
export type PostEventsRequest = typeof PostEventsRequest.Type

/**
 * Response schema for successful event processing
 */
export const PostEventsResponse = Schema.Struct({
  status: Schema.Literal("success"),
  eventsProcessed: Schema.Int,
})
export type PostEventsResponse = typeof PostEventsResponse.Type
