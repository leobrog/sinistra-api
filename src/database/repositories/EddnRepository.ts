import { Effect, Layer, Option, Schema } from "effect";
import { PgClient } from "../client.ts";
import { EddnRepository } from "../../domain/repositories.ts";
import { EddnSystemInfo, EddnFaction, EddnConflict, EddnPowerplay } from "../../domain/models.ts";
import { DatabaseError } from "../../domain/errors.ts";
import {
    mapRowToEddnSystemInfo,
    mapRowToEddnFaction,
    mapRowToEddnConflict,
    mapRowToEddnPowerplay
} from "../../lib/utils.ts";

export const EddnRepositoryLive = Layer.effect(
    EddnRepository,
    Effect.gen(function* () {
        const client = yield* PgClient
        const decodeEddnSystemInfo = Schema.decodeUnknown(EddnSystemInfo)
        const decodeEddnFaction = Schema.decodeUnknown(EddnFaction)
        const decodeEddnConflict = Schema.decodeUnknown(EddnConflict)
        const decodeEddnPowerplay = Schema.decodeUnknown(EddnPowerplay)

        return EddnRepository.of({
            saveMessage: (message) => Effect.tryPromise({
                try: () => client`INSERT INTO eddn_message (id, schema_ref, header_gateway_timestamp, message_type, message_json, timestamp)
                          VALUES (${message.id}, ${message.schemaRef}, ${Option.match(message.headerGatewayTimestamp, {
                                            onNone: () => null,
                                            onSome: (date) => date.toISOString(),
                                        })}, ${Option.getOrNull(message.messageType)}, ${message.messageJson}, ${message.timestamp.toISOString()})`,
                catch: (error) => new DatabaseError({
                    operation: 'saveMessage.eddn', error
                })
            }).pipe(Effect.asVoid),

            upsertSystemInfo: (info) => Effect.tryPromise({
                try: () => client`INSERT INTO eddn_system_info (id, eddn_message_id, system_name, controlling_faction, controlling_power, population, security, government, allegiance, updated_at)
                          VALUES (${info.id}, ${Option.getOrNull(info.eddnMessageId)}, ${info.systemName}, ${Option.getOrNull(info.controllingFaction)}, ${Option.getOrNull(info.controllingPower)}, ${Option.getOrNull(info.population)}, ${Option.getOrNull(info.security)}, ${Option.getOrNull(info.government)}, ${Option.getOrNull(info.allegiance)}, ${info.updatedAt.toISOString()})
                          ON CONFLICT(id) DO UPDATE SET
                            system_name = excluded.system_name,
                            controlling_faction = excluded.controlling_faction,
                            controlling_power = excluded.controlling_power,
                            population = excluded.population,
                            security = excluded.security,
                            government = excluded.government,
                            allegiance = excluded.allegiance,
                            updated_at = excluded.updated_at`,
                catch: (error) => new DatabaseError({
                    operation: 'upsertSystemInfo.eddn', error
                })
            }).pipe(Effect.asVoid),

            upsertFaction: (faction) => Effect.tryPromise({
                try: () => client`INSERT INTO eddn_faction (id, eddn_message_id, system_name, name, influence, state, allegiance, government, recovering_states, active_states, pending_states, updated_at)
                          VALUES (${faction.id}, ${Option.getOrNull(faction.eddnMessageId)}, ${faction.systemName}, ${faction.name}, ${Option.getOrNull(faction.influence)}, ${Option.getOrNull(faction.state)}, ${Option.getOrNull(faction.allegiance)}, ${Option.getOrNull(faction.government)}, ${Option.match(faction.recoveringStates, {
                                            onNone: () => null,
                                            onSome: (val) => JSON.stringify(val),
                                        })}, ${Option.match(faction.activeStates, {
                                            onNone: () => null,
                                            onSome: (val) => JSON.stringify(val),
                                        })}, ${Option.match(faction.pendingStates, {
                                            onNone: () => null,
                                            onSome: (val) => JSON.stringify(val),
                                        })}, ${faction.updatedAt.toISOString()})
                          ON CONFLICT(id) DO UPDATE SET
                            system_name = excluded.system_name,
                            name = excluded.name,
                            influence = excluded.influence,
                            state = excluded.state,
                            allegiance = excluded.allegiance,
                            government = excluded.government,
                            recovering_states = excluded.recovering_states,
                            active_states = excluded.active_states,
                            pending_states = excluded.pending_states,
                            updated_at = excluded.updated_at`,
                catch: (error) => new DatabaseError({
                    operation: 'upsertFaction.eddn', error
                })
            }).pipe(Effect.asVoid),

            upsertConflict: (conflict) => Effect.tryPromise({
                try: () => client`INSERT INTO eddn_conflict (id, eddn_message_id, system_name, faction1, faction2, stake1, stake2, won_days1, won_days2, status, war_type, updated_at)
                          VALUES (${conflict.id}, ${Option.getOrNull(conflict.eddnMessageId)}, ${conflict.systemName}, ${Option.getOrNull(conflict.faction1)}, ${Option.getOrNull(conflict.faction2)}, ${Option.getOrNull(conflict.stake1)}, ${Option.getOrNull(conflict.stake2)}, ${Option.getOrNull(conflict.wonDays1)}, ${Option.getOrNull(conflict.wonDays2)}, ${Option.getOrNull(conflict.status)}, ${Option.getOrNull(conflict.warType)}, ${conflict.updatedAt.toISOString()})
                          ON CONFLICT(id) DO UPDATE SET
                            system_name = excluded.system_name,
                            faction1 = excluded.faction1,
                            faction2 = excluded.faction2,
                            stake1 = excluded.stake1,
                            stake2 = excluded.stake2,
                            won_days1 = excluded.won_days1,
                            won_days2 = excluded.won_days2,
                            status = excluded.status,
                            war_type = excluded.war_type,
                            updated_at = excluded.updated_at`,
                catch: (error) => new DatabaseError({
                    operation: 'upsertConflict.eddn', error
                })
            }).pipe(Effect.asVoid),

            upsertPowerplay: (powerplay) => Effect.tryPromise({
                try: () => client`INSERT INTO eddn_powerplay (id, eddn_message_id, system_name, power, powerplay_state, control_progress, reinforcement, undermining, updated_at)
                          VALUES (${powerplay.id}, ${Option.getOrNull(powerplay.eddnMessageId)}, ${powerplay.systemName}, ${Option.match(powerplay.power, {
                                            onNone: () => null,
                                            onSome: (val) => JSON.stringify(val),
                                        })}, ${Option.getOrNull(powerplay.powerplayState)}, ${Option.getOrNull(powerplay.controlProgress)}, ${Option.getOrNull(powerplay.reinforcement)}, ${Option.getOrNull(powerplay.undermining)}, ${powerplay.updatedAt.toISOString()})
                          ON CONFLICT(id) DO UPDATE SET
                            system_name = excluded.system_name,
                            power = excluded.power,
                            powerplay_state = excluded.powerplay_state,
                            control_progress = excluded.control_progress,
                            reinforcement = excluded.reinforcement,
                            undermining = excluded.undermining,
                            updated_at = excluded.updated_at`,
                catch: (error) => new DatabaseError({
                    operation: 'upsertPowerplay.eddn', error
                })
            }).pipe(Effect.asVoid),

            findSystemInfo: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM eddn_system_info WHERE system_name = ${systemName} ORDER BY updated_at DESC LIMIT 1`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemInfo.eddn', error
                    })
                })

                const row = (result as any)[0]
                if (!row) return Option.none()

                const systemInfo = yield* decodeEddnSystemInfo(mapRowToEddnSystemInfo(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.eddnSystemInfo', error
                    }))
                )

                return Option.some(systemInfo)
            }),

            findFactionsInSystem: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM eddn_faction WHERE system_name = ${systemName} ORDER BY updated_at DESC`,
                    catch: (error) => new DatabaseError({
                        operation: 'findFactionsInSystem.eddn', error
                    })
                })

                const rawFactions = result.map(mapRowToEddnFaction)

                const factions = yield* Effect.forEach(rawFactions, (raw) =>
                    decodeEddnFaction(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.eddnFaction', error
                        }))
                    )
                )

                return factions
            }),

            findConflictsInSystem: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM eddn_conflict WHERE system_name = ${systemName} ORDER BY updated_at DESC`,
                    catch: (error) => new DatabaseError({
                        operation: 'findConflictsInSystem.eddn', error
                    })
                })

                const rawConflicts = result.map(mapRowToEddnConflict)

                const conflicts = yield* Effect.forEach(rawConflicts, (raw) =>
                    decodeEddnConflict(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.eddnConflict', error
                        }))
                    )
                )

                return conflicts
            }),

            cleanupOldMessages: (olderThan) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`DELETE FROM eddn_message WHERE timestamp < ${olderThan.toISOString()}`,
                    catch: (error) => new DatabaseError({
                        operation: 'cleanupOldMessages.eddn', error
                    })
                })

                return (result as any).length
            }),

            getAllSystemNames: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_system_info ORDER BY system_name`,
                    catch: (error) => new DatabaseError({
                        operation: 'getAllSystemNames.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            // System summary query methods
            getSystemInfo: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM eddn_system_info WHERE system_name ILIKE ${systemName} ORDER BY updated_at DESC LIMIT 1`,
                    catch: (error) => new DatabaseError({
                        operation: 'getSystemInfo.eddn', error
                    })
                })

                const row = (result as any)[0]
                if (!row) return Option.none()

                const systemInfo = yield* decodeEddnSystemInfo(mapRowToEddnSystemInfo(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.eddnSystemInfo', error
                    }))
                )

                return Option.some(systemInfo)
            }),

            getConflictsForSystem: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM eddn_conflict WHERE system_name ILIKE ${systemName} ORDER BY updated_at DESC`,
                    catch: (error) => new DatabaseError({
                        operation: 'getConflictsForSystem.eddn', error
                    })
                })

                const rawConflicts = result.map(mapRowToEddnConflict)
                const conflicts = yield* Effect.forEach(rawConflicts, (raw) =>
                    decodeEddnConflict(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.eddnConflict', error
                        }))
                    )
                )

                return conflicts
            }),

            getFactionsForSystem: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM eddn_faction WHERE system_name ILIKE ${systemName} ORDER BY updated_at DESC`,
                    catch: (error) => new DatabaseError({
                        operation: 'getFactionsForSystem.eddn', error
                    })
                })

                const rawFactions = result.map(mapRowToEddnFaction)
                const factions = yield* Effect.forEach(rawFactions, (raw) =>
                    decodeEddnFaction(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.eddnFaction', error
                        }))
                    )
                )

                return factions
            }),

            getPowerplayForSystem: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM eddn_powerplay WHERE system_name ILIKE ${systemName} ORDER BY updated_at DESC`,
                    catch: (error) => new DatabaseError({
                        operation: 'getPowerplayForSystem.eddn', error
                    })
                })

                const rawPowerplays = result.map(mapRowToEddnPowerplay)
                const powerplays = yield* Effect.forEach(rawPowerplays, (raw) =>
                    decodeEddnPowerplay(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.eddnPowerplay', error
                        }))
                    )
                )

                return powerplays
            }),

            findSystemsByNamePattern: (pattern) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_system_info WHERE system_name LIKE ${`%${pattern}%`} `,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByNamePattern.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsByFaction: (factionName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_faction WHERE name ILIKE ${factionName}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByFaction.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsByControllingFaction: (factionName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_system_info WHERE controlling_faction ILIKE ${factionName}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByControllingFaction.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsByControllingPower: (power) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_system_info WHERE controlling_power ILIKE ${power}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByControllingPower.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsByGovernment: (government) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_system_info WHERE government ILIKE ${government}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByGovernment.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsByStateAndGovernment: (state, government) => Effect.gen(function* () {
                const resultState = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_faction WHERE government ILIKE ${government} AND state ILIKE ${state}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByStateAndGovernment.state.eddn', error
                    })
                })

                const resultActive = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_faction WHERE government ILIKE ${government} AND active_states LIKE ${`%${state}%`}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByStateAndGovernment.active.eddn', error
                    })
                })

                const systems1 = (resultState as any[]).map((row) => row.system_name as string)
                const systems2 = (resultActive as any[]).map((row) => row.system_name as string)

                return Array.from(new Set([...systems1, ...systems2]))
            }),

            findSystemsByPower: (power) => Effect.gen(function* () {
                const resultSi = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_system_info WHERE controlling_power ILIKE ${power}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPower.systemInfo.eddn', error
                    })
                })

                const resultPp = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_powerplay WHERE power->>0 ILIKE ${power} OR power LIKE ${`%${power}%`}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPower.powerplay.eddn', error
                    })
                })

                const systems1 = (resultSi as any[]).map((row) => row.system_name as string)
                const systems2 = (resultPp as any[]).map((row) => row.system_name as string)

                return Array.from(new Set([...systems1, ...systems2]))
            }),

            findSystemsByState: (state) => Effect.gen(function* () {
                const resultState = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_faction WHERE state ILIKE ${state}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByState.state.eddn', error
                    })
                })

                const resultActive = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_faction WHERE active_states LIKE ${`%${state}%`}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByState.active.eddn', error
                    })
                })

                const systems1 = (resultState as any[]).map((row) => row.system_name as string)
                const systems2 = (resultActive as any[]).map((row) => row.system_name as string)

                return Array.from(new Set([...systems1, ...systems2]))
            }),

            findSystemsByRecoveringState: (state) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_faction WHERE recovering_states LIKE ${`%${state}%`}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByRecoveringState.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsByPendingState: (state) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_faction WHERE pending_states LIKE ${`%${state}%`}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPendingState.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsWithConflicts: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_conflict`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsWithConflicts.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsByPopulation: (populationFilter) => Effect.gen(function* () {
                let sql: string
                let args: Array<number>

                if (populationFilter.startsWith("<")) {
                    const popVal = parseInt(populationFilter.slice(1), 10)
                    sql = "SELECT DISTINCT system_name FROM eddn_system_info WHERE population < ?"
                    args = [popVal]
                } else if (populationFilter.startsWith(">")) {
                    const popVal = parseInt(populationFilter.slice(1), 10)
                    sql = "SELECT DISTINCT system_name FROM eddn_system_info WHERE population > ?"
                    args = [popVal]
                } else if (populationFilter.includes("-")) {
                    const [minStr, maxStr] = populationFilter.split("-")
                    const popMin = parseInt(minStr!, 10)
                    const popMax = parseInt(maxStr!, 10)
                    sql = "SELECT DISTINCT system_name FROM eddn_system_info WHERE population >= ? AND population <= ?"
                    args = [popMin, popMax]
                } else {
                    const popVal = parseInt(populationFilter, 10)
                    sql = "SELECT DISTINCT system_name FROM eddn_system_info WHERE population = ?"
                    args = [popVal]
                }

                const result = yield* Effect.tryPromise({
                    try: () => client.unsafe(sql as any),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPopulation.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsByPowerplayState: (state) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_powerplay WHERE powerplay_state ILIKE ${state}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPowerplayState.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsWithConflictsForFaction: (factionName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT system_name FROM eddn_conflict WHERE faction1 ILIKE ${factionName} OR faction2 ILIKE ${factionName}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsWithConflictsForFaction.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),

            findSystemsWithControllingFactionInConflict: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT DISTINCT s.system_name 
                              FROM eddn_system_info s
                              JOIN eddn_conflict c ON s.system_name = c.system_name
                              WHERE s.controlling_faction = c.faction1 
                                 OR s.controlling_faction = c.faction2 `,
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsWithControllingFactionInConflict.eddn', error
                    })
                })

                return (result as any[]).map((row) => row.system_name as string)
            }),
        })
    })
)
