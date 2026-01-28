import { Schema } from "effect"
import {
  ApiKey,
  ApiKeyId,
  Email,
  HashedPassword,
  UserId,
} from "./ids.ts"

// Plan tiers
export const PlanTier = Schema.Literal("free", "pro", "enterprise")
export type PlanTier = typeof PlanTier.Type

// API Key
export class UserApiKey extends Schema.Class<UserApiKey>("UserApiKey")({
  id: ApiKeyId,
  userId: UserId,
  key: ApiKey,
  name: Schema.String,
  lastUsedAt: Schema.optionalWith(Schema.Date, { as: "Option" }),
  expiresAt: Schema.optionalWith(Schema.Date, { as: "Option" }),
  createdAt: Schema.Date,
}) {}

// User
export class User extends Schema.Class<User>("User")({
  id: UserId,
  email: Email,
  name: Schema.String,
  password: HashedPassword,
  company: Schema.optionalWith(Schema.String, { as: "Option" }),
  planTier: PlanTier,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}
