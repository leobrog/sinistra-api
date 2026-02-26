import { Schema } from "effect";
import { ProtectedFactionId } from "../../domain/ids.ts";

/**
 * Request DTO for POST /api/protected-faction
 */
export const CreateProtectedFactionRequest = Schema.Struct({
  name: Schema.String,
  webhook_url: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  protected: Schema.optional(Schema.Boolean), // Default to true in handler logic
});

export type CreateProtectedFactionRequest = typeof CreateProtectedFactionRequest.Type;

/**
 * Request DTO for PUT /api/protected-faction/:id
 */
export const UpdateProtectedFactionRequest = Schema.Struct({
  name: Schema.optional(Schema.NullOr(Schema.String)),
  webhook_url: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  protected: Schema.optional(Schema.Boolean),
});

export type UpdateProtectedFactionRequest = typeof UpdateProtectedFactionRequest.Type;

/**
 * Path parameter for faction ID
 */
export const ProtectedFactionIdParam = Schema.Struct({
  id: ProtectedFactionId,
});

export type ProtectedFactionIdParam = typeof ProtectedFactionIdParam.Type;

/**
 * Response DTO for protected faction operations
 */
export const ProtectedFactionResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  webhook_url: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  protected: Schema.Boolean,
});

export type ProtectedFactionResponse = typeof ProtectedFactionResponse.Type;

/**
 * Response for GET /api/protected-faction
 */
export const ProtectedFactionsListResponse = Schema.Array(ProtectedFactionResponse);

export type ProtectedFactionsListResponse = typeof ProtectedFactionsListResponse.Type;

/**
 * Response for POST /api/protected-faction
 */
export const CreateProtectedFactionResponse = Schema.Struct({
  id: Schema.String,
});

export type CreateProtectedFactionResponse = typeof CreateProtectedFactionResponse.Type;

/**
 * Response for PUT/DELETE operations
 */
export const StatusResponse = Schema.Struct({
  status: Schema.String,
});

export type StatusResponse = typeof StatusResponse.Type;

/**
 * Response for GET /api/protected-faction/systems
 */
export const SystemNamesResponse = Schema.Array(Schema.String);

export type SystemNamesResponse = typeof SystemNamesResponse.Type;
