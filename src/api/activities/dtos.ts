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
  low: Schema.optional(Schema.Int),
  medium: Schema.optional(Schema.Int),
  high: Schema.optional(Schema.Int),
})

const SumCountInput = Schema.Struct({
  sum: Schema.Int,
  count: Schema.Int,
})

const LMHInput = Schema.Struct({
  low: Schema.optional(SumCountInput),
  medium: Schema.optional(SumCountInput),
  high: Schema.optional(SumCountInput),
})

const TradeBracketInput = Schema.Struct({
  items: Schema.optional(Schema.Int),
  value: Schema.optional(Schema.Int),
  profit: Schema.optional(Schema.Int),
})

const TradeInput = Schema.Struct({
  high: Schema.optional(TradeBracketInput),
  low: Schema.optional(TradeBracketInput),
  zero: Schema.optional(TradeBracketInput),
})

const SandRInput = Schema.Struct({
  blackboxes: Schema.optional(Schema.Int),
  damagedpods: Schema.optional(Schema.Int),
  occupiedpods: Schema.optional(Schema.Int),
  thargoidpods: Schema.optional(Schema.Int),
  wreckagecomponents: Schema.optional(Schema.Int),
  personaleffects: Schema.optional(Schema.Int),
  politicalprisoners: Schema.optional(Schema.Int),
  hostages: Schema.optional(Schema.Int),
})

const SettlementInput = Schema.Struct({
  name: Schema.String,
  type: Schema.optional(Schema.String),
  count: Schema.Int,
})

const TWMassacreInput = Schema.Struct({
  cyclops: Schema.optional(SumCountInput),
  basilisk: Schema.optional(SumCountInput),
  medusa: Schema.optional(SumCountInput),
  hydra: Schema.optional(SumCountInput),
  orthrus: Schema.optional(SumCountInput),
  scout: Schema.optional(SumCountInput),
})

const StationInput = Schema.Struct({
  name: Schema.String,
  twreactivate: Schema.optional(Schema.Int),
  twcargo: Schema.optional(SumCountInput),
  twescapepods: Schema.optional(LMHInput),
  twpassengers: Schema.optional(LMHInput),
  twmassacre: Schema.optional(TWMassacreInput),
})

const TWKillsInput = Schema.Struct({
  cyclops: Schema.optional(Schema.Int),
  basilisk: Schema.optional(Schema.Int),
  medusa: Schema.optional(Schema.Int),
  hydra: Schema.optional(Schema.Int),
  orthrus: Schema.optional(Schema.Int),
  scout: Schema.optional(Schema.Int),
  revenant: Schema.optional(Schema.Int),
  banshee: Schema.optional(Schema.Int),
  "scythe-glaive": Schema.optional(Schema.Int),
})

const TWSandRInput = Schema.Struct({
  blackboxes: Schema.optional(Schema.Int),
  damagedpods: Schema.optional(Schema.Int),
  occupiedpods: Schema.optional(Schema.Int),
  tissuesamples: Schema.optional(Schema.Int),
  thargoidpods: Schema.optional(Schema.Int),
})

// --- Faction DTO for PUT request ---

export const FactionInputSchema = Schema.Struct({
  name: Schema.String,
  state: Schema.String,
  bvs: Schema.optional(Schema.Int),
  cbs: Schema.optional(Schema.Int),
  exobiology: Schema.optional(Schema.Int),
  exploration: Schema.optional(Schema.Int),
  scenarios: Schema.optional(Schema.Int),
  infprimary: Schema.optional(Schema.Int),
  infsecondary: Schema.optional(Schema.Int),
  missionfails: Schema.optional(Schema.Int),
  murdersground: Schema.optional(Schema.Int),
  murdersspace: Schema.optional(Schema.Int),
  tradebm: Schema.optional(Schema.Int),
  czspace: Schema.optional(CZLevelsInput),
  czground: Schema.optional(Schema.Struct({
    low: Schema.optional(Schema.Int),
    medium: Schema.optional(Schema.Int),
    high: Schema.optional(Schema.Int),
    settlements: Schema.optional(Schema.Array(SettlementInput)),
  })),
  sandr: Schema.optional(SandRInput),
  tradebuy: Schema.optional(TradeInput),
  tradesell: Schema.optional(TradeInput),
  stations: Schema.optional(Schema.Array(StationInput)),
})

export type FactionInput = typeof FactionInputSchema.Type

// --- System DTO for PUT request ---

export const SystemInputSchema = Schema.Struct({
  name: Schema.String,
  address: Schema.Number,
  factions: Schema.Array(FactionInputSchema),
  twkills: Schema.optional(TWKillsInput),
  twsandr: Schema.optional(TWSandRInput),
  twreactivate: Schema.optional(Schema.Int),
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
