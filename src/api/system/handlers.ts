import { Effect, Option } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import { EddnRepository } from "../../domain/repositories.js"
import type { SystemSummaryQuery } from "./dtos.js"
import {
  SystemDetailResponse,
  SystemListResponse,
  SystemSearchErrorResponse,
  EddnSystemInfo as EddnSystemInfoDTO,
  EddnConflict as EddnConflictDTO,
  EddnFaction as EddnFactionDTO,
  EddnPowerplay as EddnPowerplayDTO,
} from "./dtos.js"
import type * as DomainModels from "../../domain/models.js"

const MAX_SYSTEMS = 400

// Helper to check if a boolean-like string is truthy
const isTruthy = (value: string | undefined): boolean => {
  if (!value) return false
  return ["1", "true", "yes"].includes(value.toLowerCase())
}

// Map domain models to DTOs
const mapSystemInfo = (domain: DomainModels.EddnSystemInfo): EddnSystemInfoDTO => {
  return new EddnSystemInfoDTO({
    id: domain.id,
    system_name: domain.systemName,
    system_address: undefined, // Not in domain model
    controlling_faction: Option.getOrUndefined(domain.controllingFaction),
    controlling_power: Option.getOrUndefined(domain.controllingPower),
    population: Option.getOrUndefined(domain.population),
    allegiance: Option.getOrUndefined(domain.allegiance),
    government: Option.getOrUndefined(domain.government),
    security: Option.getOrUndefined(domain.security),
    economy: undefined, // Not in domain model
    second_economy: undefined, // Not in domain model
    timestamp: domain.updatedAt.toISOString(),
  })
}

const mapConflict = (domain: DomainModels.EddnConflict): EddnConflictDTO => {
  return new EddnConflictDTO({
    id: domain.id,
    system_name: domain.systemName,
    conflict_type: Option.getOrUndefined(domain.warType),
    status: Option.getOrUndefined(domain.status),
    faction1: Option.getOrUndefined(domain.faction1),
    faction1_stake: Option.getOrUndefined(domain.stake1),
    faction1_won: Option.getOrUndefined(domain.wonDays1),
    faction2: Option.getOrUndefined(domain.faction2),
    faction2_stake: Option.getOrUndefined(domain.stake2),
    faction2_won: Option.getOrUndefined(domain.wonDays2),
    timestamp: domain.updatedAt.toISOString(),
  })
}

const mapFaction = (domain: DomainModels.EddnFaction): EddnFactionDTO => {
  // Convert JSON fields to strings
  const stringifyJson = (opt: Option.Option<unknown>): string | undefined => {
    if (Option.isNone(opt)) return undefined
    const val = opt.value
    return typeof val === "string" ? val : JSON.stringify(val)
  }

  return new EddnFactionDTO({
    id: domain.id,
    system_name: domain.systemName,
    name: domain.name,
    allegiance: Option.getOrUndefined(domain.allegiance),
    government: Option.getOrUndefined(domain.government),
    influence: Option.getOrUndefined(domain.influence),
    state: Option.getOrUndefined(domain.state),
    happiness: undefined, // Not in domain model
    active_states: stringifyJson(domain.activeStates),
    pending_states: stringifyJson(domain.pendingStates),
    recovering_states: stringifyJson(domain.recoveringStates),
    timestamp: domain.updatedAt.toISOString(),
  })
}

