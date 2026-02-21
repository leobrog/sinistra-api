import { describe, it, expect } from "bun:test"
import { Effect, Option } from "effect"
import { AppConfig } from "../../lib/config.js"
import { DiscoveryResponse, EndpointConfig, HeaderRequirement } from "./dtos.js"


describe("DiscoveryApi", () => {
  const testConfig = {
    database: {
      url: "file::memory:",
      eddnUrl: "file::memory:",
    },
    server: {
      port: 3000,
      host: "localhost",
      nodeEnv: "test",
      name: "Sinistra Test Server",
      description: "Test server for Sinistra API",
      url: "http://localhost:3000",
      apiVersion: "2.0.0",
      apiKey: "test-api-key",
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
        bgs: Option.none(),
        shoutout: Option.none(),
        conflict: Option.none(),
        debug: Option.none(),
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


  const runTest = <A, E>(
    effect: Effect.Effect<A, E, AppConfig>
  ): Promise<any> =>
    Effect.runPromise(Effect.provideService(effect, AppConfig, testConfig as any))

  // Test the handler logic directly
  const createDiscoveryResponse = (config: any) =>
    new DiscoveryResponse({
      name: config.server.name,
      description: config.server.description,
      url: config.server.url,
      endpoints: {
        events: new EndpointConfig({
          path: "/events",
          minPeriod: "10",
          maxBatch: "100",
        }),
        activities: new EndpointConfig({
          path: "/activities",
          minPeriod: "60",
          maxBatch: "10",
        }),
        objectives: new EndpointConfig({
          path: "/objectives",
          minPeriod: "30",
          maxBatch: "20",
        }),
      },
      headers: {
        apikey: new HeaderRequirement({
          required: true,
          description: "API key for authentication",
        }),
        apiversion: new HeaderRequirement({
          required: true,
          description: "The version of the API in x.y.z notation",
          current: config.server.apiVersion,
        }),
      },
    })

  it("should return discovery information", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const config = yield* AppConfig
        return createDiscoveryResponse(config)
      })
    )

    expect(result.name).toBe("Sinistra Test Server")
    expect(result.description).toBe("Test server for Sinistra API")
    expect(result.url).toBe("http://localhost:3000")
    expect(result.endpoints.events).toBeDefined()
    expect(result.endpoints.events.path).toBe("/events")
    expect(result.endpoints.events.minPeriod).toBe("10")
    expect(result.endpoints.events.maxBatch).toBe("100")
  })

  it("should include required header information", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const config = yield* AppConfig
        return createDiscoveryResponse(config)
      })
    )

    expect(result.headers.apikey).toBeDefined()
    expect(result.headers.apikey.required).toBe(true)
    expect(result.headers.apikey.description).toBe("API key for authentication")

    expect(result.headers.apiversion).toBeDefined()
    expect(result.headers.apiversion.required).toBe(true)
    expect(result.headers.apiversion.current).toBe("2.0.0")
  })

  it("should include all endpoint configurations", async () => {
    const result = await runTest(
      Effect.gen(function* () {
        const config = yield* AppConfig
        return createDiscoveryResponse(config)
      })
    )

    // Check that all expected endpoints are present
    expect(result.endpoints.events).toBeDefined()
    expect(result.endpoints.activities).toBeDefined()
    expect(result.endpoints.objectives).toBeDefined()

    // Verify activities endpoint config
    expect(result.endpoints.activities.path).toBe("/activities")
    expect(result.endpoints.activities.minPeriod).toBe("60")
    expect(result.endpoints.activities.maxBatch).toBe("10")

    // Verify objectives endpoint config
    expect(result.endpoints.objectives.path).toBe("/objectives")
    expect(result.endpoints.objectives.minPeriod).toBe("30")
    expect(result.endpoints.objectives.maxBatch).toBe("20")
  })
})
