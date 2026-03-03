import { Schema } from "effect"
import { Activity } from "../../domain/models.ts"

/**
 * DTOs for Activities API
 *
 * Activities track commander BGS (Background Simulation) actions
 * organized by tick, with nested systems and factions.
 */

// --- Shared sub-schemas ---

const CZLevelsInput = Schema.Struct({
  low: Schema.optional(Schema.NullOr(Schema.Int)),
  medium: Schema.optional(Schema.NullOr(Schema.Int)),
  high: Schema.optional(Schema.NullOr(Schema.Int)),
})

const SumCountInput = Schema.Struct({
  sum: Schema.Int,
  count: Schema.Int,
})

const LMHInput = Schema.Struct({
  low: Schema.optional(Schema.NullOr(SumCountInput)),
  medium: Schema.optional(Schema.NullOr(SumCountInput)),
  high: Schema.optional(Schema.NullOr(SumCountInput)),
})

const TradeBracketInput = Schema.Struct({
  items: Schema.optional(Schema.NullOr(Schema.Int)),
  value: Schema.optional(Schema.NullOr(Schema.Int)),
  profit: Schema.optional(Schema.NullOr(Schema.Int)),
})

const TradeInput = Schema.Struct({
  high: Schema.optional(Schema.NullOr(TradeBracketInput)),
  low: Schema.optional(Schema.NullOr(TradeBracketInput)),
  zero: Schema.optional(Schema.NullOr(TradeBracketInput)),
})

const SandRInput = Schema.Struct({
  blackboxes: Schema.optional(Schema.NullOr(Schema.Int)),
  damagedpods: Schema.optional(Schema.NullOr(Schema.Int)),
  occupiedpods: Schema.optional(Schema.NullOr(Schema.Int)),
  thargoidpods: Schema.optional(Schema.NullOr(Schema.Int)),
  wreckagecomponents: Schema.optional(Schema.NullOr(Schema.Int)),
  personaleffects: Schema.optional(Schema.NullOr(Schema.Int)),
  politicalprisoners: Schema.optional(Schema.NullOr(Schema.Int)),
  hostages: Schema.optional(Schema.NullOr(Schema.Int)),
})

const SettlementInput = Schema.Struct({
  name: Schema.String,
  type: Schema.optional(Schema.String),
  count: Schema.Int,
})

const TWMassacreInput = Schema.Struct({
  cyclops: Schema.optional(Schema.NullOr(SumCountInput)),
  basilisk: Schema.optional(Schema.NullOr(SumCountInput)),
  medusa: Schema.optional(Schema.NullOr(SumCountInput)),
  hydra: Schema.optional(Schema.NullOr(SumCountInput)),
  orthrus: Schema.optional(Schema.NullOr(SumCountInput)),
  scout: Schema.optional(Schema.NullOr(SumCountInput)),
})

const StationInput = Schema.Struct({
  name: Schema.String,
  twreactivate: Schema.optional(Schema.NullOr(Schema.Int)),
  twcargo: Schema.optional(Schema.NullOr(SumCountInput)),
  twescapepods: Schema.optional(Schema.NullOr(LMHInput)),
  twpassengers: Schema.optional(Schema.NullOr(LMHInput)),
  twmassacre: Schema.optional(Schema.NullOr(TWMassacreInput)),
})

const TWKillsInput = Schema.Struct({
  cyclops: Schema.optional(Schema.NullOr(Schema.Int)),
  basilisk: Schema.optional(Schema.NullOr(Schema.Int)),
  medusa: Schema.optional(Schema.NullOr(Schema.Int)),
  hydra: Schema.optional(Schema.NullOr(Schema.Int)),
  orthrus: Schema.optional(Schema.NullOr(Schema.Int)),
  scout: Schema.optional(Schema.NullOr(Schema.Int)),
  revenant: Schema.optional(Schema.NullOr(Schema.Int)),
  banshee: Schema.optional(Schema.NullOr(Schema.Int)),
  "scythe-glaive": Schema.optional(Schema.NullOr(Schema.Int)),
})

