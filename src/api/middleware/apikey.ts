/**
 * API Key authentication middleware
 *
 * Validates apikey and apiversion headers for external client requests
 */

import { Effect, Layer, Schema } from "effect"
import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { AppConfig } from "../../lib/config.ts"

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
      apiKey: (apikey: string, context) =>
        Effect.gen(function* () {
          // Validate API key
          if (apikey !== config.server.apiKey) {
            // Redact API key for security logging
            const redactedKey = apikey && apikey.length > 8 ? `${apikey.slice(0, 8)}***` : "***"
            console.warn(`Invalid API key received: ${redactedKey}`)
            return yield* Effect.fail(new ApiKeyError({ message: "Unauthorized: Invalid API key" }))
          }

          // Get apiversion header from request
          const request = context.request
          const apiversion = request.headers["apiversion"]

          if (!apiversion) {
            return yield* Effect.fail(new ApiKeyError({ message: "Missing required header: apiversion" }))
          }

          // Validate apiversion format (x.y.z)
          const versionRegex = /^\d+\.\d+\.\d+$/
          if (!versionRegex.test(apiversion)) {
            return yield* Effect.fail(
              new ApiKeyError({ message: "Invalid apiversion format. Expected x.y.z notation" })
            )
          }

          // Log warning if client version differs from server version
          if (apiversion !== config.server.apiVersion) {
            console.warn(
              `Client using different API version: ${apiversion} (server: ${config.server.apiVersion})`
            )
          }

          // Authentication successful - return void (no context provided)
          return
        })
    }
  })
)
