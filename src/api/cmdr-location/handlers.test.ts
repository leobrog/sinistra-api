import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"

import { PgClient } from "../../database/client.js"
import { FlaskUserRepository } from "../../domain/repositories.js"
import { FlaskUserRepositoryLive } from "../../database/repositories/FlaskUserRepository.js"
import { CmdrRepository } from "../../domain/repositories.js"
import { CmdrRepositoryLive } from "../../database/repositories/CmdrRepository.js"
import { EventRepository } from "../../domain/repositories.js"
import { EventRepositoryLive } from "../../database/repositories/EventRepository.js"
import { FlaskUser, Cmdr, Event } from "../../domain/models.js"
import { UserId, HashedPassword, CmdrId, EventId } from "../../domain/ids.js"
import { v4 as uuid } from "uuid"

const ClientLayer = Layer.effect(
  PgClient,
  Effect.gen(function* () {
    const client = new SQL("postgres://postgres:password@localhost:5432/sinistra");
    return PgClient.of(client);
  })
)

const TestLayer = Layer.mergeAll(
  FlaskUserRepositoryLive,
  CmdrRepositoryLive,
  EventRepositoryLive,
  ClientLayer
).pipe(Layer.provide(ClientLayer))

const runTest = (effect: Effect.Effect<any, any, any>): Promise<any> =>
  Effect.runPromise(Effect.provide(effect as any, TestLayer))

describe("link_cmdr - FlaskUser cmdrId", () => {
  it("should store and retrieve cmdrId on a FlaskUser", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository
        const cmdrRepo = yield* CmdrRepository

        // Create a cmdr
        const cmdrId = uuid() as CmdrId
        yield* cmdrRepo.create(
          new Cmdr({
            id: cmdrId,
            name: "CMDR TestPilot",
            rankCombat: Option.none(),
            rankTrade: Option.none(),
            rankExplore: Option.none(),
            rankCqc: Option.none(),
            rankEmpire: Option.none(),
            rankFederation: Option.none(),
            rankPower: Option.none(),
            credits: Option.none(),
            assets: Option.none(),
            inaraUrl: Option.none(),
            squadronName: Option.none(),
            squadronRank: Option.none(),
          })
        )

        // Create a user with cmdrId
        const userId = uuid() as UserId
        const user = new FlaskUser({
          id: userId,
          username: "testpilot",
          passwordHash: "" as HashedPassword,
          discordId: Option.some("111222333444555666"),
          discordUsername: Option.some("TestPilot#0001"),
          isAdmin: false,
          active: true,
          cmdrId: Option.some(cmdrId),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(user)

        // Retrieve and check cmdrId is persisted
        const found = yield* flaskUserRepo.findByDiscordId("111222333444555666")
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(Option.isSome(found.value.cmdrId)).toBe(true)
          expect(Option.getOrNull(found.value.cmdrId)).toBe(cmdrId)
        }
      })
    )
  })

  it("should have cmdrId as None when not linked", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository

        const userId = uuid() as UserId
        const user = new FlaskUser({
          id: userId,
          username: "unlinkedpilot",
          passwordHash: "" as HashedPassword,
          discordId: Option.some("999888777666555444"),
          discordUsername: Option.some("Unlinked#0001"),
          isAdmin: false,
          active: true,
          cmdrId: Option.none(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(user)

        const found = yield* flaskUserRepo.findByDiscordId("999888777666555444")
        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(Option.isNone(found.value.cmdrId)).toBe(true)
        }
      })
    )
  })

  it("should update cmdrId on a user (link_cmdr)", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository
        const cmdrRepo = yield* CmdrRepository

        // Create a cmdr
        const cmdrId = uuid() as CmdrId
        yield* cmdrRepo.create(
          new Cmdr({
            id: cmdrId,
            name: "CMDR LinkMe",
            rankCombat: Option.none(),
            rankTrade: Option.none(),
            rankExplore: Option.none(),
            rankCqc: Option.none(),
            rankEmpire: Option.none(),
            rankFederation: Option.none(),
            rankPower: Option.none(),
            credits: Option.none(),
            assets: Option.none(),
            inaraUrl: Option.none(),
            squadronName: Option.none(),
            squadronRank: Option.none(),
          })
        )

        // Create user without cmdrId
        const userId = uuid() as UserId
        const user = new FlaskUser({
          id: userId,
          username: "linkme",
          passwordHash: "" as HashedPassword,
          discordId: Option.some("123456789012345678"),
          discordUsername: Option.some("LinkMe#0001"),
          isAdmin: false,
          active: true,
          cmdrId: Option.none(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(user)

        // Link the cmdr (simulate link_cmdr handler logic)
        const existingUserOpt = yield* flaskUserRepo.findByDiscordId("123456789012345678")
        expect(Option.isSome(existingUserOpt)).toBe(true)

        const existingUser = Option.getOrThrow(existingUserOpt)
        const linkedUser = new FlaskUser({ ...existingUser, cmdrId: Option.some(cmdrId), updatedAt: new Date() })
        yield* flaskUserRepo.update(linkedUser)

        // Verify cmdrId was saved
        const updated = yield* flaskUserRepo.findByDiscordId("123456789012345678")
        expect(Option.isSome(updated)).toBe(true)
        if (Option.isSome(updated)) {
          expect(Option.isSome(updated.value.cmdrId)).toBe(true)
          expect(Option.getOrNull(updated.value.cmdrId)).toBe(cmdrId)
        }
      })
    )
  })
})

