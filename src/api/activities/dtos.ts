import { Schema } from "effect"
import { Activity } from "../../domain/models.ts"

/**
 * DTOs for Activities API
 *
 * Activities track commander BGS (Background Simulation) actions
 * organized by tick, with nested systems and factions.
 */

// Faction DTO for PUT request
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
})

export type FactionInput = typeof FactionInputSchema.Type

// System DTO for PUT request
export const SystemInputSchema = Schema.Struct({
  name: Schema.String,
  address: Schema.BigInt,
  factions: Schema.Array(FactionInputSchema),
})

export type SystemInput = typeof SystemInputSchema.Type

// Activity PUT request schema
export const PutActivityRequest = Schema.Struct({
  tickid: Schema.String,
  ticktime: Schema.String,
  timestamp: Schema.String,
  cmdr: Schema.optional(Schema.String),
  systems: Schema.Array(SystemInputSchema),
})

export type PutActivityRequest = typeof PutActivityRequest.Type

// Activity PUT response
export const PutActivityResponse = Schema.Struct({
  status: Schema.Literal("activity saved"),
})

export type PutActivityResponse = typeof PutActivityResponse.Type

// GET activities query parameters
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
