import { Schema } from "effect"

// Branded ID types for type-safe entity references
export const UserId = Schema.String.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const RateId = Schema.String.pipe(Schema.brand("RateId"))
export type RateId = typeof RateId.Type

export const ApiKeyId = Schema.String.pipe(Schema.brand("ApiKeyId"))
export type ApiKeyId = typeof ApiKeyId.Type

// Branded primitives
export const Email = Schema.String.pipe(Schema.brand("Email"))
export type Email = typeof Email.Type

export const HashedPassword = Schema.String.pipe(Schema.brand("HashedPassword"))
export type HashedPassword = typeof HashedPassword.Type

export const ApiKey = Schema.String.pipe(Schema.brand("ApiKey"))
export type ApiKey = typeof ApiKey.Type
