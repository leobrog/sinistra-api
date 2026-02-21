import { Schema } from "effect"

// Endpoint configuration
export class EndpointConfig extends Schema.Class<EndpointConfig>("EndpointConfig")({
  path: Schema.String,
  minPeriod: Schema.String,
  maxBatch: Schema.String,
}) {}

// Header requirement
export class HeaderRequirement extends Schema.Class<HeaderRequirement>("HeaderRequirement")({
  required: Schema.Boolean,
  description: Schema.String,
  current: Schema.optional(Schema.String),
}) {}

// Discovery response
export class DiscoveryResponse extends Schema.Class<DiscoveryResponse>("DiscoveryResponse")({
  name: Schema.String,
  description: Schema.String,
  url: Schema.String,
  endpoints: Schema.Record({
    key: Schema.String,
    value: EndpointConfig,
  }),
  headers: Schema.Record({
    key: Schema.String,
    value: HeaderRequirement,
  }),
}) {}

// Error schema
export class DiscoveryError extends Schema.TaggedError<DiscoveryError>()("DiscoveryError", {
  message: Schema.String,
}) {}
