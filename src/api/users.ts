import { HttpApiGroup, HttpApiEndpoint } from "@effect/platform"
import { Schema } from "effect"
import { UserResponse, CreateUserRequest, ApiKeyResponse, CreateApiKeyRequest, ApiKeyCreateResponse, UserLoginResponse, UserLoginRequest } from "./dtos.ts"
import { UserId, ApiKeyId } from "../domain/ids.ts"
import { UserNotFoundError, UserAlreadyExistsError, InternalServerError, ApiKeyNameAlreadyExistsError, UserLoginError, ForbiddenError } from "../domain/errors.ts"
import { Authentication } from "./middleware/auth.ts"

export const UsersApi = HttpApiGroup.make("users")
  // PUBLIC ROUTES
  .add(
    HttpApiEndpoint.post("login", "/users/login")
    .addSuccess(UserLoginResponse)
    .addError(UserLoginError, { status: 401 })
    .addError(InternalServerError, { status: 500 })
    .setPayload(UserLoginRequest)
  )
  .add(
    HttpApiEndpoint.post("create", "/users")
      .addSuccess(UserResponse) // Returns the created user (sans password)
      .addError(UserAlreadyExistsError, { status: 409 })
      .addError(InternalServerError, { status: 500 })
      .setPayload(CreateUserRequest)
  )
  // PROTECTED ROUTES
  .add(
    HttpApiEndpoint.get("findById", "/users/:id")
      .addSuccess(UserResponse)
      .addError(ForbiddenError, { status: 403 })
      .addError(UserNotFoundError, { status: 404 })
      .addError(InternalServerError, { status: 500 })
      .setPath(Schema.Struct({ id: UserId }))
      .middleware(Authentication)
  )
  .add(
    HttpApiEndpoint.del("delete", "/users/:id")
      .addSuccess(Schema.Void, { status: 204 })
      .addError(ForbiddenError, { status: 403 })
      .addError(InternalServerError, { status: 500 })
      .setPath(Schema.Struct({ id: UserId }))
      .middleware(Authentication)
  )
  .add(
    HttpApiEndpoint.post("createApiKey", "/users/:userId/api-keys")
      .addSuccess(ApiKeyCreateResponse)
      .addError(ForbiddenError, { status: 403 })
      .addError(UserNotFoundError, { status: 404 })
      .addError(ApiKeyNameAlreadyExistsError, { status: 409 })
      .addError(InternalServerError, { status: 500 })
      .setPath(Schema.Struct({ userId: UserId }))
      .setPayload(CreateApiKeyRequest)
      .middleware(Authentication)
  )
  .add(
    HttpApiEndpoint.get("listApiKeys", "/users/:userId/api-keys")
      .addSuccess(Schema.Array(ApiKeyResponse))
      .addError(ForbiddenError, { status: 403 })
      .addError(UserNotFoundError, { status: 404 })
      .addError(InternalServerError, { status: 500 })
      .setPath(Schema.Struct({ userId: UserId }))
      .middleware(Authentication)
  )
  .add(
    HttpApiEndpoint.del("deleteApiKey", "/users/:userId/api-keys/:keyId")
      .addSuccess(Schema.Void, { status: 204 })
      .addError(ForbiddenError, { status: 403 })
      .addError(InternalServerError, { status: 500 })
      .setPath(Schema.Struct({ userId: UserId, keyId: ApiKeyId }))
      .middleware(Authentication)
  )