const mapPowerplay = (domain: DomainModels.EddnPowerplay): EddnPowerplayDTO => {
  // Convert power JSON field to string
  const stringifyJson = (opt: Option.Option<unknown>): string | undefined => {
    if (Option.isNone(opt)) return undefined
    const val = opt.value
    return typeof val === "string" ? val : JSON.stringify(val)
  }

  return new EddnPowerplayDTO({
    id: domain.id,
    system_name: domain.systemName,
    power: stringifyJson(domain.power),
    powerplay_state: Option.getOrUndefined(domain.powerplayState),
    timestamp: domain.updatedAt.toISOString(),
  })
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

    // If no filters and no path system name, return error response
    if (!hasFilters && Option.isNone(systemName)) {
      return new SystemSearchErrorResponse({
        error: "Please provide at least one search filter (system name, faction, state, etc.)",
        count: 0,
        systems: [],
      })
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
          const stateVal = parts[0]!
          const govVal = parts[1]!
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

      // CF in conflict
      if (isTruthy(query.cf_in_conflict)) {
        if (query.controlling_faction) {
          // Specific controlling faction in conflict
          const cfSystems = yield* eddnRepo.findSystemsByControllingFaction(query.controlling_faction)
          const conflictSystems = yield* eddnRepo.findSystemsWithConflictsForFaction(query.controlling_faction)
          const cfInConflictSystems = cfSystems.filter((s) => conflictSystems.includes(s))
          systems = systems === null ? new Set(cfInConflictSystems) : new Set([...systems].filter((s) => cfInConflictSystems.includes(s)))
        } else {
          // Any controlling faction in conflict
          const matches = yield* eddnRepo.findSystemsWithControllingFactionInConflict()
          systems = systems === null ? new Set(matches) : new Set([...systems].filter((s) => matches.includes(s)))
        }
      }

      // If still no systems found, return error response
      if (systems === null || systems.size === 0) {
        return new SystemSearchErrorResponse({
          error: "No systems found matching the provided filters.",
          count: 0,
          systems: [],
        })
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
                system_info: mapSystemInfo(Option.getOrThrow(systemInfo)),
                conflicts: conflicts.map(mapConflict) as readonly EddnConflictDTO[],
                factions: factions.map(mapFaction) as readonly EddnFactionDTO[],
                powerplays: powerplays.map(mapPowerplay) as readonly EddnPowerplayDTO[],
              })
            )
          })
        ),
        { concurrency: 10 }
      )

      const validSystems = systemDetails.filter(Option.isSome).map(Option.getOrThrow)

      return new SystemListResponse({
        systems: validSystems as readonly SystemDetailResponse[],
        count: validSystems.length,
      })
    }

    // Default: Single system lookup by path parameter
    const sysName = Option.getOrThrow(systemName)
    const systemInfo = yield* eddnRepo.getSystemInfo(sysName)

    if (Option.isNone(systemInfo)) {
      return new SystemSearchErrorResponse({
        error: `System '${sysName}' not found`,
        count: 0,
        systems: [],
      })
    }

    const conflicts = yield* eddnRepo.getConflictsForSystem(sysName)
    const factions = yield* eddnRepo.getFactionsForSystem(sysName)
    const powerplays = yield* eddnRepo.getPowerplayForSystem(sysName)

    return new SystemDetailResponse({
      system_info: mapSystemInfo(Option.getOrThrow(systemInfo)),
      conflicts: conflicts.map(mapConflict) as readonly EddnConflictDTO[],
      factions: factions.map(mapFaction) as readonly EddnFactionDTO[],
      powerplays: powerplays.map(mapPowerplay) as readonly EddnPowerplayDTO[],
    })
  })

// Handler wrappers for HTTP API endpoints
export const getSystemSummaryHandler = HttpApiBuilder.handler(
  Api,
  "system",
  "getSystemSummary",
  ({ path, urlParams }) => handleGetSystemSummary(Option.some(path.systemName), urlParams)
)

export const getSystemSummaryNoParamHandler = HttpApiBuilder.handler(
  Api,
  "system",
  "getSystemSummaryNoParam",
  ({ urlParams }) => handleGetSystemSummary(Option.none(), urlParams)
)

export const SystemApiLive = HttpApiBuilder.group(Api, "system", (handlers) =>
  handlers
    .handle("getSystemSummary", getSystemSummaryHandler)
    .handle("getSystemSummaryNoParam", getSystemSummaryNoParamHandler)
)
