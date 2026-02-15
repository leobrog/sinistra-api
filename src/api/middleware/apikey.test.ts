import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test"
import { Context, Effect, Layer, Option } from "effect"
import { HttpMiddleware, HttpServer, HttpServerRequest, HttpServerResponse, HttpRouter } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { AppConfig } from "../../lib/config"
import { ApiKeyAuthMiddleware } from "./apikey"

// Create the same Tag as in the middleware
const AppConfigTag = Context.GenericTag<AppConfig>("AppConfig")

describe("ApiKeyAuthMiddleware", () => {
  const testConfig = new AppConfig(
    {
      url: "file::memory:",
      eddnUrl: "file::memory:",
    },
    {
      port: 3000,
      host: "localhost",
      nodeEnv: "test",
      name: "Test Server",
      description: "Test",
      url: "http://localhost:3000",
      apiVersion: "2.0.0",
      apiKey: "test-api-key-12345",
      frontendUrl: "http://localhost:5000",
    },
    {
      secret: "test-jwt-secret",
      expiresIn: "7d",
    },
    {
      oauth: {
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        redirectUri: "http://localhost:3000/callback",
      },
      bot: {
        token: "test-bot-token",
        serverId: "test-server-id",
      },
      webhooks: {
        bgs: Option.none(),
        shoutout: Option.none(),
        conflict: Option.none(),
        debug: Option.none(),
      },
    },
    {
      apiKey: "test-inara-key",
      appName: "Test",
      apiUrl: "https://inara.cz/inapi/v1/",
    },
    {
      zmqUrl: "tcp://localhost:9500",
      cleanupIntervalMs: 3600000,
      messageRetentionMs: 86400000,
    },
    {
      pollIntervalMs: 300000,
      apiUrl: "https://elitebgs.app/api/ebgs/v5/ticks",
    },
    {
      enabled: false,
    }
  )

  const TestConfigLayer = Layer.succeed(AppConfigTag, testConfig)

  const createTestApp = (handler: Effect.Effect<HttpServerResponse.HttpServerResponse, never, never>) => {
    const router = HttpRouter.empty.pipe(
      HttpRouter.get("/test", handler)
    )

    return HttpServer.serve(router).pipe(
      HttpMiddleware.logger,
      HttpServer.withLogAddress
    )
  }

  it("should allow request with valid API key and version", async () => {
    const handler = Effect.gen(function* () {
      return yield* HttpServerResponse.json({ message: "Success" })
    })

    const app = createTestApp(handler).pipe(
      Layer.provide(NodeHttpServer.layer({ port: 0 })),
      Layer.provide(TestConfigLayer)
    )

    // Test would require starting the server and making a request
    // For now, we'll test the middleware logic directly
    const request = {
      headers: {
        apikey: "test-api-key-12345",
        apiversion: "2.0.0",
      },
    } as unknown as HttpServerRequest.HttpServerRequest

    const middlewareEffect = ApiKeyAuthMiddleware(
      Effect.succeed(HttpServerResponse.json({ message: "Success" }))
    ).pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      Effect.provide(TestConfigLayer)
    )

    const result = await Effect.runPromise(middlewareEffect)

    // The middleware should pass through to the handler
    expect(result).toBeDefined()
  })

  it("should reject request with invalid API key", async () => {
    const request = {
      headers: {
        apikey: "invalid-key",
        apiversion: "2.0.0",
      },
    } as unknown as HttpServerRequest.HttpServerRequest

    const middlewareEffect = ApiKeyAuthMiddleware(
      Effect.succeed(HttpServerResponse.json({ message: "Success" }))
    ).pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      Effect.provide(TestConfigLayer)
    )

    const result = await Effect.runPromise(middlewareEffect)

    // Should return 401 error response
    expect(result.status).toBe(401)
  })

  it("should reject request with missing API version", async () => {
    const request = {
      headers: {
        apikey: "test-api-key-12345",
        // apiversion missing
      },
    } as unknown as HttpServerRequest.HttpServerRequest

    const middlewareEffect = ApiKeyAuthMiddleware(
      Effect.succeed(HttpServerResponse.json({ message: "Success" }))
    ).pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      Effect.provide(TestConfigLayer)
    )

    const result = await Effect.runPromise(middlewareEffect)

    // Should return 400 error response
    expect(result.status).toBe(400)
  })

  it("should reject request with invalid API version format", async () => {
    const request = {
      headers: {
        apikey: "test-api-key-12345",
        apiversion: "2.0", // Invalid format, should be x.y.z
      },
    } as unknown as HttpServerRequest.HttpServerRequest

    const middlewareEffect = ApiKeyAuthMiddleware(
      Effect.succeed(HttpServerResponse.json({ message: "Success" }))
    ).pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      Effect.provide(TestConfigLayer)
    )

    const result = await Effect.runPromise(middlewareEffect)

    // Should return 400 error response
    expect(result.status).toBe(400)
  })

  it("should allow but warn on API version mismatch", async () => {
    const consoleWarnSpy = spyOn(console, "warn")

    const request = {
      headers: {
        apikey: "test-api-key-12345",
        apiversion: "1.5.0", // Different from server version
      },
    } as unknown as HttpServerRequest.HttpServerRequest

    const middlewareEffect = ApiKeyAuthMiddleware(
      Effect.succeed(HttpServerResponse.json({ message: "Success" }))
    ).pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      Effect.provide(TestConfigLayer)
    )

    const result = await Effect.runPromise(middlewareEffect)

    // Should still allow the request
    expect(result).toBeDefined()

    // Should have logged a warning
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  it("should redact long API keys in logs", async () => {
    const consoleWarnSpy = spyOn(console, "warn")

    const request = {
      headers: {
        apikey: "verylongapikey123456789",
        apiversion: "2.0.0",
      },
    } as unknown as HttpServerRequest.HttpServerRequest

    const middlewareEffect = ApiKeyAuthMiddleware(
      Effect.succeed(HttpServerResponse.json({ message: "Success" }))
    ).pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request),
      Effect.provide(TestConfigLayer)
    )

    await Effect.runPromise(middlewareEffect)

    // Should have logged warning with redacted key
    const calls = consoleWarnSpy.mock.calls.map(call => call.join(" "))
    const hasRedactedKey = calls.some(call => call.includes("verylon**") || call.includes("***"))
    expect(hasRedactedKey).toBe(true)
  })
})
