import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { ApiKeyRepository } from "../../domain/repositories.ts"
import { ApiKeyRepositoryLive } from "./ApiKeyRepository.ts"
import { PgClient } from "../client.ts"

import { UserId, ApiKeyId, ApiKey } from "../../domain/ids.ts"

// Helper to provide a fresh Test Layer for each test
const ClientLayer = Layer.effect(
  PgClient,
  Effect.gen(function* () {
    const client = new SQL("postgres://postgres:password@localhost:5432/sinistra");
    return PgClient.of(client);
  })
)

const TestLayer = Layer.mergeAll(
    ClientLayer,
    ApiKeyRepositoryLive.pipe(Layer.provide(ClientLayer))
)

describe("ApiKeyRepository", () => {
  const runTest = <E>(effect: Effect.Effect<any, E, ApiKeyRepository | PgClient>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer))

  it("should create and list api keys by user", async () => {
    const userId = UserId.make("user_123")
    const apiKey = {
      id: ApiKeyId.make("key_1"),
      userId: userId,
      key: ApiKey.make("sk_test_123"),
      name: "Test Key",
      lastUsedAt: Option.none(),
      expiresAt: Option.none(),
      createdAt: new Date(),
    }

    await runTest(
      Effect.gen(function* () {
        const client = yield* PgClient
        // Create user first
        yield* Effect.tryPromise(() => client`INSERT INTO users (id, email, name, password, company, plan_tier, created_at, updated_at) VALUES (${"user_123"}, ${"test@test.com"}, ${"Test"}, ${"pass"}, ${null}, ${"free"}, ${Date.now()}, ${Date.now()})`)

        const repo = yield* ApiKeyRepository
        
        // Create
        yield* repo.create(apiKey)

        // Find by User ID
        const results = yield* repo.findByUserId(userId)
        expect(results.length).toBe(1)
        expect(results[0]!.id).toBe(apiKey.id)
        expect(results[0]!.key).toBe(apiKey.key)
      })
    )
  })

  it("should delete an api key", async () => {
    const userId = UserId.make("user_123")
    const apiKey = {
      id: ApiKeyId.make("key_to_delete"),
      userId: userId,
      key: ApiKey.make("sk_test_del"),
      name: "To Delete",
      lastUsedAt: Option.none(),
      expiresAt: Option.none(),
      createdAt: new Date(),
    }

    await runTest(
      Effect.gen(function* () {
        const client = yield* PgClient
        
        yield* Effect.tryPromise(() => client`INSERT INTO users (id, email, name, password, company, plan_tier, created_at, updated_at) VALUES (${"user_123"}, ${"test2@test.com"}, ${"Test2"}, ${"pass"}, ${null}, ${"free"}, ${Date.now()}, ${Date.now()})`)

        const repo = yield* ApiKeyRepository
        yield* repo.create(apiKey)

        // Verify exists
        let results = yield* repo.findByUserId(userId)
        expect(results.length).toBe(1)

        // Delete
        yield* repo.delete(apiKey.id)

        // Verify gone
        results = yield* repo.findByUserId(userId)
        expect(results.length).toBe(0)
      })
    )
  })

  it("should fail to create api key with duplicate name for same user", async () => {
    const userId = UserId.make("user_duplicate_test")
    const apiKey1 = {
      id: ApiKeyId.make("key_1"),
      userId: userId,
      key: ApiKey.make("sk_test_1"),
      name: "Duplicate Name",
      lastUsedAt: Option.none(),
      expiresAt: Option.none(),
      createdAt: new Date(),
    }
    const apiKey2 = {
      id: ApiKeyId.make("key_2"),
      userId: userId,
      key: ApiKey.make("sk_test_2"),
      name: "Duplicate Name",
      lastUsedAt: Option.none(),
      expiresAt: Option.none(),
      createdAt: new Date(),
    }

    await runTest(
      Effect.gen(function* () {
        const client = yield* PgClient
        yield* Effect.tryPromise(() => client`INSERT INTO users (id, email, name, password, company, plan_tier, created_at, updated_at) VALUES (${"user_duplicate_test"}, ${"dup@test.com"}, ${"Dup User"}, ${"pass"}, ${null}, ${"free"}, ${Date.now()}, ${Date.now()})`)

        const repo = yield* ApiKeyRepository
        
        yield* repo.create(apiKey1)

        const result = yield* Effect.exit(repo.create(apiKey2))
        
        expect(result._tag).toBe("Failure")
        if (result._tag === "Failure") {
            // Need to import the error type or check properties
            // checking tag string for simplicity
            // @ts-ignore
            expect(result.cause.error._tag).toBe("ApiKeyNameAlreadyExistsError")
        }
      })
    )
  })
})
