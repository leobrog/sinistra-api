import { describe, it, expect, beforeEach } from "bun:test"
import { Effect } from "effect"
import { createClient, type Client as LibsqlClient } from "@libsql/client"
import { buildDateFilter, type DateFilter } from "./date-filters"

describe("DateFilterService", () => {
  let db: LibsqlClient

  beforeEach(async () => {
    db = createClient({
      url: ":memory:",
    })

    // Create event table with tickid column
    await db.execute(`
      CREATE TABLE event (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        tickid TEXT
      )
    `)
  })

  describe("date-based filters", () => {
    it("should build current week filter (cw)", async () => {
      const result = await Effect.runPromise(buildDateFilter("cw"))

      expect(result.type).toBe("date")
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.label).toContain("to")
    })

    it("should build last week filter (lw)", async () => {
      const result = await Effect.runPromise(buildDateFilter("lw"))

      expect(result.type).toBe("date")
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.label).toContain("to")
    })

    it("should build current month filter (cm)", async () => {
      const result = await Effect.runPromise(buildDateFilter("cm"))

      expect(result.type).toBe("date")
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.label).toContain("to")
    })

    it("should build last month filter (lm)", async () => {
      const result = await Effect.runPromise(buildDateFilter("lm"))

      expect(result.type).toBe("date")
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.label).toContain("to")
    })

    it("should build last 2 months filter (2m)", async () => {
      const result = await Effect.runPromise(buildDateFilter("2m"))

      expect(result.type).toBe("date")
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.label).toContain("to")
    })

    it("should build current year filter (y)", async () => {
      const result = await Effect.runPromise(buildDateFilter("y"))

      expect(result.type).toBe("date")
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.label).toContain("to")
    })

    it("should build current day filter (cd)", async () => {
      const result = await Effect.runPromise(buildDateFilter("cd"))

      expect(result.type).toBe("date")
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.label).toContain("to")
    })

    it("should build last day filter (ld)", async () => {
      const result = await Effect.runPromise(buildDateFilter("ld"))

      expect(result.type).toBe("date")
      expect(result.startDate).toBeDefined()
      expect(result.endDate).toBeDefined()
      expect(result.label).toContain("to")
    })

    it("should build all time filter (all)", async () => {
      const result = await Effect.runPromise(buildDateFilter("all"))

      expect(result.type).toBe("date")
      expect(result.label).toBe("All Time")
      expect(result.startDate).toBeUndefined()
      expect(result.endDate).toBeUndefined()
    })
  })

  describe("tick-based filters", () => {
    it("should build current tick filter (ct) with tick data", async () => {
      // Insert test data with tickids
      await db.execute({
        sql: "INSERT INTO event (id, timestamp, tickid) VALUES (?, ?, ?)",
        args: ["1", "2026-02-15T10:00:00Z", "tick-123"],
      })
      await db.execute({
        sql: "INSERT INTO event (id, timestamp, tickid) VALUES (?, ?, ?)",
        args: ["2", "2026-02-15T09:00:00Z", "tick-122"],
      })

      const result = await Effect.runPromise(buildDateFilter("ct", db))

      expect(result.type).toBe("tick")
      expect(result.tickId).toBe("tick-123")
      expect(result.label).toBe("Tick tick-123")
    })

    it("should build last tick filter (lt) with 2 ticks", async () => {
      // Insert test data with 2 distinct tickids
      await db.execute({
        sql: "INSERT INTO event (id, timestamp, tickid) VALUES (?, ?, ?)",
        args: ["1", "2026-02-15T10:00:00Z", "tick-123"],
      })
      await db.execute({
        sql: "INSERT INTO event (id, timestamp, tickid) VALUES (?, ?, ?)",
        args: ["2", "2026-02-15T09:00:00Z", "tick-122"],
      })

      const result = await Effect.runPromise(buildDateFilter("lt", db))

      expect(result.type).toBe("tick")
      expect(result.tickId).toBe("tick-122")
      expect(result.label).toBe("Last Tick tick-122")
    })

    it("should build last tick filter (lt) with only 1 tick", async () => {
      // Insert test data with only 1 tickid
      await db.execute({
        sql: "INSERT INTO event (id, timestamp, tickid) VALUES (?, ?, ?)",
        args: ["1", "2026-02-15T10:00:00Z", "tick-123"],
      })

      const result = await Effect.runPromise(buildDateFilter("lt", db))

      expect(result.type).toBe("tick")
      expect(result.tickId).toBe("tick-123")
      expect(result.label).toBe("Last Tick tick-123")
    })

    it("should handle no tick data (ct)", async () => {
      const result = await Effect.runPromise(buildDateFilter("ct", db))

      expect(result.type).toBe("tick")
      expect(result.tickId).toBeUndefined()
      expect(result.label).toBe("No Tick Found")
    })

    it("should handle no tick data (lt)", async () => {
      const result = await Effect.runPromise(buildDateFilter("lt", db))

      expect(result.type).toBe("tick")
      expect(result.tickId).toBeUndefined()
      expect(result.label).toBe("No Tick Found")
    })

    it("should fail when db not provided for tick filters", async () => {
      const resultCt = Effect.runPromise(buildDateFilter("ct"))
      await expect(resultCt).rejects.toThrow("Database client required")

      const resultLt = Effect.runPromise(buildDateFilter("lt"))
      await expect(resultLt).rejects.toThrow("Database client required")
    })
  })

  describe("error handling", () => {
    it("should fail for unknown period", async () => {
      const result = Effect.runPromise(buildDateFilter("invalid"))
      await expect(result).rejects.toThrow("Unknown period")
    })
  })
})
