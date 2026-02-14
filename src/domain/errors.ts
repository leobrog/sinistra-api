import { Schema } from "effect"
import {
  ActivityId,
  CmdrId,
  ColonyId,
  EventId,
  ObjectiveId,
  ProtectedFactionId,
  RateId,
  UserId,
} from "./ids.ts"

export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    resource: Schema.String,
    id: Schema.String,
  }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
  "DatabaseError",
  {
    operation: Schema.String,
    error: Schema.Defect,
  }
) {}

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  {
    id: UserId,
  }
) {}

export class UserAlreadyExistsError extends Schema.TaggedError<UserAlreadyExistsError>()(
  "UserAlreadyExistsError",
  {
    email: Schema.String,
  }
) {}

export class ApiKeyNameAlreadyExistsError extends Schema.TaggedError<ApiKeyNameAlreadyExistsError>()(
  "ApiKeyNameAlreadyExistsError",
  {
    name: Schema.String,
  }
) {}

export class RateNotFoundError extends Schema.TaggedError<RateNotFoundError>()(
  "RateNotFoundError",
  {
    id: RateId,
  }
) {}

export class PasswordHashingError extends Schema.TaggedError<PasswordHashingError>()(
  "PasswordHashingError",
  {
    cause: Schema.Unknown,
  }
) {}

export class JwtSigningError extends Schema.TaggedError<JwtSigningError>()(
  "JwtSigningError",
  {
    message: Schema.String,
  }
) {}

export class JwtVerifyError extends Schema.TaggedError<JwtVerifyError>()(
  "JwtVerifyError",
  {
    message: Schema.String,
  }
) {}

export class UserLoginError extends Schema.TaggedError<UserLoginError>()(
  "UserLoginError",
  {
    message: Schema.String,
  }
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
  "ForbiddenError",
  {
    message: Schema.String,
  }
) {}

export class InternalServerError extends Schema.TaggedError<InternalServerError>()(
  "InternalServerError",
  {
    message: Schema.String,
  }
) {}

// ============================================================================
// Sinistra Domain Errors
// ============================================================================

// Entity Not Found Errors
export class EventNotFoundError extends Schema.TaggedError<EventNotFoundError>()(
  "EventNotFoundError",
  {
    id: EventId,
  }
) {}

export class ActivityNotFoundError extends Schema.TaggedError<ActivityNotFoundError>()(
  "ActivityNotFoundError",
  {
    id: ActivityId,
  }
) {}

export class ObjectiveNotFoundError extends Schema.TaggedError<ObjectiveNotFoundError>()(
  "ObjectiveNotFoundError",
  {
    id: ObjectiveId,
  }
) {}

export class CmdrNotFoundError extends Schema.TaggedError<CmdrNotFoundError>()(
  "CmdrNotFoundError",
  {
    id: CmdrId,
  }
) {}

export class ColonyNotFoundError extends Schema.TaggedError<ColonyNotFoundError>()(
  "ColonyNotFoundError",
  {
    id: ColonyId,
  }
) {}

export class ProtectedFactionNotFoundError extends Schema.TaggedError<ProtectedFactionNotFoundError>()(
  "ProtectedFactionNotFoundError",
  {
    id: ProtectedFactionId,
  }
) {}

// External API Errors
export class DiscordApiError extends Schema.TaggedError<DiscordApiError>()(
  "DiscordApiError",
  {
    message: Schema.String,
    statusCode: Schema.optionalWith(Schema.Int, { as: "Option" }),
    response: Schema.optionalWith(Schema.String, { as: "Option" }),
  }
) {}

export class InaraApiError extends Schema.TaggedError<InaraApiError>()(
  "InaraApiError",
  {
    message: Schema.String,
    statusCode: Schema.optionalWith(Schema.Int, { as: "Option" }),
    response: Schema.optionalWith(Schema.String, { as: "Option" }),
  }
) {}

export class EddnConnectionError extends Schema.TaggedError<EddnConnectionError>()(
  "EddnConnectionError",
  {
    message: Schema.String,
  }
) {}

// Already Exists Errors
export class CmdrAlreadyExistsError extends Schema.TaggedError<CmdrAlreadyExistsError>()(
  "CmdrAlreadyExistsError",
  {
    name: Schema.String,
  }
) {}

export class ProtectedFactionAlreadyExistsError extends Schema.TaggedError<ProtectedFactionAlreadyExistsError>()(
  "ProtectedFactionAlreadyExistsError",
  {
    name: Schema.String,
  }
) {}

export const DomainError = Schema.Union(
  NotFoundError,
  ValidationError,
  DatabaseError,
  UserNotFoundError,
  UserAlreadyExistsError,
  ApiKeyNameAlreadyExistsError,
  RateNotFoundError,
  EventNotFoundError,
  ActivityNotFoundError,
  ObjectiveNotFoundError,
  CmdrNotFoundError,
  ColonyNotFoundError,
  ProtectedFactionNotFoundError,
  DiscordApiError,
  InaraApiError,
  EddnConnectionError,
  CmdrAlreadyExistsError,
  ProtectedFactionAlreadyExistsError
)
export type DomainError = typeof DomainError.Type