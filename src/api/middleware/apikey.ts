/**
 * API Key authentication middleware
 *
 * Validates apikey and apiversion headers for external client requests
 */

import { Context, Effect, Schema } from "effect"
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { AppConfig } from "../../lib/config"

// Create a Tag for AppConfig service
const AppConfigTag = Context.GenericTag<AppConfig>("AppConfig")

/**
 * API Key authentication errors
 */
export class InvalidApiKeyError extends Schema.TaggedError<InvalidApiKeyError>()(
  "InvalidApiKeyError",
  {
    message: Schema.String,
  }
) {}

export class MissingApiVersionError extends Schema.TaggedError<MissingApiVersionError>()(
  "MissingApiVersionError",
  {
    message: Schema.String,
  }
) {}

export class InvalidApiVersionFormatError extends Schema.TaggedError<InvalidApiVersionFormatError>()(
  "InvalidApiVersionFormatError",
  {
    message: Schema.String,
  }
) {}

/**
 * Validate API version format (x.y.z)
 */
const validateApiVersionFormat = (version: string): boolean => {
  const versionRegex = /^\d+\.\d+\.\d+$/
  return versionRegex.test(version)
}

/**
 * API Key authentication middleware
 *
 * Validates:
 * - apikey header matches configured API key
 * - apiversion header is present and has valid format (x.y.z)
 *
 * Returns:
 * - 401 if API key is invalid
 * - 400 if API version is missing or has invalid format
 */
export const ApiKeyAuthMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const config = yield* AppConfigTag

    // Get apikey header
    const apikey = request.headers["apikey"]
    if (!apikey || apikey !== config.server.apiKey) {
      // Redact API key for security logging
      const redactedKey = apikey && apikey.length > 8 ? `${apikey.slice(0, 8)}***` : "***"
      console.warn(`Invalid API key received: ${redactedKey}`)

      return yield* HttpServerResponse.json(
        { error: "Unauthorized: Invalid API key" },
        { status: 401 }
      )
    }

    // Get apiversion header
    const apiversion = request.headers["apiversion"]
    if (!apiversion) {
      return yield* HttpServerResponse.json(
        { error: "Missing required header: apiversion" },
        { status: 400 }
      )
    }

    // Validate apiversion format
    if (!validateApiVersionFormat(apiversion)) {
      return yield* HttpServerResponse.json(
        { error: "Invalid apiversion format. Expected x.y.z notation" },
        { status: 400 }
      )
    }

    // Log warning if client version differs from server version
    if (apiversion !== config.server.apiVersion) {
      console.warn(
        `Client using different API version: ${apiversion} (server: ${config.server.apiVersion})`
      )
    }

    // Authentication successful, proceed with request
    return yield* app
  })
)
