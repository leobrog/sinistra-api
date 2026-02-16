import { Effect, Option } from "effect"
import { HttpApiSchema } from "effect"
import { EddnRepository } from "../../domain/repositories"
import type { SystemSummaryQuery } from "./dtos"
import {
  SystemDetailResponse,
  SystemListResponse,
  SystemSearchErrorResponse,
  EddnSystemInfo,
  EddnFaction,
  EddnConflict,
  EddnPowerplay,
} from "./dtos"

const MAX_SYSTEMS = 400

// Helper to check if a boolean-like string is truthy
const isTruthy = (value: string | undefined): boolean => {
  if (!value) return false
  return ["1", "true", "yes"].includes(value.toLowerCase())
}

export const handleGetSystemSummary = (
  systemName: Option.Option<string>,
  query: SystemSummaryQuery
) =>
  Effect.gen(function* () {
    const eddnRepo = yield* EddnRepository

    // Check if any filters are provided
    const hasFilters =
      query.system_name ||
      query.faction ||
      query.controlling_faction ||
      query.controlling_power ||
      query.power ||
      query.state ||
      query.state_government ||
      query.government ||
      query.recovering_state ||
      query.pending_state ||
      query.has_conflict ||
      query.population ||
      query.powerplay_state ||
      query.cf_in_conflict

    // If no filters and no path system name, return error
    if (!hasFilters && Option.isNone(systemName)) {
      return yield* Effect.fail(
        HttpApiSchema.HttpApiDecodeError.make({
          status: 400,
          error: "Please provide at least one search filter (system name, faction, state, etc.)",
        })
      )
    }

    // If filters provided or no path system name, return filtered list
    if (hasFilters || Option.isNone(systemName)) {
      let systems: Set<string> | null = null

      // System name filter
      if (query.system_name) {
        const matches = yield* eddnRepo.findSystemsByNamePattern(query.system_name)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Faction presence
      if (query.faction) {
        const matches = yield* eddnRepo.findSystemsByFaction(query.faction)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Controlling faction
      if (query.controlling_faction) {
        const matches = yield* eddnRepo.findSystemsByControllingFaction(query.controlling_faction)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Controlling power
      if (query.controlling_power) {
        const matches = yield* eddnRepo.findSystemsByControllingPower(query.controlling_power)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Government
      if (query.government) {
        const matches = yield* eddnRepo.findSystemsByGovernment(query.government)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // State Government (state:government format)
      if (query.state_government) {
        const parts = query.state_government.split(":")
        if (parts.length === 2) {
          const [stateVal, govVal] = parts
          const matches = yield* eddnRepo.findSystemsByStateAndGovernment(stateVal, govVal)
          systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
        }
      }

      // Power (from system_info or powerplay)
      if (query.power) {
        const matches = yield* eddnRepo.findSystemsByPower(query.power)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // State (from faction state or active_states)
      if (query.state) {
        const matches = yield* eddnRepo.findSystemsByState(query.state)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Recovering state
      if (query.recovering_state) {
        const matches = yield* eddnRepo.findSystemsByRecoveringState(query.recovering_state)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Pending state
      if (query.pending_state) {
        const matches = yield* eddnRepo.findSystemsByPendingState(query.pending_state)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Has conflict
      if (isTruthy(query.has_conflict)) {
        const matches = yield* eddnRepo.findSystemsWithConflicts()
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Population filter
      if (query.population) {
        const matches = yield* eddnRepo.findSystemsByPopulation(query.population)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // Powerplay state
      if (query.powerplay_state) {
        const matches = yield* eddnRepo.findSystemsByPowerplayState(query.powerplay_state)
        systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
      }

      // CF in conflict (requires controlling_faction to be set)
      if (isTruthy(query.cf_in_conflict)) {
        if (!query.controlling_faction) {
          return yield* Effect.fail(
            HttpApiSchema.HttpApiDecodeError.make({
              status: 400,
              error: "For cf_in_conflict, controlling_faction must be specified.",
            })
          )
        }
        const cfSystems = yield* eddnRepo.findSystemsByControllingFaction(query.controlling_faction)
        const conflictSystems = yield* eddnRepo.findSystemsWithConflictsForFaction(query.controlling_faction)
        const cfInConflictSystems = cfSystems.filter((s) => conflictSystems.includes(s))
        systems = systems === null ? new Set(cfInConflictSystems) : new Set([...systems].filter((s) => cfInConflictSystems.includes(s)))
      }

      // If still no systems found, return error
      if (systems === null || systems.size === 0) {
        return yield* Effect.fail(
          HttpApiSchema.HttpApiDecodeError.make({
            status: 400,
            error: "Please provide at least one search filter (system name, faction, state, etc.)",
          })
        )
      }

      // If too many systems, return error with limited list
      if (systems.size > MAX_SYSTEMS) {
        return new SystemSearchErrorResponse({
          error: "Too many systems found. Please narrow down your filters.",
          count: systems.size,
          systems: Array.from(systems).sort().slice(0, MAX_SYSTEMS),
        })
      }

      // Fetch details for all systems
      const systemDetails = yield* Effect.all(
        Array.from(systems).map((sysName) =>
          Effect.gen(function* () {
            const systemInfo = yield* eddnRepo.getSystemInfo(sysName)
            if (Option.isNone(systemInfo)) {
              return Option.none()
            }

            const conflicts = yield* eddnRepo.getConflictsForSystem(sysName)
            const factions = yield* eddnRepo.getFactionsForSystem(sysName)
            const powerplays = yield* eddnRepo.getPowerplayForSystem(sysName)

            return Option.some(
              new SystemDetailResponse({
                system_info: Option.getOrThrow(systemInfo),
                conflicts,
                factions,
                powerplays,
              })
            )
          })
        ),
        { concurrency: 10 }
      )

      const validSystems = systemDetails.filter(Option.isSome).map(Option.getOrThrow)

      return new SystemListResponse({
        systems: validSystems,
        count: validSystems.length,
      })
    }

    // Default: Single system lookup by path parameter
    const sysName = Option.getOrThrow(systemName)
    const systemInfo = yield* eddnRepo.getSystemInfo(sysName)

    if (Option.isNone(systemInfo)) {
      return yield* Effect.fail(
        HttpApiSchema.HttpApiDecodeError.make({
          status: 404,
          error: `System '${sysName}' not found`,
        })
      )
    }

    const conflicts = yield* eddnRepo.getConflictsForSystem(sysName)
    const factions = yield* eddnRepo.getFactionsForSystem(sysName)
    const powerplays = yield* eddnRepo.getPowerplayForSystem(sysName)

    return new SystemDetailResponse({
      system_info: Option.getOrThrow(systemInfo),
      conflicts,
      factions,
      powerplays,
    })
  })
