import { Schema } from "effect"
import { DateFilterPeriodSchema } from "../../services/date-filters.js"

/**
 * Query parameters for GET /api/buckets
 */
export class BucketsQueryParams extends Schema.Class<BucketsQueryParams>("BucketsQueryParams")({
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
export class BucketsBuckets extends Schema.Class<BucketsBuckets>("BucketsBuckets")({
  missions: BucketDetail,
  exploration: BucketDetail,
  bounty: BucketDetail,
  missionFail: BucketDetail,
  murder: BucketDetail,
}) {}

/**
 * BGS buckets result for one faction in one system.
 */
export class BucketsEntry extends Schema.Class<BucketsEntry>("BucketsEntry")({
  system: Schema.String,
  faction: Schema.String,
  period: Schema.String,
  population: Schema.optionalWith(Schema.Number, { nullable: true }),
  factionCount: Schema.optionalWith(Schema.Number, { nullable: true }),
  currentInfluence: Schema.optionalWith(Schema.Number, { nullable: true }),
  maxSwing: Schema.optionalWith(Schema.Number, { nullable: true }),
  buckets: BucketsBuckets,
  totalPositivePts: Schema.Number,
  totalNegativePts: Schema.Number,
  netPts: Schema.Number,
  cappedPts: Schema.Number,
  pctCap: Schema.Number,
  predictedInfluenceChange: Schema.optionalWith(Schema.Number, { nullable: true }),
  predictedInfluence: Schema.optionalWith(Schema.Number, { nullable: true }),
}) {}

/**
 * Top-level response for GET /api/buckets
 */
export class BucketsResponse extends Schema.Class<BucketsResponse>("BucketsResponse")({
  buckets: Schema.Array(BucketsEntry),
  count: Schema.Number,
}) {}
