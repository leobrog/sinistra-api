import { Schema } from "effect"

// Response schemas
export class SyncCmdrsResponse extends Schema.Class<SyncCmdrsResponse>("SyncCmdrsResponse")({
  status: Schema.Literal("completed"),
  added: Schema.Number,
  updated: Schema.Number,
  skipped: Schema.Number,
  message: Schema.String
}) {}

// Error schemas
export class SyncCmdrsError extends Schema.TaggedError<SyncCmdrsError>()("SyncCmdrsError", {
  message: Schema.String
}) {}
