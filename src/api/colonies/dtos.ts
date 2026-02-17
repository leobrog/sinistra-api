import { Schema } from "effect";
import { ColonyId } from "../../domain/ids.ts";

/**
 * Request DTO for POST /api/colonies
 */
export const CreateColonyRequest = Schema.Struct({
  cmdr: Schema.optional(Schema.String),
  starsystem: Schema.String, // Required
  ravenurl: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.Int), // Default to 0 in handler logic
});

export type CreateColonyRequest = typeof CreateColonyRequest.Type;

/**
 * Request DTO for PUT /api/colonies/:id
 */
export const UpdateColonyRequest = Schema.Struct({
  cmdr: Schema.optional(Schema.String),
  starsystem: Schema.optional(Schema.String),
  ravenurl: Schema.optional(Schema.String),
  priority: Schema.optional(Schema.Int),
});

export type UpdateColonyRequest = typeof UpdateColonyRequest.Type;

/**
 * Request DTO for POST /api/colonies/:id/priority
 */
export const SetPriorityRequest = Schema.Struct({
  priority: Schema.Int,
});

export type SetPriorityRequest = typeof SetPriorityRequest.Type;

/**
 * Query parameters for GET /api/colonies/search
 */
export const SearchColoniesQuery = Schema.Struct({
  cmdr: Schema.optional(Schema.String),
  starsystem: Schema.optional(Schema.String),
  systemaddress: Schema.optional(Schema.String),
});

export type SearchColoniesQuery = typeof SearchColoniesQuery.Type;

/**
 * Path parameter for colony ID
 */
export const ColonyIdParam = Schema.Struct({
  id: ColonyId,
});

export type ColonyIdParam = typeof ColonyIdParam.Type;

/**
 * Response DTO for colony operations
 */
export const ColonyResponse = Schema.Struct({
  id: Schema.String,
  cmdr: Schema.NullOr(Schema.String),
  starsystem: Schema.NullOr(Schema.String),
  ravenurl: Schema.NullOr(Schema.String),
  priority: Schema.Int,
});

export type ColonyResponse = typeof ColonyResponse.Type;

/**
 * Response for GET /api/colonies
 */
export const ColoniesListResponse = Schema.Array(ColonyResponse);

export type ColoniesListResponse = typeof ColoniesListResponse.Type;

/**
 * Response for POST /api/colonies
 */
export const CreateColonyResponse = Schema.Struct({
  status: Schema.String,
  id: Schema.String,
});

export type CreateColonyResponse = typeof CreateColonyResponse.Type;

/**
 * Response for PUT/DELETE operations
 */
export const StatusResponse = Schema.Struct({
  status: Schema.String,
});

export type StatusResponse = typeof StatusResponse.Type;

/**
 * Response for SET priority
 */
export const SetPriorityResponse = Schema.Struct({
  status: Schema.String,
  id: Schema.String,
  starsystem: Schema.NullOr(Schema.String),
  priority: Schema.Int,
});

export type SetPriorityResponse = typeof SetPriorityResponse.Type;
