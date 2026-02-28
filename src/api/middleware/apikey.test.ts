import { describe, it, expect, spyOn } from "bun:test"
import { Effect, Layer, Redacted } from "effect"
import { AppConfig } from "../../lib/config.js"
import { ApiKeyAuth, ApiKeyAuthLive } from "./apikey.js"

describe("ApiKeyAuth", () => {
  const testConfig = {
    database: {
      url: "file::memory:",
      eddnUrl: "file::memory:",
    },
    server: {
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
    faction: {
      name: "Test Faction",
    },
    jwt: {
      secret: "test-jwt-secret",
      expiresIn: "7d",
    },
    discord: {
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
        bgs: [],
        shoutout: [],
        conflict: [],
        debug: [],
      },
    },
    inara: {
      apiKey: "test-inara-key",
      appName: "Test",
      apiUrl: "https://inara.cz/inapi/v1/",
    },
    eddn: {
      zmqUrl: "tcp://localhost:9500",
      cleanupIntervalMs: 3600000,
      messageRetentionMs: 86400000,
    },
    tick: {
      pollIntervalMs: 300000,
      apiUrl: "https://elitebgs.app/api/ebgs/v5/ticks",
    },
    schedulers: {
      enabled: false,
    },
  }

  const TestConfigLayer = Layer.succeed(AppConfig, testConfig as any)
  const TestLayer = ApiKeyAuthLive.pipe(Layer.provide(TestConfigLayer))

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, TestLayer as any) as Effect.Effect<any, any, never>)

  it("should allow request with valid API key", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const auth = yield* ApiKeyAuth
        return yield* (auth as any).apiKey(Redacted.make("test-api-key-12345"))
      })
    )

    // void return means undefined
    expect(result).toBeUndefined()
  })

  it("should reject request with invalid API key", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const auth = yield* ApiKeyAuth
        return yield* (auth as any).apiKey(Redacted.make("invalid-key"))
      }).pipe(Effect.provide(TestLayer as any)) as any
    )

    expect(exit._tag).toBe("Failure")
  })

  it("should redact long API keys in logs", async () => {
    const consoleWarnSpy = spyOn(console, "warn")

    await Effect.runPromiseExit(
      Effect.gen(function* () {
        const auth = yield* ApiKeyAuth
        return yield* (auth as any).apiKey(Redacted.make("verylongapikey123456789"))
      }).pipe(Effect.provide(TestLayer as any)) as any
    )

    const calls = consoleWarnSpy.mock.calls.map((call: any[]) => call.join(" "))
    const hasRedactedKey = calls.some((call: string) => call.includes("verylon") && call.includes("***"))
    expect(hasRedactedKey).toBe(true)
  })
})
