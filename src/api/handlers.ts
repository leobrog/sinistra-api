import { HttpApiBuilder } from "@effect/platform"
import { Effect, Layer, Option } from "effect"
import { Api } from "./index.ts"
import { UserRepository, ApiKeyRepository } from "../domain/repositories.ts"
import { UserId, HashedPassword, ApiKeyId, ApiKey } from "../domain/ids.ts"
import { User, UserApiKey } from "../domain/models.ts"
import { UserNotFoundError, InternalServerError, DatabaseError, PasswordHashingError, UserLoginError, ForbiddenError } from "../domain/errors.ts"
import { UserResponse, ApiKeyResponse, ApiKeyCreateResponse, UserLoginResponse } from "./dtos.ts"
import { JwtService } from "../lib/jwt.ts"
import { password as Pwd } from "bun"
import { AuthenticationLive } from "./middleware/auth.ts"
import { AuthenticatedUser } from "../domain/context.ts"

const catchDBError = (err: DatabaseError) =>
  Effect.logError("Database Error", err).pipe(
    Effect.andThen(Effect.fail(new InternalServerError({ message: "Internal Server Error" })))
  )

export const UsersHandlers = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers
    .handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const repo = yield* UserRepository

        const hash = yield* Effect.tryPromise({
          try: () => Pwd.hash(payload.password),
          catch: (error) => new PasswordHashingError({ cause: error })
        })

        // In a real app, inject a PasswordService here

        const hashedPassword = HashedPassword.make(hash)

        const newUser = new User({
          id: UserId.make(crypto.randomUUID()),
          email: payload.email,
          name: payload.name,
          password: hashedPassword,
          company: Option.fromNullable(payload.company),
          planTier: "free",
          createdAt: new Date(),
          updatedAt: new Date()
        })

        yield* repo.create(newUser)
        return new UserResponse({
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          company: newUser.company,
          planTier: newUser.planTier,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt
        })
      }).pipe(
        Effect.catchTags({
          DatabaseError: catchDBError,
          PasswordHashingError: (err) => Effect.logError("Password Hashing Error", err).pipe(
            Effect.andThen(Effect.fail(new InternalServerError({ message: "Hashing failed" })))
          )
        })
      )
    )
    .handle("login", ({ payload }) =>
      Effect.gen(function* () {
        const { email, password } = payload
        const repo = yield* UserRepository
        const jwt = yield* JwtService
        const userResult = yield* repo.findByEmail(email)

        const user = yield* Option.match(userResult, {
          onNone: () => Effect.fail(new UserLoginError({ message: "Invalid email or password" })),
          onSome: (u) => Effect.succeed(u)
        })

        const isPasswordValid = yield* Effect.tryPromise({
          try: () => Pwd.verify(password, user.password),
          catch: () => new UserLoginError({ message: "Invalid email or password" }) // Don't expose hashing errors
        })

        if (!isPasswordValid) {
          return yield* Effect.fail(new UserLoginError({ message: "Invalid email or password" }))
        }

        const token = yield* jwt.sign({
          sub: user.id,
          email: user.email,
          role: "user" // Example claim
        })

        return new UserLoginResponse({
          accessToken: token,
          user: {
            id: user.id, 
            email: user.email,
            planTier: user.planTier
          }
        })

      }).pipe(
        Effect.catchTags({
          DatabaseError: catchDBError,
          JwtSigningError: (err) => Effect.logError("Jwt Signing Error on Login", err).pipe(
            Effect.andThen(Effect.fail(new UserLoginError({ message: "Invalid email or password" })))
          )
        })
      )
    )
    .handle("findById", ({ path }) =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const { user: currentUser } = yield* AuthenticatedUser

        if(currentUser.id !== path.id) {
          return yield* Effect.fail(new ForbiddenError({ message: "Forbidden" }))
        }

        const user = yield* repo.findById(path.id)
        return yield* Option.match(user, {
          onNone: () => Effect.fail(new UserNotFoundError({ id: path.id })),
          onSome: (u) => Effect.succeed(new UserResponse({
            id: u.id,
            email: u.email,
            name: u.name,
            company: u.company,
            planTier: u.planTier,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt
          })),
        })
      }).pipe(
        Effect.catchTag("DatabaseError", catchDBError)
      )
    )
    .handle("delete", ({ path }) =>
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const { user: currentUser } = yield* AuthenticatedUser

        if(currentUser.id !== path.id) {
          return yield* Effect.fail(new ForbiddenError({ message: "Forbidden" }))
        }

        return yield* repo.delete(path.id)
      }).pipe(
        Effect.catchTag("DatabaseError", catchDBError)
      )
    )
    .handle("createApiKey", ({ path, payload }) =>
      Effect.gen(function* () {
        const userRepo = yield* UserRepository
        const apiKeyRepo = yield* ApiKeyRepository
        const { user: currentUser } = yield* AuthenticatedUser

        if(currentUser.id !== path.userId) {
          return yield* Effect.fail(new ForbiddenError({ message: "Forbidden" }))
        }

        // Ensure user exists
        const user = yield* userRepo.findById(path.userId)
        if (Option.isNone(user)) {
          return yield* Effect.fail(new UserNotFoundError({ id: path.userId }))
        }

        const rawKey = `sk_${crypto.randomUUID().replace(/-/g, "")}`
        const newApiKey = new UserApiKey({
          id: ApiKeyId.make(crypto.randomUUID()),
          userId: path.userId,
          key: ApiKey.make(rawKey),
          name: payload.name,
          expiresAt: Option.fromNullable(payload.expiresAt),
          lastUsedAt: Option.none(),
          createdAt: new Date(),
        })

        yield* apiKeyRepo.create(newApiKey)

        return new ApiKeyCreateResponse({
          id: newApiKey.id,
          userId: newApiKey.userId,
          key: newApiKey.key,
          name: newApiKey.name,
          lastUsedAt: newApiKey.lastUsedAt,
          expiresAt: newApiKey.expiresAt,
          createdAt: newApiKey.createdAt,
        })
      }).pipe(
        Effect.catchTag("DatabaseError", catchDBError)
      )
    )
    .handle("listApiKeys", ({ path }) =>
      Effect.gen(function* () {
        const userRepo = yield* UserRepository
        const apiKeyRepo = yield* ApiKeyRepository
        const { user: currentUser } = yield* AuthenticatedUser

        if(currentUser.id !== path.userId) {
          return yield* Effect.fail(new ForbiddenError({ message: "Forbidden" }))
        }

        // Ensure user exists
        const user = yield* userRepo.findById(path.userId)
        if (Option.isNone(user)) {
          return yield* Effect.fail(new UserNotFoundError({ id: path.userId }))
        }

        const apiKeys = yield* apiKeyRepo.findByUserId(path.userId)

        return apiKeys.map(k => new ApiKeyResponse({
          id: k.id,
          userId: k.userId,
          name: k.name,
          lastUsedAt: k.lastUsedAt,
          expiresAt: k.expiresAt,
          createdAt: k.createdAt,
        }))
      }).pipe(
        Effect.catchTag("DatabaseError", catchDBError)
      )
    )
    .handle("deleteApiKey", ({ path }) =>
      Effect.gen(function* () {
        const { user: currentUser } = yield* AuthenticatedUser

        if(currentUser.id !== path.userId) {
          return yield* Effect.fail(new ForbiddenError({ message: "Forbidden" }))
        }
        const apiKeyRepo = yield* ApiKeyRepository
        yield* apiKeyRepo.delete(path.keyId)
      }).pipe(
        Effect.catchTag("DatabaseError", catchDBError)
      )
    )
)


export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(UsersHandlers),
  Layer.provide(AuthenticationLive)
)
