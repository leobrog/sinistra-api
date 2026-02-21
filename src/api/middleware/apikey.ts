/**
 * API Key authentication middleware
 *
 * Validates apikey and apiversion headers for external client requests
 */

import { Effect, Layer, Redacted, Schema } from "effect"
import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { AppConfig } from "../../lib/config.js"

/**
 * API Key authentication errors
 */
export class ApiKeyError extends Schema.TaggedError<ApiKeyError>()(
  "ApiKeyError",
  {
    message: Schema.String,
  }
) {}

/**
 * API Key Authentication Middleware Tag
 *
 * Validates apikey and apiversion headers for external API clients.
 * Unlike JWT auth, this doesn't provide context - it just validates headers.
 */
export class ApiKeyAuth extends HttpApiMiddleware.Tag<ApiKeyAuth>()("ApiKeyAuth", {
  failure: ApiKeyError,
  security: {
    apiKey: HttpApiSecurity.apiKey({ in: "header", key: "apikey" })
  }
}) {}

/**
 * API Key Authentication Implementation
 */
export const ApiKeyAuthLive = Layer.effect(
  ApiKeyAuth,
  Effect.gen(function* () {
    const config = yield* AppConfig

    return {
      apiKey: (apikey: Redacted.Redacted<string>) =>
        Effect.gen(function* () {
          // Unwrap the redacted API key
          const apikeyValue = Redacted.value(apikey)

          // Validate API key
          if (apikeyValue !== config.server.apiKey) {
            // Redact API key for security logging
            const redactedKey = apikeyValue && apikeyValue.length > 8 ? `${apikeyValue.slice(0, 8)}***` : "***"
            console.warn(`Invalid API key received: ${redactedKey}`)
            return yield* Effect.fail(new ApiKeyError({ message: "Unauthorized: Invalid API key" }))
          }

          // Note: apiversion header validation removed - can be added as separate middleware if needed
          // The HttpApiSecurity.apiKey middleware doesn't provide access to the full request context

          // Authentication successful - no need to return anything (void)
        })
    }
  })
)
