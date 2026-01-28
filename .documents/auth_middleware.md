# Authentication Middleware Implementation Plan

This document outlines the steps to implement authentication using the `@effect/platform` HttpApi system.

## 1. Define Authenticated Context

Create a context tag to hold the authenticated user's information.

**File:** `src/domain/context.ts`
```typescript
import { Context } from "effect"
import { User } from "./models.ts"

export class AuthenticatedUser extends Context.Tag("AuthenticatedUser")<
  AuthenticatedUser,
  {
    readonly user: User
  }
>() {}
```

## 2. Define Middleware (Tag & Implementation)

We define both the Middleware Tag (the interface) and its Implementation (the logic) in the same file to keep them co-located.

**File:** `src/api/middleware/auth.ts`
```typescript
import { HttpApiMiddleware, HttpApiSecurity, HttpApiBuilder } from "@effect/platform"
import { Effect, Layer, Redacted, Option } from "effect"
import { UserLoginError } from "../../domain/errors.ts"
import { AuthenticatedUser } from "../../domain/context.ts"
import { JwtService } from "../../lib/jwt.ts"
import { UserRepository } from "../../domain/repositories.ts"
import { UserId } from "../../domain/ids.ts"

// 1. Middleware Tag (Interface)
export class Authentication extends HttpApiMiddleware.Tag<Authentication>()("Authentication", {
  failure: UserLoginError,
  provides: AuthenticatedUser,
  security: {
    bearer: HttpApiSecurity.bearer // Declares dependency on Bearer token
  }
}) {}

// 2. Middleware Implementation (Live Layer)
export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    // Resolve dependencies (runs once at startup)
    const jwt = yield* JwtService
    const userRepo = yield* UserRepository

    // Return the effect that runs per-request
    return Effect.gen(function* () {
      // Decode the Bearer token from the request
      const token = yield* HttpApiBuilder.securityDecode(HttpApiSecurity.bearer)

      // Verify Token
      const payload = yield* jwt.verify(Redacted.value(token)).pipe(
        Effect.catchAll(() => Effect.fail(new UserLoginError({ message: "Invalid token" })))
      )

      if (!payload.sub) {
        return yield* Effect.fail(new UserLoginError({ message: "Invalid token subject" }))
      }

      // Fetch User
      const user = yield* userRepo.findById(UserId.make(payload.sub))

      // Return Authenticated Context
      return yield* Option.match(user, {
        onNone: () => Effect.fail(new UserLoginError({ message: "User not found" })),
        onSome: (u) => Effect.succeed(AuthenticatedUser.of({ user: u }))
      })
    })
  })
)
```

## 3. Apply Middleware to Endpoints

Update the API definition to enforce authentication on protected routes.

**File:** `src/api/users.ts`
```typescript
import { Authentication } from "./middleware/auth.ts"
import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
// ... other imports

export const UsersApi = HttpApiGroup.make("users")
  // Public Routes...
  .add(...)

  // Protected Routes
  .add(
    HttpApiEndpoint.get("findById", "/users/:id")
      // ... existing setup
      .middleware(Authentication) // <--- Apply Middleware Tag
  )
  .add(
    HttpApiEndpoint.del("delete", "/users/:id")
      .middleware(Authentication)
  )
  .add(
    HttpApiEndpoint.post("createApiKey", "/users/:userId/api-keys")
      .middleware(Authentication)
  )
  .add(
    HttpApiEndpoint.get("listApiKeys", "/users/:userId/api-keys")
      .middleware(Authentication)
  )
  .add(
    HttpApiEndpoint.del("deleteApiKey", "/users/:userId/api-keys/:keyId")
      .middleware(Authentication)
  )
```

## 4. Provide Middleware Layer

In your `src/api/handlers.ts` (or `main.ts`), provide the `AuthenticationLive` layer to the application. This connects the API definition to the actual implementation.

**File:** `src/api/handlers.ts`
```typescript
import { AuthenticationLive } from "./middleware/auth.ts"
import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
// ... imports

// ... handlers definition ...

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(UsersHandlers),
  Layer.provide(AuthenticationLive) // <--- Provide the Auth implementation
)
```

## 5. Usage in Handlers

Inside protected handlers, you can now access the `AuthenticatedUser` context.

**File:** `src/api/handlers.ts`
```typescript
.handle("findById", ({ path }) =>
  Effect.gen(function* () {
    const { user: currentUser } = yield* AuthenticatedUser
    
    // Authorization Check: Ensure user is accessing their own data
    if (currentUser.id !== path.id) {
       // yield* Effect.fail(new ForbiddenError(...))
    }
    
    // ...
  })
)
```