import { Schema } from "effect"
import { ObjectiveId, ObjectiveTargetId, ObjectiveTargetSettlementId } from "../../domain/ids.js"

/**
 * DTOs for Objectives API
 *
 * Objectives track BGS goals with nested targets and settlements.
 */

// Settlement input for POST/PUT
export const SettlementInputSchema = Schema.Struct({
  name: Schema.optional(Schema.NullOr(Schema.String)),
  targetindividual: Schema.optional(Schema.NullOr(Schema.Int)),
  targetoverall: Schema.optional(Schema.NullOr(Schema.Int)),
  progress: Schema.optional(Schema.NullOr(Schema.Int)),
})

export type SettlementInput = typeof SettlementInputSchema.Type

// Target input for POST/PUT
export const TargetInputSchema = Schema.Struct({
  type: Schema.optional(Schema.NullOr(Schema.String)),
  station: Schema.optional(Schema.NullOr(Schema.String)),
  system: Schema.optional(Schema.NullOr(Schema.String)),
  faction: Schema.optional(Schema.NullOr(Schema.String)),
  progress: Schema.optional(Schema.NullOr(Schema.Int)),
  targetindividual: Schema.optional(Schema.NullOr(Schema.Int)),
  targetoverall: Schema.optional(Schema.NullOr(Schema.Int)),
  settlements: Schema.Array(SettlementInputSchema),
})

export type TargetInput = typeof TargetInputSchema.Type

// POST /objectives request
export const CreateObjectiveRequest = Schema.Struct({
  title: Schema.String,
  priority: Schema.optional(Schema.NullOr(Schema.Int)),
  type: Schema.optional(Schema.NullOr(Schema.String)),
  system: Schema.optional(Schema.NullOr(Schema.String)),
  faction: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  startdate: Schema.optional(Schema.NullOr(Schema.Date)),
  enddate: Schema.optional(Schema.NullOr(Schema.Date)),
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
  title: Schema.optional(Schema.NullOr(Schema.String)),
  priority: Schema.optional(Schema.NullOr(Schema.Int)),
  type: Schema.optional(Schema.NullOr(Schema.String)),
  system: Schema.optional(Schema.NullOr(Schema.String)),
  faction: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  startdate: Schema.optional(Schema.NullOr(Schema.Date)),
  enddate: Schema.optional(Schema.NullOr(Schema.Date)),
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

// Progress detail schemas (for GET response)
export const CmdrProgressSchema = Schema.Struct({
  cmdr: Schema.String,
  progress: Schema.Number,
  target: Schema.Number,
  percentage: Schema.Number,
})

export const SettlementProgressSchema = Schema.Struct({
  settlement: Schema.String,
  progress: Schema.Number,
  target: Schema.Number,
  percentage: Schema.Number,
})

export const ProgressDetailSchema = Schema.Struct({
  overallProgress: Schema.Number,
  overallTarget: Schema.Number,
  overallPercentage: Schema.Number,
  cmdrProgress: Schema.Array(CmdrProgressSchema),
  settlementProgress: Schema.Array(SettlementProgressSchema),
})

export type ProgressDetail = typeof ProgressDetailSchema.Type

// Settlement in GET response
const SettlementResponseSchema = Schema.Struct({
  id: ObjectiveTargetSettlementId,
  targetId: ObjectiveTargetId,
  name: Schema.optionalWith(Schema.String, { as: "Option" }),
  targetindividual: Schema.optionalWith(Schema.Number, { as: "Option" }),
  targetoverall: Schema.optionalWith(Schema.Number, { as: "Option" }),
  progress: Schema.optionalWith(Schema.Number, { as: "Option" }),
})

// Target in GET response (includes progressDetail)
const ObjectiveTargetResponseSchema = Schema.Struct({
  id: ObjectiveTargetId,
  objectiveId: ObjectiveId,
  type: Schema.optionalWith(Schema.String, { as: "Option" }),
  station: Schema.optionalWith(Schema.String, { as: "Option" }),
  system: Schema.optionalWith(Schema.String, { as: "Option" }),
  faction: Schema.optionalWith(Schema.String, { as: "Option" }),
  progress: Schema.optionalWith(Schema.Number, { as: "Option" }),
  targetindividual: Schema.optionalWith(Schema.Number, { as: "Option" }),
  targetoverall: Schema.optionalWith(Schema.Number, { as: "Option" }),
  settlements: Schema.Array(SettlementResponseSchema),
  progressDetail: ProgressDetailSchema,
})

// Objective in GET response
const ObjectiveResponseSchema = Schema.Struct({
  id: ObjectiveId,
  title: Schema.optionalWith(Schema.String, { as: "Option" }),
  priority: Schema.optionalWith(Schema.Number, { as: "Option" }),
  type: Schema.optionalWith(Schema.String, { as: "Option" }),
  system: Schema.optionalWith(Schema.String, { as: "Option" }),
  faction: Schema.optionalWith(Schema.String, { as: "Option" }),
  description: Schema.optionalWith(Schema.String, { as: "Option" }),
  startdate: Schema.optionalWith(Schema.Date, { as: "Option" }),
  enddate: Schema.optionalWith(Schema.Date, { as: "Option" }),
  targets: Schema.Array(ObjectiveTargetResponseSchema),
})

// GET /objectives response
export const GetObjectivesResponse = Schema.Array(ObjectiveResponseSchema)
export type GetObjectivesResponse = typeof GetObjectivesResponse.Type
