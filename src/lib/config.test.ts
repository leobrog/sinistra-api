import { describe, expect, test } from "bun:test"
import { ConfigProvider, Effect, Layer } from "effect"
import { AppConfig, AppConfigLive } from "./config.ts"

describe("AppConfig", () => {
  test("should load config with all required values", () => {
    const testConfigProvider = ConfigProvider.fromMap(
      new Map([
        ["DATABASE_URL", "file:./test.db"],
        ["EDDN_DATABASE_URL", "file:./test_eddn.db"],
        ["PORT", "4000"],
        ["HOST", "127.0.0.1"],
        ["NODE_ENV", "test"],
        ["SERVER_NAME", "Test Server"],
        ["SERVER_DESCRIPTION", "Test Description"],
        ["SERVER_URL", "http://test:4000"],
        ["API_VERSION", "1.0.0"],
        ["API_KEY", "test-api-key"],
        ["FRONTEND_URL", "http://test:5000"],
        ["FACTION_NAME", "Test Faction"],
        ["JWT_SECRET", "test-jwt-secret"],
        ["JWT_EXPIRES_IN", "1d"],
        ["DISCORD_CLIENT_ID", "test-client-id"],
        ["DISCORD_CLIENT_SECRET", "test-client-secret"],
        ["DISCORD_REDIRECT_URI", "http://test:4000/callback"],
        ["DISCORD_BOT_TOKEN", "test-bot-token"],
        ["DISCORD_SERVER_ID", "test-server-id"],
        ["INARA_API_KEY", "test-inara-key"],
        ["INARA_APP_NAME", "TestApp"],
        ["INARA_API_URL", "https://test.inara.cz"],
        ["EDDN_ZMQ_URL", "tcp://test:9500"],
        ["EDDN_CLEANUP_INTERVAL_MS", "1000"],
        ["EDDN_MESSAGE_RETENTION_MS", "2000"],
        ["TICK_POLL_INTERVAL_MS", "3000"],
        ["TICK_API_URL", "https://test.ticks"],
        ["ENABLE_SCHEDULERS", "false"],
      ])
    )

    const program = Effect.gen(function* () {
      const config = yield* AppConfig
      return config
    })

    const result = program.pipe(
      Effect.provide(AppConfigLive),
      Effect.withConfigProvider(testConfigProvider),
      Effect.runSync
    )

    expect(result.database.url).toBe("file:./test.db")
    expect(result.database.eddnUrl).toBe("file:./test_eddn.db")
    expect(result.server.port).toBe(4000)
    expect(result.server.host).toBe("127.0.0.1")
    expect(result.server.nodeEnv).toBe("test")
    expect(result.server.name).toBe("Test Server")
    expect(result.server.description).toBe("Test Description")
    expect(result.server.url).toBe("http://test:4000")
    expect(result.server.apiVersion).toBe("1.0.0")
    expect(result.server.apiKey).toBe("test-api-key")
    expect(result.server.frontendUrl).toBe("http://test:5000")
    expect(result.faction.name).toBe("Test Faction")
    expect(result.jwt.secret).toBe("test-jwt-secret")
    expect(result.jwt.expiresIn).toBe("1d")
    expect(result.discord.oauth.clientId).toBe("test-client-id")
    expect(result.discord.oauth.clientSecret).toBe("test-client-secret")
    expect(result.discord.oauth.redirectUri).toBe("http://test:4000/callback")
    expect(result.discord.bot.token).toBe("test-bot-token")
    expect(result.discord.bot.serverId).toBe("test-server-id")
    expect(result.inara.apiKey).toBe("test-inara-key")
    expect(result.inara.appName).toBe("TestApp")
    expect(result.inara.apiUrl).toBe("https://test.inara.cz")
    expect(result.eddn.zmqUrl).toBe("tcp://test:9500")
    expect(result.eddn.cleanupIntervalMs).toBe(1000)
    expect(result.eddn.messageRetentionMs).toBe(2000)
    expect(result.tick.pollIntervalMs).toBe(3000)
    expect(result.tick.apiUrl).toBe("https://test.ticks")
    expect(result.schedulers.enabled).toBe(false)
  })

  test("should use default values when env vars are not provided", () => {
    const testConfigProvider = ConfigProvider.fromMap(
      new Map([
        ["JWT_SECRET", "required-secret"],
        ["DISCORD_CLIENT_ID", "required-client-id"],
        ["DISCORD_CLIENT_SECRET", "required-client-secret"],
        ["DISCORD_BOT_TOKEN", "required-bot-token"],
        ["DISCORD_SERVER_ID", "required-server-id"],
        ["INARA_API_KEY", "required-inara-key"],
        ["API_KEY", "required-api-key"],
      ])
    )

    const program = Effect.gen(function* () {
      const config = yield* AppConfig
      return config
    })

    const result = program.pipe(
      Effect.provide(AppConfigLive),
      Effect.withConfigProvider(testConfigProvider),
      Effect.runSync
    )

    expect(result.database.url).toBe("file:./db/sinistra.db")
    expect(result.server.port).toBe(3000)
    expect(result.server.host).toBe("0.0.0.0")
    expect(result.server.nodeEnv).toBe("development")
    expect(result.server.apiVersion).toBe("2.0.0")
    expect(result.faction.name).toBe("Communism Interstellar Union")
    expect(result.jwt.expiresIn).toBe("7d")
    expect(result.schedulers.enabled).toBe(true)
  })

  test("should handle optional webhook configs", () => {
    const testConfigProvider = ConfigProvider.fromMap(
      new Map([
        ["JWT_SECRET", "required-secret"],
        ["DISCORD_CLIENT_ID", "required-client-id"],
        ["DISCORD_CLIENT_SECRET", "required-client-secret"],
        ["DISCORD_BOT_TOKEN", "required-bot-token"],
        ["DISCORD_SERVER_ID", "required-server-id"],
        ["INARA_API_KEY", "required-inara-key"],
        ["API_KEY", "required-api-key"],
        ["DISCORD_BGS_WEBHOOK", "https://discord.webhook.bgs"],
        ["DISCORD_SHOUTOUT_WEBHOOK", "https://discord.webhook.shoutout"],
      ])
    )

    const program = Effect.gen(function* () {
      const config = yield* AppConfig
      return config
    })

    const result = program.pipe(
      Effect.provide(AppConfigLive),
      Effect.withConfigProvider(testConfigProvider),
      Effect.runSync
    )

    expect(result.discord.webhooks.bgs._tag).toBe("Some")
    expect(result.discord.webhooks.shoutout._tag).toBe("Some")
    expect(result.discord.webhooks.conflict._tag).toBe("None")
    expect(result.discord.webhooks.debug._tag).toBe("None")
  })
})
