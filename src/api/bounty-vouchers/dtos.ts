import { Schema } from "effect"
import { DateFilterPeriodSchema } from "../../services/date-filters.js"

/**
 * Query parameters for bounty voucher list
 */
export class BountyVoucherQueryParams extends Schema.Class<BountyVoucherQueryParams>("BountyVoucherQueryParams")({
  period: Schema.optional(DateFilterPeriodSchema),
  cmdr: Schema.optional(Schema.String),
  system: Schema.optional(Schema.String),
  faction: Schema.optional(Schema.String),
  type: Schema.optional(Schema.String), // 'bounty' or 'CombatBond'
}) {}

/**
 * Individual voucher entry response
 */
export class VoucherEntry extends Schema.Class<VoucherEntry>("VoucherEntry")({
  cmdr: Schema.String,
  squadron_rank: Schema.optionalWith(Schema.String, { nullable: true }),
  system: Schema.optionalWith(Schema.String, { nullable: true }),
  timestamp: Schema.optionalWith(Schema.String, { nullable: true }),
  tickid: Schema.optionalWith(Schema.String, { nullable: true }),
  amount: Schema.Number,
  type: Schema.String,
  faction: Schema.optionalWith(Schema.String, { nullable: true }),
}) {}

/**
 * List response for vouchers
 */
export class VoucherListResponse extends Schema.Class<VoucherListResponse>("VoucherListResponse")({
  vouchers: Schema.Array(VoucherEntry),
  count: Schema.Number,
}) {}
