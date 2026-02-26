import { Schema } from "effect"

export class FactionState extends Schema.Class<FactionState>("FactionState")({
  State: Schema.optionalWith(Schema.String, { nullable: true }),
  Trend: Schema.optionalWith(Schema.Number, { nullable: true }),
}) {}

export class Faction extends Schema.Class<Faction>("Faction")({
  Name: Schema.String,
  FactionState: Schema.optionalWith(Schema.String, { nullable: true }),
  Government: Schema.optionalWith(Schema.String, { nullable: true }),
  Influence: Schema.optionalWith(Schema.Number, { nullable: true }),
  Allegiance: Schema.optionalWith(Schema.String, { nullable: true }),
  Happiness: Schema.optionalWith(Schema.String, { nullable: true }),
  MyReputation: Schema.optionalWith(Schema.Number, { nullable: true }),
  PendingStates: Schema.optionalWith(Schema.Array(FactionState), { nullable: true }),
  RecoveringStates: Schema.optionalWith(Schema.Array(FactionState), { nullable: true }),
}) {}

export class SystemEntry extends Schema.Class<SystemEntry>("SystemEntry")({
  StarSystem: Schema.String,
  SystemAddress: Schema.optionalWith(Schema.Number, { nullable: true }),
  Timestamp: Schema.optionalWith(Schema.String, { nullable: true }),
  Factions: Schema.Array(Faction),
}) {}
