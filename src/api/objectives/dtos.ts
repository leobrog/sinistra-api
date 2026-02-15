import { Schema } from "effect"
import { Objective, ObjectiveTarget, ObjectiveTargetSettlement } from "../../domain/models.ts"
import { ObjectiveId } from "../../domain/ids.ts"

/**
 * DTOs for Objectives API
 *
 * Objectives track BGS goals with nested targets and settlements.
 */

// Settlement input for POST/PUT
export const SettlementInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  targetindividual: Schema.optional(Schema.Int),
  targetoverall: Schema.optional(Schema.Int),
  progress: Schema.optional(Schema.Int),
})

export type SettlementInput = typeof SettlementInputSchema.Type

// Target input for POST/PUT
export const TargetInputSchema = Schema.Struct({
  type: Schema.optional(Schema.String),
  station: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  faction: Schema.optional(Schema.String),
  progress: Schema.optional(Schema.Int),
  targetindividual: Schema.optional(Schema.Int),
  targetoverall: Schema.optional(Schema.Int),
  settlements: Schema.Array(SettlementInputSchema),
})

export type TargetInput = typeof TargetInputSchema.Type

// POST /objectives request
export const CreateObjectiveRequest = Schema.Struct({
  title: Schema.String,
  priority: Schema.optional(Schema.Int),
  type: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  faction: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  startdate: Schema.optional(Schema.Date),
  enddate: Schema.optional(Schema.Date),
  targets: Schema.Array(TargetInputSchema),
})

export type CreateObjectiveRequest = typeof CreateObjectiveRequest.Type

// POST /objectives response
export const CreateObjectiveResponse = Schema.Struct({
  status: Schema.Literal("Objective created successfully"),
  id: ObjectiveId,
})

export type CreateObjectiveResponse = typeof CreateObjectiveResponse.Type

// POST /api/objectives/:id request (update)
export const UpdateObjectiveRequest = Schema.Struct({
  title: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.Int),
  type: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  faction: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  startdate: Schema.optional(Schema.Date),
  enddate: Schema.optional(Schema.Date),
  targets: Schema.optional(Schema.Array(TargetInputSchema)),
})

export type UpdateObjectiveRequest = typeof UpdateObjectiveRequest.Type

// POST /api/objectives/:id response (update)
export const UpdateObjectiveResponse = Schema.Struct({
  status: Schema.Literal("Objective updated successfully"),
  id: ObjectiveId,
})

export type UpdateObjectiveResponse = typeof UpdateObjectiveResponse.Type

// DELETE /api/objectives/:id response
export const DeleteObjectiveResponse = Schema.Struct({
  message: Schema.String,
})

export type DeleteObjectiveResponse = typeof DeleteObjectiveResponse.Type

// GET /objectives query parameters
export const GetObjectivesQuery = Schema.Struct({
  system: Schema.optional(Schema.String),
  faction: Schema.optional(Schema.String),
  active: Schema.optional(Schema.Boolean),
})

export type GetObjectivesQuery = typeof GetObjectivesQuery.Type

// GET /objectives response (no IDs)
export const GetObjectivesResponse = Schema.Array(Objective)
export type GetObjectivesResponse = typeof GetObjectivesResponse.Type
