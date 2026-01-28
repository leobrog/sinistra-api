# JWT Implementation Guide

This guide details how to implement the JWT token generation service using the `jose` library and Effect.

## 1. Install Dependencies

First, add the `jose` library for JWT handling.

```bash
bun add jose
```

## 2. Environment Configuration

Ensure your `.env` file contains the secret key.

```env
JWT_SECRET=your_super_secure_random_secret_key_at_least_32_chars
```

## 3. Implement JWT Service in `src/lib/jwt.ts`

We will implement a `JwtService` using Effect's `Context` and `Layer` to make it dependency-injectable. This ensures we can easily swap it out or mock it for testing.

**Copy the following code into `src/lib/jwt.ts`:**

```typescript
import { Effect, Context, Layer, Config, Redacted } from "effect"
import * as Jose from "jose"

// 1. Define the shape of our JWT Service
export class JwtService extends Context.Tag("JwtService")<
  JwtService,
  {
    readonly sign: (payload: Record<string, unknown>) => Effect.Effect<string>
    readonly verify: (token: string) => Effect.Effect<Jose.JWTPayload>
  }
>() {}

// 2. Define the implementation
// We use Config to safely retrieve the secret from the environment
const make = Effect.gen(function* () {
  // Config.redacted ensures the secret doesn't accidentally leak in logs
  const secret = yield* Config.string("JWT_SECRET").pipe(
    Config.map(Redacted.make)
  )
  
  const secretBytes = new TextEncoder().encode(Redacted.value(secret))

  const sign = (payload: Record<string, unknown>) =>
    Effect.tryPromise({
      try: () =>
        new Jose.SignJWT(payload)
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("24h") // Token valid for 24 hours
          .sign(secretBytes),
      catch: (error) => new Error(`Token signing failed: ${error}`),
    })

  const verify = (token: string) =>
    Effect.tryPromise({
      try: async () => {
        const { payload } = await Jose.jwtVerify(token, secretBytes)
        return payload
      },
      catch: (error) => new Error(`Token verification failed: ${error}`),
    })

  return { sign, verify }
})

// 3. Create the Layer for the application
export const JwtServiceLive = Layer.effect(JwtService, make)
```

## 4. Usage Example (For Future Reference)

Here is how you would use this service in your handlers (e.g., in `src/api/handlers.ts`):

```typescript
import { JwtService } from "../lib/jwt.ts"

// Inside your handler Effect.gen:
// const jwt = yield* JwtService
// const token = yield* jwt.sign({ sub: user.id, role: "user" })
```

And in your `main.ts` or wherever you compose your layers, you would provide it:

```typescript
import { JwtServiceLive } from "./lib/jwt.ts"

// ...
// .provide(JwtServiceLive)
```
