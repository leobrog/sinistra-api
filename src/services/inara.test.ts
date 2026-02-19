import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Effect, Option } from "effect"
import {
  fetchCmdrProfile,
  profileToDbValues,
} from "./inara.js"

describe("InaraService", () => {
  beforeEach(() => {
    mock.restore()
  })

  describe("fetchCmdrProfile", () => {
    it("should fetch commander profile successfully", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            header: {
              eventStatus: 200,
              eventStatusText: "OK",
            },
            events: [
              {
                eventStatus: 200,
                eventData: {
                  commanderRanksPilot: [
                    { rankName: "combat", rankValue: 5 },
                    { rankName: "trade", rankValue: 3 },
                    { rankName: "exploration", rankValue: 7 },
                    { rankName: "cqc", rankValue: 0 },
                    { rankName: "empire", rankValue: 12 },
                    { rankName: "federation", rankValue: 4 },
                  ],
                  commanderSquadron: {
                    squadronName: "Test Squadron",
                    squadronMemberRank: "Officer",
                  },
                  preferredPowerName: "Aisling Duval",
                  inaraURL: "https://inara.cz/cmdr/TestCmdr/",
                },
              },
            ],
          }),
          { status: 200 }
        )
      })

      const result = await Effect.runPromise(fetchCmdrProfile("TestCmdr", "test_api_key")) as any

      expect(Option.getOrNull(result.rankCombat as Option.Option<any>)).toBe(5)
      expect(Option.getOrNull(result.rankTrade as Option.Option<any>)).toBe(3)
      expect(Option.getOrNull(result.rankExplore as Option.Option<any>)).toBe(7)
      expect(Option.getOrNull(result.rankCqc as Option.Option<any>)).toBe(0)
      expect(Option.getOrNull(result.rankEmpire as Option.Option<any>)).toBe(12)
      expect(Option.getOrNull(result.rankFederation as Option.Option<any>)).toBe(4)
      expect(Option.getOrNull(result.rankPower as Option.Option<any>)).toBe("Aisling Duval")
      expect(Option.getOrNull(result.inaraUrl as Option.Option<any>)).toBe("https://inara.cz/cmdr/TestCmdr/")
      expect(Option.getOrNull(result.squadronName as Option.Option<any>)).toBe("Test Squadron")
      expect(Option.getOrNull(result.squadronRank as Option.Option<any>)).toBe("Officer")
    })

    it("should handle commander with no squadron", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            header: {
              eventStatus: 200,
            },
            events: [
              {
                eventStatus: 200,
                eventData: {
                  commanderRanksPilot: [{ rankName: "combat", rankValue: 2 }],
                  inaraURL: "https://inara.cz/cmdr/SoloCmdr/",
                },
              },
            ],
          }),
          { status: 200 }
        )
      })

      const result = await Effect.runPromise(fetchCmdrProfile("SoloCmdr", "test_api_key")) as any

      expect(Option.getOrNull(result.rankCombat as Option.Option<any>)).toBe(2)
      expect(Option.isNone(result.squadronName as Option.Option<any>)).toBe(true)
      expect(Option.isNone(result.squadronRank as Option.Option<any>)).toBe(true)
    })

    it("should handle rate limiting error", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            header: {
              eventStatus: 400,
              eventStatusText: "Too many requests",
            },
            events: [],
          }),
          { status: 200 }
        )
      })

      const exit = await Effect.runPromiseExit(fetchCmdrProfile("TestCmdr", "test_api_key"))

      // Just verify it fails - the specific error type is tested via Effect's error handling
      expect(exit._tag).toBe("Failure")
    })

    it("should fail when HTTP request fails", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response("Server Error", { status: 500 })
      })

      const exit = await Effect.runPromiseExit(fetchCmdrProfile("TestCmdr", "test_api_key"))

      expect(exit._tag).toBe("Failure")
    })

    it("should fail when no event data returned", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            header: {
              eventStatus: 200,
            },
            events: [
              {
                eventStatus: 204,
                // No eventData
              },
            ],
          }),
          { status: 200 }
        )
      })

      const exit = await Effect.runPromiseExit(fetchCmdrProfile("UnknownCmdr", "test_api_key"))

      expect(exit._tag).toBe("Failure")
    })

    it("should handle missing rank fields", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            header: {
              eventStatus: 200,
            },
            events: [
              {
                eventStatus: 200,
                eventData: {
                  // commanderRanksPilot is optional
                  inaraURL: "https://inara.cz/cmdr/NewCmdr/",
                },
              },
            ],
          }),
          { status: 200 }
        )
      })

      const result = await Effect.runPromise(fetchCmdrProfile("NewCmdr", "test_api_key")) as any

      expect(Option.isNone(result.rankCombat as Option.Option<any>)).toBe(true)
      expect(Option.isNone(result.rankTrade as Option.Option<any>)).toBe(true)
      expect(Option.isNone(result.rankExplore as Option.Option<any>)).toBe(true)
      expect(Option.getOrNull(result.inaraUrl as Option.Option<any>)).toBe("https://inara.cz/cmdr/NewCmdr/")
    })
  })

  describe("profileToDbValues", () => {
    it("should convert profile with all fields to db values", () => {
      const profile = {
        rankCombat: Option.some(5),
        rankTrade: Option.some(3),
        rankExplore: Option.some(7),
        rankCqc: Option.some(0),
        rankEmpire: Option.some(12),
        rankFederation: Option.some(4),
        rankPower: Option.some("Aisling Duval"),
        inaraUrl: Option.some("https://inara.cz/cmdr/Test/"),
        squadronName: Option.some("Test Squadron"),
        squadronRank: Option.some("Officer"),
      }

      const dbValues = profileToDbValues(profile)

      expect(dbValues.rankCombat).toBe(5)
      expect(dbValues.rankTrade).toBe(3)
      expect(dbValues.rankExplore).toBe(7)
      expect(dbValues.rankCqc).toBe(0)
      expect(dbValues.rankEmpire).toBe(12)
      expect(dbValues.rankFederation).toBe(4)
      expect(dbValues.rankPower).toBe("Aisling Duval")
      expect(dbValues.inaraUrl).toBe("https://inara.cz/cmdr/Test/")
      expect(dbValues.squadronName).toBe("Test Squadron")
      expect(dbValues.squadronRank).toBe("Officer")
    })

    it("should convert profile with missing fields to null", () => {
      const profile = {
        rankCombat: Option.some(5),
        rankTrade: Option.none(),
        rankExplore: Option.none(),
        rankCqc: Option.none(),
        rankEmpire: Option.none(),
        rankFederation: Option.none(),
        rankPower: Option.none(),
        inaraUrl: Option.some("https://inara.cz/cmdr/Test/"),
        squadronName: Option.none(),
        squadronRank: Option.none(),
      }

      const dbValues = profileToDbValues(profile)

      expect(dbValues.rankCombat).toBe(5)
      expect(dbValues.rankTrade).toBeNull()
      expect(dbValues.rankExplore).toBeNull()
      expect(dbValues.rankCqc).toBeNull()
      expect(dbValues.rankEmpire).toBeNull()
      expect(dbValues.rankFederation).toBeNull()
      expect(dbValues.rankPower).toBeNull()
      expect(dbValues.inaraUrl).toBe("https://inara.cz/cmdr/Test/")
      expect(dbValues.squadronName).toBeNull()
      expect(dbValues.squadronRank).toBeNull()
    })
  })
})