describe("cmdr_system - uses cmdrId to find location", () => {
  it("should return current system for user with linked cmdr", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository
        const cmdrRepo = yield* CmdrRepository
        const eventRepo = yield* EventRepository
        const client = yield* PgClient

        // Create a cmdr
        const cmdrId = uuid() as CmdrId
        yield* cmdrRepo.create(
          new Cmdr({
            id: cmdrId,
            name: "CMDR Navigator",
            rankCombat: Option.none(),
            rankTrade: Option.none(),
            rankExplore: Option.none(),
            rankCqc: Option.none(),
            rankEmpire: Option.none(),
            rankFederation: Option.none(),
            rankPower: Option.none(),
            credits: Option.none(),
            assets: Option.none(),
            inaraUrl: Option.none(),
            squadronName: Option.none(),
            squadronRank: Option.none(),
          })
        )

        // Create user with linked cmdrId
        const userId = uuid() as UserId
        const user = new FlaskUser({
          id: userId,
          username: "navigator",
          passwordHash: "" as HashedPassword,
          discordId: Option.some("777111222333444555"),
          discordUsername: Option.some("Navigator#0001"),
          isAdmin: false,
          active: true,
          cmdrId: Option.some(cmdrId),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(user)

        // Create an FSDJump event for this cmdr
        const now = new Date().toISOString()
        yield* eventRepo.createEvent(
          new Event({
            id: uuid() as EventId,
            event: "FSDJump",
            timestamp: now,
            tickid: "tick_001",
            ticktime: now,
            cmdr: Option.some("CMDR Navigator"),
            starsystem: Option.some("Colonia"),
            systemaddress: Option.none(),
            rawJson: Option.none(),
          })
        )

        // Simulate cmdr_system handler: look up user → get cmdrId → get cmdr name → query event
        const userOpt = yield* flaskUserRepo.findByDiscordId("777111222333444555")
        expect(Option.isSome(userOpt)).toBe(true)
        const foundUser = Option.getOrThrow(userOpt)

        expect(Option.isSome(foundUser.cmdrId)).toBe(true)
        const foundCmdrId = Option.getOrThrow(foundUser.cmdrId)

        // Look up cmdr by ID to get name
        const cmdrOpt = yield* cmdrRepo.findById(foundCmdrId)
        expect(Option.isSome(cmdrOpt)).toBe(true)
        const cmdrName = Option.getOrThrow(cmdrOpt).name

        expect(cmdrName).toBe("CMDR Navigator")

        // Query last event starsystem
        const result = yield* Effect.tryPromise({
          try: () => client`SELECT starsystem, timestamp FROM event WHERE cmdr = ${cmdrName} AND starsystem IS NOT NULL ORDER BY timestamp DESC LIMIT 1`,
          catch: (e) => e,
        })

        expect((result as any).length).toBe(1)
        const row = (result as any)[0]
        expect(row).toBeDefined()
        if (row) {
          expect(row["starsystem"]).toBe("Colonia")
        }
      })
    )
  })

  it("should fail with error when user has no cmdrId linked", async () => {
    await runTest(
      Effect.gen(function* () {
        const flaskUserRepo = yield* FlaskUserRepository

        const userId = uuid() as UserId
        const user = new FlaskUser({
          id: userId,
          username: "nolink",
          passwordHash: "" as HashedPassword,
          discordId: Option.some("000111222333444555"),
          discordUsername: Option.some("NoLink#0001"),
          isAdmin: false,
          active: true,
          cmdrId: Option.none(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        yield* flaskUserRepo.create(user)

        const userOpt = yield* flaskUserRepo.findByDiscordId("000111222333444555")
        expect(Option.isSome(userOpt)).toBe(true)
        const foundUser = Option.getOrThrow(userOpt)

        // Handler should detect no cmdrId and return error
        expect(Option.isNone(foundUser.cmdrId)).toBe(true)
      })
    )
  })
})
