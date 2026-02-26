import { SQL } from 'bun'
/**
 * Date filter service - Port of Flask's _date_filters.py
 *
 * Provides date range and tick-based filtering for events and activities.
 * Supports period strings: cw, lw, cm, lm, 2m, y, cd, ld, ct, lt
 */

import { Effect, Schema } from "effect"


/**
 * Schema for valid date filter period strings
 */
export const DateFilterPeriodSchema = Schema.Literal(
  "cw",  // Current week
  "lw",  // Last week
  "cm",  // Current month
  "lm",  // Last month
  "2m",  // Last 2 months
  "y",   // Current year
  "cd",  // Current day
  "ld",  // Last day
  "ct",  // Current tick
  "lt",  // Last tick
  "all" // All time
)

export type DateFilterPeriod = typeof DateFilterPeriodSchema.Type

/**
 * Date filter result containing the filter criteria and human-readable label
 */
export interface DateFilter {
  readonly type: "date" | "tick"
  readonly startDate?: string  // ISO 8601 format
  readonly endDate?: string    // ISO 8601 format
  readonly tickId?: string
  readonly label: string
}

/**
 * Get start of week (Monday) for a given date
 */
const getWeekStart = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get start of month for a given date
 */
const getMonthStart = (date: Date): Date => {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get end of month for a given date
 */
const getMonthEnd = (date: Date): Date => {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Format date as ISO 8601 string for database queries
 */
const formatDate = (date: Date): string => {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z")
}

/**
 * Get date at start of day (00:00:00)
 */
const startOfDay = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get date at end of day (23:59:59)
 */
const endOfDay = (date: Date): Date => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Build date-based filter (cw, lw, cm, lm, 2m, y, cd, ld)
 */
const buildDateBasedFilter = (period: string): DateFilter | null => {
  const today = new Date()
  let start: Date
  let end: Date

  switch (period) {
    case "cw": // Current week
      start = getWeekStart(today)
      end = new Date(start)
      end.setDate(end.getDate() + 6)
      end = endOfDay(end)
      break

    case "lw": // Last week
      end = new Date(getWeekStart(today))
      end.setDate(end.getDate() - 1)
      end = endOfDay(end)
      start = new Date(end)
      start.setDate(start.getDate() - 6)
      start = startOfDay(start)
      break

    case "cm": // Current month
      start = getMonthStart(today)
      end = getMonthEnd(today)
      break

    case "lm": // Last month
      const thisMonthStart = getMonthStart(today)
      start = new Date(thisMonthStart)
      start.setMonth(start.getMonth() - 1)
      end = new Date(thisMonthStart)
      end.setDate(end.getDate() - 1)
      end = endOfDay(end)
      break

    case "2m": // Last 2 months
      const thisMonthStart2m = getMonthStart(today)
      start = new Date(thisMonthStart2m)
      start.setMonth(start.getMonth() - 2)
      end = new Date(thisMonthStart2m)
      end.setDate(end.getDate() - 1)
      end = endOfDay(end)
      break

    case "y": // Current year
      start = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999)
      break

    case "cd": // Current day
      start = startOfDay(today)
      end = endOfDay(today)
      break

    case "ld": // Last day
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      start = startOfDay(yesterday)
      end = endOfDay(yesterday)
      break

    default:
      return null
  }

  const formatDateLabel = (d: Date) => d.toISOString().split("T")[0]

  return {
    type: "date",
    startDate: formatDate(start),
    endDate: formatDate(end),
    label: `${formatDateLabel(start)} to ${formatDateLabel(end)}`,
  }
}

/**
 * Get current tick ID from database
 */
const getCurrentTickId = (db: SQL) =>
  Effect.tryPromise({
    try: async () => {
      const result = await db(
        "SELECT tickid FROM event WHERE tickid IS NOT NULL ORDER BY timestamp DESC LIMIT 1"
      )
      return result.rows[0]?.tickid as string | undefined
    },
    catch: (error) => new Error(`Failed to get current tick: ${error}`),
  })

/**
 * Get last tick ID (second most recent) from database
 */
const getLastTickId = (db: SQL) =>
  Effect.tryPromise({
    try: async () => {
      const result = await db(
        "SELECT DISTINCT tickid FROM event WHERE tickid IS NOT NULL ORDER BY timestamp DESC LIMIT 2"
      )
      const rows = result.rows
      // If we have 2 ticks, return the second one (last tick)
      // If we only have 1 tick, return it
      const tickid = (rows.length === 2 ? rows[1]?.tickid : rows[0]?.tickid) as string | undefined
      return tickid
    },
    catch: (error) => new Error(`Failed to get last tick: ${error}`),
  })

/**
 * Build tick-based filter (ct, lt)
 */
const buildTickBasedFilter = (
  period: string,
  db: SQL
): Effect.Effect<DateFilter, Error> => {
  if (period === "ct") {
    // Current tick
    return Effect.gen(function* () {
      const tickId = yield* getCurrentTickId(db)
      if (!tickId) {
        return {
          type: "tick" as const,
          label: "No Tick Found",
        }
      }
      return {
        type: "tick" as const,
        tickId,
        label: `Tick ${tickId}`,
      }
    })
  } else if (period === "lt") {
    // Last tick
    return Effect.gen(function* () {
      const tickId = yield* getLastTickId(db)
      if (!tickId) {
        return {
          type: "tick" as const,
          label: "No Tick Found",
        }
      }
      return {
        type: "tick" as const,
        tickId,
        label: `Last Tick ${tickId}`,
      }
    })
  } else {
    return Effect.fail(new Error(`Unknown tick-based period: ${period}`))
  }
}

/**
 * Build date filter for the given period string
 *
 * @param period - Period string (cw, lw, cm, lm, 2m, y, cd, ld, ct, lt, or "all")
 * @param db - Optional database client (required for tick-based filters ct, lt)
 * @returns Effect containing the date filter or an error
 *
 * Period strings:
 * - cw: Current week (Monday to Sunday)
 * - lw: Last week
 * - cm: Current month
 * - lm: Last month
 * - 2m: Last 2 months
 * - y: Current year
 * - cd: Current day
 * - ld: Last day (yesterday)
 * - ct: Current tick (requires db)
 * - lt: Last tick (requires db)
 * - all: All time (no filter)
 */
export const buildDateFilter = (
  period: string,
  db?: SQL
): Effect.Effect<DateFilter, Error> => {
  // Handle "all" period (no filter)
  if (period === "all") {
    return Effect.succeed({
      type: "date" as const,
      label: "All Time",
    })
  }

  // Handle tick-based filters
  if (period === "ct" || period === "lt") {
    if (!db) {
      return Effect.fail(new Error("Database client required for tick-based filters"))
    }
    return buildTickBasedFilter(period, db)
  }

  // Handle date-based filters
  const dateFilter = buildDateBasedFilter(period)
  if (!dateFilter) {
    return Effect.fail(new Error(`Unknown period: ${period}`))
  }

  return Effect.succeed(dateFilter)
}

/**
 * Helper to convert DateFilter to SQL WHERE clause conditions
 * Returns an object with the field name and values to compare
 */
export const dateFilterToSqlConditions = (
  filter: DateFilter,
  timestampField: string = "timestamp",
  tickidField: string = "tickid"
): { field: string; operator: string; value: unknown } | null => {
  if (filter.type === "tick" && filter.tickId) {
    return {
      field: tickidField,
      operator: "=",
      value: filter.tickId,
    }
  }

  if (filter.type === "date" && filter.startDate && filter.endDate) {
    // For date ranges, we need to return both conditions
    // This is simplified - in practice you'd handle this in the query builder
    return {
      field: timestampField,
      operator: "BETWEEN",
      value: [filter.startDate, filter.endDate],
    }
  }

  return null
}
