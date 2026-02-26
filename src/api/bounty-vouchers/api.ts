import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { BountyVoucherQueryParams, VoucherListResponse } from "./dtos.js"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.js"
import { DatabaseError } from "../../domain/errors.js"

export const BountyVouchersApi = HttpApiGroup.make("bountyVouchers")
  .add(
    HttpApiEndpoint.get("getVouchers", "/")
      .addSuccess(VoucherListResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setUrlParams(BountyVoucherQueryParams)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Bounty Vouchers")
      .annotate(
        OpenApi.Description,
        `Get a list of redeem voucher events (bounty vouchers or combat bonds) with optional filters.
        
Supports the following query parameters:
- period: Date filter period (e.g., "ct", "lt", "cd", "cw", "cm", etc.)
- cmdr: Filter by commander name
- system: Filter by system name
- faction: Filter by faction name
- type: Filter by voucher type ('bounty' or 'CombatBond')`
      )
  )
  .prefix("/api/bounty-vouchers")
