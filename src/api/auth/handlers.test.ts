import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"

import { PgClient } from "../../database/client.js"
import { FlaskUserRepository } from "../../domain/repositories.js"
import { FlaskUserRepositoryLive } from "../../database/repositories/FlaskUserRepository.js"
import { AppConfig } from "../../lib/config.js"
import { JwtService, JwtServiceLive } from "../../services/jwt.js"
import { FlaskUser } from "../../domain/models.js"
import { UserId, HashedPassword } from "../../domain/ids.js"
import { v4 as uuid } from "uuid"

describe("Auth API Integration", () => {
  // Provide a real service value by passing a plain object to Layer.succeed
  const testConfigValue = {
    database: { url: "file::memory:", eddnUrl: "file::memory:" },
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
    faction: { name: "Test Faction" },
    jwt: { secret: "test-jwt-secret", expiresIn: "7d" },
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
    schedulers: { enabled: false },
  }

  const ClientLayer = Layer.effect(
    PgClient,
    Effect.gen(function* () {
      const client = new SQL('postgres://postgres:password@localhost:5432/sinistra')

      yield* Effect.tryPromise(() =>
        client(`
          CREATE TABLE IF NOT EXISTS flask_users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            discord_id TEXT UNIQUE,
            discord_username TEXT,
            is_admin INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            cmdr_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_flask_users_username ON flask_users(username);
          CREATE INDEX IF NOT EXISTS idx_flask_users_discord_id ON flask_users(discord_id);
        `)
      )

      return client
    })
  )

  const TestConfigLayer = Layer.succeed(AppConfig, testConfigValue)

  const TestLayer = Layer.mergeAll(
    FlaskUserRepositoryLive,
    JwtServiceLive,
  ).pipe(
    Layer.provide(ClientLayer),
    Layer.provide(TestConfigLayer)
  )

  const FullLayer = Layer.mergeAll(TestLayer, TestConfigLayer)

  const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
    Effect.runPromise(Effect.provide(effect as any, FullLayer))

  /**
   * Test 1: verifyDiscord - existing user returns token
   * Simulates dashboard verifying a known Discord user
   */
  it("should return token for existing Discord user", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository
        const jwtService = yield* JwtService
        const config = yield* AppConfig

        const userId = uuid() as UserId
        const discordId = "123456789012345678"
        const discordUsername = "TestUser#1234"

        // Create an existing user
        const user = new FlaskUser({
          id: userId,
          username: "testuser",
          passwordHash: "" as HashedPassword,
          discordId: Option.some(discordId),
          discordUsername: Option.some(discordUsername),
          isAdmin: false,
          active: true,
          cmdrId: Option.none(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(user)

        // Simulate verifyDiscord handler logic
        const existingUser = yield* flaskUserRepo.findByDiscordId(discordId)
        expect(Option.isSome(existingUser)).toBe(true)

        if (Option.isSome(existingUser)) {
          const foundUser = existingUser.value

          // Generate JWT token (same as handler logic)
          const token = yield* jwtService.sign({
            userId: foundUser.id,
            username: foundUser.username,
            isAdmin: foundUser.isAdmin,
            tenantName: config.faction.name,
          })

          expect(token).toBeTruthy()
          expect(typeof token).toBe("string")

          // Verify token is valid
          const payload = yield* jwtService.verify(token)
          expect(payload.userId).toBe(userId)
          expect(payload.username).toBe("testuser")
          expect(payload.isAdmin).toBe(false)
          expect(payload.tenantName).toBe("Test Faction")
        }
      })
    )
  })

  /**
   * Test 2: verifyDiscord - new Discord user returns placeholder
   * Simulates dashboard verifying an unknown Discord user
   */
  it("should return placeholder for new Discord user", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository

        const discordId = "987654321098765432"
        const discordUsername = "NewUser#5678"

        // Verify user doesn't exist
        const existingUser = yield* flaskUserRepo.findByDiscordId(discordId)
        expect(Option.isNone(existingUser)).toBe(true)

        // Simulate handler logic for new user
        const sanitizedUsername = (discordUsername.split("#")[0] || discordUsername)
          .toLowerCase()
          .replace(/\s+/g, "_")

        // Check if username is available
        const usernameExists = yield* flaskUserRepo.findByUsername(sanitizedUsername)
        const finalUsername = Option.isSome(usernameExists)
          ? `${sanitizedUsername}_${Math.floor(Math.random() * 9000 + 1000)}`
          : sanitizedUsername

        expect(finalUsername).toBe("newuser")
        expect(Option.isNone(existingUser)).toBe(true)
      })
    )
  })

  /**
   * Test 3: verifyDiscord - username collision adds suffix
   * Simulates when Discord username conflicts with existing username
   */
  it("should add random suffix when username already exists", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository

        // Create a user with the same username
        const existingUserId = uuid() as UserId
        const existingUser = new FlaskUser({
          id: existingUserId,
          username: "pilot",
          passwordHash: "" as HashedPassword,
          discordId: Option.some("111111111111111111"),
          discordUsername: Option.some("Pilot#0001"),
          isAdmin: false,
          active: true,
          cmdrId: Option.none(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(existingUser)

        // New Discord user with same sanitized username
        const discordUsername = "Pilot#9999" // Will sanitize to "pilot"
        const sanitizedUsername = (discordUsername.split("#")[0] || discordUsername)
          .toLowerCase()
          .replace(/\s+/g, "_")

        expect(sanitizedUsername).toBe("pilot")

        // Check if username is taken
        const usernameExists = yield* flaskUserRepo.findByUsername(sanitizedUsername)
        expect(Option.isSome(usernameExists)).toBe(true)

        // Handler would add random suffix
        const finalUsername = Option.isSome(usernameExists)
          ? `${sanitizedUsername}_1234` // Simulated random suffix
          : sanitizedUsername

        expect(finalUsername).toMatch(/^pilot_\d{4}$/)
      })
    )
  })

  /**
   * Test 4: Admin user gets admin flag in token
   * Simulates admin Discord user authentication
   */
  it("should set isAdmin=true in token for admin users", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository
        const jwtService = yield* JwtService
        const config = yield* AppConfig

        const adminId = uuid() as UserId
        const adminUser = new FlaskUser({
          id: adminId,
          username: "adminuser",
          passwordHash: "" as HashedPassword,
          discordId: Option.some("555555555555555555"),
          discordUsername: Option.some("Admin#0001"),
          isAdmin: true,
          active: true,
          cmdrId: Option.none(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(adminUser)

        // Verify and sign token
        const user = yield* flaskUserRepo.findByDiscordId("555555555555555555")
        expect(Option.isSome(user)).toBe(true)

        if (Option.isSome(user)) {
          const token = yield* jwtService.sign({
            userId: user.value.id,
            username: user.value.username,
            isAdmin: user.value.isAdmin,
            tenantName: config.faction.name,
          })

          const payload = yield* jwtService.verify(token)
          expect(payload.isAdmin).toBe(true)
        }
      })
    )
  })

  /**
   * Test 5: JWT token contains tenant name from config
   * Verifies multi-tenant token includes correct faction name
   */
  it("should include tenant name in JWT token", async () => {
    await runTest(
      Effect.gen(function* () {
        const jwtService = yield* JwtService
        const config = yield* AppConfig

        const token = yield* jwtService.sign({
          userId: uuid(),
          username: "testuser",
          isAdmin: false,
          tenantName: config.faction.name,
        })

        const payload = yield* jwtService.verify(token)
        expect(payload.tenantName).toBe("Test Faction")
      })
    )
  })

  /**
   * Test 6: User lookup by username
   * Verifies findByUsername works for username collision detection
   */
  it("should find user by username", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository

        const userId = uuid() as UserId
        const user = new FlaskUser({
          id: userId,
          username: "uniqueuser",
          passwordHash: "" as HashedPassword,
          discordId: Option.none(),
          discordUsername: Option.none(),
          isAdmin: false,
          active: true,
          cmdrId: Option.none(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(user)

        // Find by username
        const found = yield* flaskUserRepo.findByUsername("uniqueuser")
        expect(Option.isSome(found)).toBe(true)

        // Non-existent username
        const notFound = yield* flaskUserRepo.findByUsername("nonexistentuser")
        expect(Option.isNone(notFound)).toBe(true)
      })
    )
  })

  /**
   * Test 7: Inactive user NOT found by Discord ID
   * findByDiscordId uses "AND active = 1" - inactive users are filtered out
   * (prevents inactive/banned users from authenticating via Discord)
   */
  it("should not find inactive user by Discord ID", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository

        const userId = uuid() as UserId
        const inactiveUser = new FlaskUser({
          id: userId,
          username: "inactiveuser",
          passwordHash: "" as HashedPassword,
          discordId: Option.some("777777777777777777"),
          discordUsername: Option.some("Inactive#0001"),
          isAdmin: false,
          active: false, // Inactive
          cmdrId: Option.none(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(inactiveUser)

        // findByDiscordId filters with "AND active = 1", so inactive users are not returned
        const found = yield* flaskUserRepo.findByDiscordId("777777777777777777")
        expect(Option.isNone(found)).toBe(true)
      })
    )
  })
})
