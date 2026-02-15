import { Schema } from "effect"

// Request for tick summary
export class TriggerTickSummaryRequest extends Schema.Class<TriggerTickSummaryRequest>("TriggerTickSummaryRequest")({
  period: Schema.optionalWith(Schema.String, { default: () => "ct" }), // ct, lt, cw, lw, cm, lm, etc.
}) {}

// Request for synthetic CZ summary
export class SyntheticCZSummaryRequest extends Schema.Class<SyntheticCZSummaryRequest>("SyntheticCZSummaryRequest")({
  period: Schema.optionalWith(Schema.String, { nullable: true }), // cw, lw, cm, lm, 2m, y, cd, ld, all
}) {}

// Request for synthetic ground CZ summary
export class SyntheticGroundCZSummaryRequest extends Schema.Class<SyntheticGroundCZSummaryRequest>("SyntheticGroundCZSummaryRequest")({
  period: Schema.optionalWith(Schema.String, { nullable: true }), // cw, lw, cm, lm, 2m, y, cd, ld, ct, lt, all
}) {}

// Request for custom Discord message
export class CustomDiscordMessageRequest extends Schema.Class<CustomDiscordMessageRequest>("CustomDiscordMessageRequest")({
  content: Schema.String,
  webhook: Schema.optionalWith(Schema.String, { default: () => "BGS" }), // BGS, shoutout, conflict, debug
  username: Schema.optionalWith(Schema.String, { default: () => "Sinistra Admin" }),
}) {}

// Generic success response
export class DiscordSummaryResponse extends Schema.Class<DiscordSummaryResponse>("DiscordSummaryResponse")({
  status: Schema.String,
  message: Schema.optionalWith(Schema.String, { nullable: true }),
}) {}

// Top5 specific response
export class Top5SummaryResponse extends Schema.Class<Top5SummaryResponse>("Top5SummaryResponse")({
  status: Schema.String,
  results: Schema.optionalWith(
    Schema.Array(
      Schema.Struct({
        tenant: Schema.String,
        status: Schema.String,
        reason: Schema.optionalWith(Schema.String, { nullable: true }),
      })
    ),
    { nullable: true }
  ),
}) {}
