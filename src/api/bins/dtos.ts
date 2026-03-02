import { Schema } from "effect"
import { DateFilterPeriodSchema } from "../../services/date-filters.js"

/**
 * Query parameters for GET /api/bins
 */
export class BinsQueryParams extends Schema.Class<BinsQueryParams>("BinsQueryParams")({
  period: Schema.optionalWith(DateFilterPeriodSchema, { default: () => "ct" as const }),
  system: Schema.optional(Schema.String),
}) {}

/**
 * Per-bucket detail: raw value, points earned, next threshold, and remaining work.
 */
export class BucketDetail extends Schema.Class<BucketDetail>("BucketDetail")({
  raw: Schema.Number,
  pts: Schema.Number,
  nextThreshold: Schema.Number,
  remaining: Schema.Number,
}) {}

/**
 * All tracked BGS buckets for a faction/system pair.
 */
export class BinsBuckets extends Schema.Class<BinsBuckets>("BinsBuckets")({
  missions: BucketDetail,
  exploration: BucketDetail,
  bounty: BucketDetail,
  missionFail: BucketDetail,
  murder: BucketDetail,
}) {}

/**
 * BGS bins result for one faction in one system.
 */
export class BinsEntry extends Schema.Class<BinsEntry>("BinsEntry")({
  system: Schema.String,
  faction: Schema.String,
  period: Schema.String,
  population: Schema.optionalWith(Schema.Number, { nullable: true }),
  factionCount: Schema.optionalWith(Schema.Number, { nullable: true }),
  currentInfluence: Schema.optionalWith(Schema.Number, { nullable: true }),
  maxSwing: Schema.optionalWith(Schema.Number, { nullable: true }),
  buckets: BinsBuckets,
  totalPositivePts: Schema.Number,
  totalNegativePts: Schema.Number,
  netPts: Schema.Number,
  cappedPts: Schema.Number,
  pctCap: Schema.Number,
  predictedInfluenceChange: Schema.optionalWith(Schema.Number, { nullable: true }),
  predictedInfluence: Schema.optionalWith(Schema.Number, { nullable: true }),
}) {}

/**
 * Top-level response for GET /api/bins
 */
export class BinsResponse extends Schema.Class<BinsResponse>("BinsResponse")({
  bins: Schema.Array(BinsEntry),
  count: Schema.Number,
}) {}
