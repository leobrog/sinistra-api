import { SQL } from 'bun'
import { describe, it, expect } from "bun:test"
import { Effect, Layer, Option } from "effect"
import { EddnRepository } from "../../domain/repositories.ts"
import { EddnRepositoryLive } from "./EddnRepository.ts"
import { PgClient } from "../client.ts"

import {
    EddnMessageId,
    EddnSystemInfoId,
    EddnFactionId,
    EddnConflictId,
    EddnPowerplayId
} from "../../domain/ids.ts"

// Helper to provide a fresh Test Layer for each test
const ClientLayer = Layer.effect(
  PgClient,
  Effect.gen(function* () {
    const client = new SQL("postgres://postgres:password@localhost:5432/sinistra");
    return PgClient.of(client);
  })
)

const TestLayer = EddnRepositoryLive.pipe(
    Layer.provide(ClientLayer)
)

describe("EddnRepository", () => {
  const runTest = (effect: Effect.Effect<any, any, EddnRepository>) =>
    Effect.runPromise(Effect.provide(effect, TestLayer))

  it("should save an EDDN message", async () => {
    const message = {
      id: EddnMessageId.make("msg_1"),
      schemaRef: "https://eddn.edcd.io/schemas/journal/1",
      headerGatewayTimestamp: Option.some(new Date("2024-01-15T10:00:00Z")),
      messageType: Option.some("journal"),
      messageJson: '{"event":"FSDJump"}',
      timestamp: new Date("2024-01-15T10:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository
        yield* repo.saveMessage(message)
        // Note: No find method for messages, just save
      })
    )
  })

  it("should upsert and find system info", async () => {
    const systemInfo = {
      id: EddnSystemInfoId.make("sysinfo_1"),
      eddnMessageId: Option.none(),
      systemName: "Sol",
      controllingFaction: Option.some("Federation"),
      controllingPower: Option.some("Zachary Hudson"),
      population: Option.some(100000000),
      security: Option.some("High"),
      government: Option.some("Democracy"),
      allegiance: Option.some("Federation"),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository

        // Upsert
        yield* repo.upsertSystemInfo(systemInfo)

        // Find
        const result = yield* repo.findSystemInfo("Sol")
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(result.value.systemName).toBe("Sol")
            expect(Option.getOrNull(result.value.controllingFaction)).toBe("Federation")
            expect(Option.getOrNull(result.value.population)).toBe(100000000)
        }
      })
    )
  })

  it("should update existing system info on conflict", async () => {
    const systemInfo1 = {
      id: EddnSystemInfoId.make("sysinfo_conflict"),
      eddnMessageId: Option.none(),
      systemName: "Alpha Centauri",
      controllingFaction: Option.some("Old Faction"),
      controllingPower: Option.none(),
      population: Option.some(1000),
      security: Option.none(),
      government: Option.none(),
      allegiance: Option.none(),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
    }

    const systemInfo2 = {
      ...systemInfo1,
      controllingFaction: Option.some("New Faction"),
      population: Option.some(2000),
      updatedAt: new Date("2024-01-15T11:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository

        yield* repo.upsertSystemInfo(systemInfo1)
        yield* repo.upsertSystemInfo(systemInfo2)

        const result = yield* repo.findSystemInfo("Alpha Centauri")
        expect(Option.isSome(result)).toBe(true)
        if (Option.isSome(result)) {
            expect(Option.getOrNull(result.value.controllingFaction)).toBe("New Faction")
            expect(Option.getOrNull(result.value.population)).toBe(2000)
        }
      })
    )
  })

  it("should upsert and find factions in system", async () => {
    const faction1 = {
      id: EddnFactionId.make("faction_1"),
      eddnMessageId: Option.none(),
      systemName: "LHS 3447",
      name: "Faction A",
      influence: Option.some(0.45),
      state: Option.some("Boom"),
      allegiance: Option.some("Independent"),
      government: Option.some("Democracy"),
      recoveringStates: Option.some([{ state: "War" }]),
      activeStates: Option.some([{ state: "Boom" }]),
      pendingStates: Option.none(),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
    }

    const faction2 = {
      id: EddnFactionId.make("faction_2"),
      eddnMessageId: Option.none(),
      systemName: "LHS 3447",
      name: "Faction B",
      influence: Option.some(0.35),
      state: Option.some("None"),
      allegiance: Option.none(),
      government: Option.none(),
      recoveringStates: Option.none(),
      activeStates: Option.none(),
      pendingStates: Option.none(),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository

        yield* repo.upsertFaction(faction1)
        yield* repo.upsertFaction(faction2)

        const result = yield* repo.findFactionsInSystem("LHS 3447")
        expect((result as any).length).toBe(2)
        const names = result.map(f => f.name)
        expect(names).toContain("Faction A")
        expect(names).toContain("Faction B")

        // Check JSON fields
        const factionA = result.find(f => f.name === "Faction A")
        if (factionA) {
            expect(Option.isSome(factionA.recoveringStates)).toBe(true)
            expect(Option.isSome(factionA.activeStates)).toBe(true)
        }
      })
    )
  })

  it("should upsert and find conflicts in system", async () => {
    const conflict = {
      id: EddnConflictId.make("conflict_1"),
      eddnMessageId: Option.none(),
      systemName: "Conflict System",
      faction1: Option.some("Red Faction"),
      faction2: Option.some("Blue Faction"),
      stake1: Option.some("Control Point"),
      stake2: Option.some("Control Point"),
      wonDays1: Option.some(2),
      wonDays2: Option.some(1),
      status: Option.some("Active"),
      warType: Option.some("War"),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository

        yield* repo.upsertConflict(conflict)

        const result = yield* repo.findConflictsInSystem("Conflict System")
        expect((result as any).length).toBe(1)
        expect(Option.getOrNull((result as any)[0]!.faction1)).toBe("Red Faction")
        expect(Option.getOrNull((result as any)[0]!.wonDays1)).toBe(2)
      })
    )
  })

  it("should upsert powerplay data", async () => {
    const powerplay = {
      id: EddnPowerplayId.make("pp_1"),
      eddnMessageId: Option.none(),
      systemName: "Powerplay System",
      power: Option.some({ name: "Zachary Hudson" }),
      powerplayState: Option.some("Controlled"),
      controlProgress: Option.some(100),
      reinforcement: Option.some(5000),
      undermining: Option.some(1000),
      updatedAt: new Date("2024-01-15T10:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository
        yield* repo.upsertPowerplay(powerplay)
        // Note: No direct find method for powerplay, just upsert
      })
    )
  })

  it("should cleanup old messages", async () => {
    const oldMessage = {
      id: EddnMessageId.make("old_msg"),
      schemaRef: "https://eddn.edcd.io/schemas/journal/1",
      headerGatewayTimestamp: Option.none(),
      messageType: Option.none(),
      messageJson: '{"event":"Old"}',
      timestamp: new Date("2024-01-01T10:00:00Z"),
    }

    const newMessage = {
      id: EddnMessageId.make("new_msg"),
      schemaRef: "https://eddn.edcd.io/schemas/journal/1",
      headerGatewayTimestamp: Option.none(),
      messageType: Option.none(),
      messageJson: '{"event":"New"}',
      timestamp: new Date("2024-01-15T10:00:00Z"),
    }

    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository

        yield* repo.saveMessage(oldMessage)
        yield* repo.saveMessage(newMessage)

        // Delete messages older than Jan 10
        const deletedCount = yield* repo.cleanupOldMessages(new Date("2024-01-10T00:00:00Z"))
        expect(deletedCount).toBe(1) // Should delete old_msg
      })
    )
  })

  it("should return empty array for system with no factions", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository
        const result = yield* repo.findFactionsInSystem("Empty System")
        expect((result as any).length).toBe(0)
      })
    )
  })

  it("should return None for non-existent system info", async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* EddnRepository
        const result = yield* repo.findSystemInfo("Ghost System")
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })
})
