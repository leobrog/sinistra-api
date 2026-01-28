import { Schema } from "effect"
import { RateId, UserId } from "./ids.ts"

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

export const DomainError = Schema.Union(
  NotFoundError,
  ValidationError,
  DatabaseError,
  UserNotFoundError,
  UserAlreadyExistsError,
  ApiKeyNameAlreadyExistsError,
  RateNotFoundError
)
export type DomainError = typeof DomainError.Type