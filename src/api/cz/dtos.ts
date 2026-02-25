import { Schema } from "effect"
import { DateFilterPeriodSchema } from "../../services/date-filters.js"

export const CZSummaryQueryParamsSchema = Schema.Struct({
  period: Schema.optional(DateFilterPeriodSchema),
  system_name: Schema.optional(Schema.String),
})

export type CZSummaryQueryParams = typeof CZSummaryQueryParamsSchema.Type

export const SpaceCZSummaryResponseSchema = Schema.Array(Schema.Unknown)
export const GroundCZSummaryResponseSchema = Schema.Array(Schema.Unknown)
