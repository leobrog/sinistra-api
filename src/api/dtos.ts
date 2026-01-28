import { Schema } from "effect"
import { PlanTier } from "../domain/models.ts"
import { Email, UserId, ApiKeyId, ApiKey } from "../domain/ids.ts"

// Response DTO (excludes password)
export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: UserId,
  email: Email,
  name: Schema.String,
  company: Schema.optionalWith(Schema.String, { as: "Option" }),
  planTier: PlanTier,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

//UserLoginResponse
export class UserLoginResponse extends Schema.Class<UserLoginResponse>("UserLoginResponse")({
  accessToken: Schema.String,
  user: Schema.Struct({
    id: UserId,
    email: Email,
    planTier: PlanTier
  })
}) {}

// Create Request DTO
export class CreateUserRequest extends Schema.Class<CreateUserRequest>("CreateUserRequest")({
  email: Email,
  name: Schema.String,
  password: Schema.String.pipe(Schema.minLength(8)),
  company: Schema.optional(Schema.String),
}) {}

// Update Request DTO
export class UpdateUserRequest extends Schema.Class<UpdateUserRequest>("UpdateUserRequest")({
  name: Schema.optional(Schema.String),
  company: Schema.optional(Schema.String),
  password: Schema.optional(Schema.String.pipe(Schema.minLength(8))),
}) {}

//UserLoginRequest
export class UserLoginRequest extends Schema.Class<UserLoginRequest>("UserLoginRequest")({
  email: Email,
  password: Schema.String
}) {}

// API Key Response DTO
export class ApiKeyResponse extends Schema.Class<ApiKeyResponse>("ApiKeyResponse")({
  id: ApiKeyId,
  userId: UserId,
  name: Schema.String,
  lastUsedAt: Schema.optionalWith(Schema.Date, { as: "Option" }),
  expiresAt: Schema.optionalWith(Schema.Date, { as: "Option" }),
  createdAt: Schema.Date,
}) {}

export class ApiKeyCreateResponse extends Schema.Class<ApiKeyCreateResponse>("ApiKeyCreateResponse")({
  id: ApiKeyId,
  userId: UserId,
  key: ApiKey,
  name: Schema.String,
  lastUsedAt: Schema.optionalWith(Schema.Date, { as: "Option" }),
  expiresAt: Schema.optionalWith(Schema.Date, { as: "Option" }),
  createdAt: Schema.Date,
}) {}


// Create API Key Request DTO
export class CreateApiKeyRequest extends Schema.Class<CreateApiKeyRequest>("CreateApiKeyRequest")({
  name: Schema.String,
  expiresAt: Schema.optional(Schema.Date),
}) {}


