import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { UserRepository } from "../../domain/repositories.ts"
import { UserRepositoryLive } from "./UserRepository.ts"
import { PgClient } from "../client.ts"

import { UserId, Email, HashedPassword } from "../../domain/ids.ts"
import { PlanTier } from "../../domain/models.ts"

// Helper to provide a fresh Test Layer for each test
const ClientLayer = Layer.effect(
  PgClient,
  Effect.gen(function* () {
    const client = new SQL("postgres://postgres:password@localhost:5432/sinistra");
    return PgClient.of(client);
  })
)

const TestLayer = UserRepositoryLive.pipe(
    Layer.provide(ClientLayer)
)

describe("UserRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, UserRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer))

  it("should create and retrieve a user by ID", async () => {
    const user = {
      id: UserId.make("user_123"),
      email: Email.make("test@example.com"),
      name: "Test User",
      password: HashedPassword.make("hashed_secret"),
      company: Option.none(),
      planTier: "free" as PlanTier,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* UserRepository
        
        // Create
        yield* repo.create(user)

        // Find by ID
        const result = yield* repo.findById(user.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.id).toBe(user.id)
            expect(result.value.name).toBe(user.name)
        }
      })
    )
  })

  it("should retrieve a user by Email", async () => {
    const user = {
      id: UserId.make("user_456"),
      email: Email.make("unique@example.com"),
      name: "Unique User",
      password: HashedPassword.make("secret"),
      company: Option.some("Acme Inc"),
      planTier: "pro" as PlanTier,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* UserRepository
        yield* repo.create(user)

        const result = yield* repo.findByEmail(user.email)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.email).toBe(user.email)
            expect(Option.getOrNull(result.value.company)).toBe("Acme Inc")
        }
      })
    )
  })

  it("should update a user", async () => {
    const user = {
      id: UserId.make("user_789"),
      email: Email.make("update@example.com"),
      name: "Original Name",
      password: HashedPassword.make("pass"),
      company: Option.none(),
      planTier: "free" as PlanTier,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* UserRepository
        yield* repo.create(user)

        const updatedUser = {
            ...user,
            name: "Updated Name",
            planTier: "enterprise" as PlanTier,
            updatedAt: new Date()
        }

        yield* repo.update(updatedUser)

        const result = yield* repo.findById(user.id)
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.name).toBe("Updated Name")
            expect(result.value.planTier).toBe("enterprise")
        }
      })
    )
  })

  it("should delete a user", async () => {
    const user = {
      id: UserId.make("user_del"),
      email: Email.make("delete@example.com"),
      name: "To Delete",
      password: HashedPassword.make("pass"),
      company: Option.none(),
      planTier: "free" as PlanTier,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* UserRepository
        yield* repo.create(user)

        // Verify exists
        let result = yield* repo.findById(user.id)
        expect(Option.isSome(result)).toBe(true)

        // Delete
        yield* repo.delete(user.id)

        // Verify gone
        result = yield* repo.findById(user.id)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })

  it("should return None for non-existent user", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* UserRepository
        const result = yield* repo.findById(UserId.make("ghost"))
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })
})