const TWSandRInput = Schema.Struct({
  blackboxes: Schema.optional(Schema.NullOr(Schema.Int)),
  damagedpods: Schema.optional(Schema.NullOr(Schema.Int)),
  occupiedpods: Schema.optional(Schema.NullOr(Schema.Int)),
  tissuesamples: Schema.optional(Schema.NullOr(Schema.Int)),
  thargoidpods: Schema.optional(Schema.NullOr(Schema.Int)),
})

// --- Faction DTO for PUT request ---

export const FactionInputSchema = Schema.Struct({
  name: Schema.String,
  state: Schema.String,
  bvs: Schema.optional(Schema.NullOr(Schema.Int)),
  cbs: Schema.optional(Schema.NullOr(Schema.Int)),
  exobiology: Schema.optional(Schema.NullOr(Schema.Int)),
  exploration: Schema.optional(Schema.NullOr(Schema.Int)),
  scenarios: Schema.optional(Schema.NullOr(Schema.Int)),
  infprimary: Schema.optional(Schema.NullOr(Schema.Union(Schema.Int, Schema.NumberFromString))),
  infsecondary: Schema.optional(Schema.NullOr(Schema.Union(Schema.Int, Schema.NumberFromString))),
  missionfails: Schema.optional(Schema.NullOr(Schema.Int)),
  murdersground: Schema.optional(Schema.NullOr(Schema.Int)),
  murdersspace: Schema.optional(Schema.NullOr(Schema.Int)),
  tradebm: Schema.optional(Schema.NullOr(Schema.Int)),
  czspace: Schema.optional(Schema.NullOr(CZLevelsInput)),
  czground: Schema.optional(Schema.NullOr(Schema.Struct({
    low: Schema.optional(Schema.NullOr(Schema.Int)),
    medium: Schema.optional(Schema.NullOr(Schema.Int)),
    high: Schema.optional(Schema.NullOr(Schema.Int)),
    settlements: Schema.optional(Schema.NullOr(Schema.Array(SettlementInput))),
  }))),
  sandr: Schema.optional(Schema.NullOr(SandRInput)),
  tradebuy: Schema.optional(Schema.NullOr(TradeInput)),
  tradesell: Schema.optional(Schema.NullOr(TradeInput)),
  stations: Schema.optional(Schema.NullOr(Schema.Array(StationInput))),
})

export type FactionInput = typeof FactionInputSchema.Type

// --- System DTO for PUT request ---

export const SystemInputSchema = Schema.Struct({
  name: Schema.String,
  address: Schema.Number,
  factions: Schema.Array(FactionInputSchema),
  twkills: Schema.optional(Schema.NullOr(TWKillsInput)),
  twsandr: Schema.optional(Schema.NullOr(TWSandRInput)),
  twreactivate: Schema.optional(Schema.NullOr(Schema.Int)),
})

export type SystemInput = typeof SystemInputSchema.Type

// --- Activity PUT request schema ---

export const PutActivityRequest = Schema.Struct({
  tickid: Schema.String,
  ticktime: Schema.String,
  timestamp: Schema.String,
  cmdr: Schema.optional(Schema.String),
  systems: Schema.Array(SystemInputSchema),
})

export type PutActivityRequest = typeof PutActivityRequest.Type

// --- Activity PUT response ---

export const PutActivityResponse = Schema.Struct({
  status: Schema.Literal("activity saved"),
})

export type PutActivityResponse = typeof PutActivityResponse.Type

// --- GET activities query parameters ---

export const GetActivitiesQuery = Schema.Struct({
  period: Schema.optional(Schema.String), // ct|lt|current|last|<tickid>
  cmdr: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  faction: Schema.optional(Schema.String),
})

export type GetActivitiesQuery = typeof GetActivitiesQuery.Type

// GET activities response is an array of Activity domain models
export const GetActivitiesResponse = Schema.Array(Activity)
export type GetActivitiesResponse = typeof GetActivitiesResponse.Type
