import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
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
        const client = yield* TursoClient
        const decodeEddnSystemInfo = Schema.decodeUnknown(EddnSystemInfo)
        const decodeEddnFaction = Schema.decodeUnknown(EddnFaction)
        const decodeEddnConflict = Schema.decodeUnknown(EddnConflict)
        const decodeEddnPowerplay = Schema.decodeUnknown(EddnPowerplay)

        return EddnRepository.of({
            saveMessage: (message) => Effect.tryPromise({
                try: () => client.execute({
                    sql: `INSERT INTO eddn_message (id, schema_ref, header_gateway_timestamp, message_type, message_json, timestamp)
                          VALUES (?, ?, ?, ?, ?, ?)`,
                    args: [
                        message.id,
                        message.schemaRef,
                        Option.match(message.headerGatewayTimestamp, {
                            onNone: () => null,
                            onSome: (date) => date.toISOString(),
                        }),
                        Option.getOrNull(message.messageType),
                        message.messageJson,
                        message.timestamp.toISOString(),
                    ],
                }),
                catch: (error) => new DatabaseError({
                    operation: 'saveMessage.eddn', error
                })
            }).pipe(Effect.asVoid),

            upsertSystemInfo: (info) => Effect.tryPromise({
                try: () => client.execute({
                    sql: `INSERT INTO eddn_system_info (id, eddn_message_id, system_name, controlling_faction, controlling_power, population, security, government, allegiance, updated_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                          ON CONFLICT(id) DO UPDATE SET
                            system_name = excluded.system_name,
                            controlling_faction = excluded.controlling_faction,
                            controlling_power = excluded.controlling_power,
                            population = excluded.population,
                            security = excluded.security,
                            government = excluded.government,
                            allegiance = excluded.allegiance,
                            updated_at = excluded.updated_at`,
                    args: [
                        info.id,
                        Option.getOrNull(info.eddnMessageId),
                        info.systemName,
                        Option.getOrNull(info.controllingFaction),
                        Option.getOrNull(info.controllingPower),
                        Option.getOrNull(info.population),
                        Option.getOrNull(info.security),
                        Option.getOrNull(info.government),
                        Option.getOrNull(info.allegiance),
                        info.updatedAt.toISOString(),
                    ],
                }),
                catch: (error) => new DatabaseError({
                    operation: 'upsertSystemInfo.eddn', error
                })
            }).pipe(Effect.asVoid),

            upsertFaction: (faction) => Effect.tryPromise({
                try: () => client.execute({
                    sql: `INSERT INTO eddn_faction (id, eddn_message_id, system_name, name, influence, state, allegiance, government, recovering_states, active_states, pending_states, updated_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    args: [
                        faction.id,
                        Option.getOrNull(faction.eddnMessageId),
                        faction.systemName,
                        faction.name,
                        Option.getOrNull(faction.influence),
                        Option.getOrNull(faction.state),
                        Option.getOrNull(faction.allegiance),
                        Option.getOrNull(faction.government),
                        // Serialize JSON fields to TEXT
                        Option.match(faction.recoveringStates, {
                            onNone: () => null,
                            onSome: (val) => JSON.stringify(val),
                        }),
                        Option.match(faction.activeStates, {
                            onNone: () => null,
                            onSome: (val) => JSON.stringify(val),
                        }),
                        Option.match(faction.pendingStates, {
                            onNone: () => null,
                            onSome: (val) => JSON.stringify(val),
                        }),
                        faction.updatedAt.toISOString(),
                    ],
                }),
                catch: (error) => new DatabaseError({
                    operation: 'upsertFaction.eddn', error
                })
            }).pipe(Effect.asVoid),

            upsertConflict: (conflict) => Effect.tryPromise({
                try: () => client.execute({
                    sql: `INSERT INTO eddn_conflict (id, eddn_message_id, system_name, faction1, faction2, stake1, stake2, won_days1, won_days2, status, war_type, updated_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    args: [
                        conflict.id,
                        Option.getOrNull(conflict.eddnMessageId),
                        conflict.systemName,
                        Option.getOrNull(conflict.faction1),
                        Option.getOrNull(conflict.faction2),
                        Option.getOrNull(conflict.stake1),
                        Option.getOrNull(conflict.stake2),
                        Option.getOrNull(conflict.wonDays1),
                        Option.getOrNull(conflict.wonDays2),
                        Option.getOrNull(conflict.status),
                        Option.getOrNull(conflict.warType),
                        conflict.updatedAt.toISOString(),
                    ],
                }),
                catch: (error) => new DatabaseError({
                    operation: 'upsertConflict.eddn', error
                })
            }).pipe(Effect.asVoid),

            upsertPowerplay: (powerplay) => Effect.tryPromise({
                try: () => client.execute({
                    sql: `INSERT INTO eddn_powerplay (id, eddn_message_id, system_name, power, powerplay_state, control_progress, reinforcement, undermining, updated_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                          ON CONFLICT(id) DO UPDATE SET
                            system_name = excluded.system_name,
                            power = excluded.power,
                            powerplay_state = excluded.powerplay_state,
                            control_progress = excluded.control_progress,
                            reinforcement = excluded.reinforcement,
                            undermining = excluded.undermining,
                            updated_at = excluded.updated_at`,
                    args: [
                        powerplay.id,
                        Option.getOrNull(powerplay.eddnMessageId),
                        powerplay.systemName,
                        // Serialize JSON field to TEXT
                        Option.match(powerplay.power, {
                            onNone: () => null,
                            onSome: (val) => JSON.stringify(val),
                        }),
                        Option.getOrNull(powerplay.powerplayState),
                        Option.getOrNull(powerplay.controlProgress),
                        Option.getOrNull(powerplay.reinforcement),
                        Option.getOrNull(powerplay.undermining),
                        powerplay.updatedAt.toISOString(),
                    ],
                }),
                catch: (error) => new DatabaseError({
                    operation: 'upsertPowerplay.eddn', error
                })
            }).pipe(Effect.asVoid),

            findSystemInfo: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM eddn_system_info WHERE system_name = ? ORDER BY updated_at DESC LIMIT 1",
                        args: [systemName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemInfo.eddn', error
                    })
                })

                const row = result.rows[0]
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
                    try: () => client.execute({
                        sql: "SELECT * FROM eddn_faction WHERE system_name = ? ORDER BY updated_at DESC",
                        args: [systemName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findFactionsInSystem.eddn', error
                    })
                })

                const rawFactions = result.rows.map(mapRowToEddnFaction)

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
                    try: () => client.execute({
                        sql: "SELECT * FROM eddn_conflict WHERE system_name = ? ORDER BY updated_at DESC",
                        args: [systemName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findConflictsInSystem.eddn', error
                    })
                })

                const rawConflicts = result.rows.map(mapRowToEddnConflict)

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
                    try: () => client.execute({
                        sql: "DELETE FROM eddn_message WHERE timestamp < ?",
                        args: [olderThan.toISOString()]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'cleanupOldMessages.eddn', error
                    })
                })

                return result.rowsAffected
            }),

            getAllSystemNames: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_system_info ORDER BY system_name",
                        args: []
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'getAllSystemNames.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            // System summary query methods
            getSystemInfo: (systemName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM eddn_system_info WHERE system_name = ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT 1",
                        args: [systemName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'getSystemInfo.eddn', error
                    })
                })

                const row = result.rows[0]
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
                    try: () => client.execute({
                        sql: "SELECT * FROM eddn_conflict WHERE system_name = ? COLLATE NOCASE ORDER BY updated_at DESC",
                        args: [systemName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'getConflictsForSystem.eddn', error
                    })
                })

                const rawConflicts = result.rows.map(mapRowToEddnConflict)
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
                    try: () => client.execute({
                        sql: "SELECT * FROM eddn_faction WHERE system_name = ? COLLATE NOCASE ORDER BY updated_at DESC",
                        args: [systemName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'getFactionsForSystem.eddn', error
                    })
                })

                const rawFactions = result.rows.map(mapRowToEddnFaction)
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
                    try: () => client.execute({
                        sql: "SELECT * FROM eddn_powerplay WHERE system_name = ? COLLATE NOCASE ORDER BY updated_at DESC",
                        args: [systemName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'getPowerplayForSystem.eddn', error
                    })
                })

                const rawPowerplays = result.rows.map(mapRowToEddnPowerplay)
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
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_system_info WHERE system_name LIKE ? COLLATE NOCASE",
                        args: [`%${pattern}%`]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByNamePattern.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsByFaction: (factionName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_faction WHERE name = ? COLLATE NOCASE",
                        args: [factionName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByFaction.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsByControllingFaction: (factionName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_system_info WHERE controlling_faction = ? COLLATE NOCASE",
                        args: [factionName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByControllingFaction.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsByControllingPower: (power) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_system_info WHERE controlling_power = ? COLLATE NOCASE",
                        args: [power]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByControllingPower.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsByGovernment: (government) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_faction WHERE government = ? COLLATE NOCASE",
                        args: [government]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByGovernment.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsByStateAndGovernment: (state, government) => Effect.gen(function* () {
                const resultState = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_faction WHERE government = ? COLLATE NOCASE AND state = ? COLLATE NOCASE",
                        args: [government, state]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByStateAndGovernment.state.eddn', error
                    })
                })

                const resultActive = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_faction WHERE government = ? COLLATE NOCASE AND active_states LIKE ?",
                        args: [government, `%${state}%`]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByStateAndGovernment.active.eddn', error
                    })
                })

                const systems1 = resultState.rows.map((row) => row.system_name as string)
                const systems2 = resultActive.rows.map((row) => row.system_name as string)

                return Array.from(new Set([...systems1, ...systems2]))
            }),

            findSystemsByPower: (power) => Effect.gen(function* () {
                const resultSi = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_system_info WHERE controlling_power = ? COLLATE NOCASE",
                        args: [power]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPower.systemInfo.eddn', error
                    })
                })

                const resultPp = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: `SELECT DISTINCT system_name FROM eddn_powerplay WHERE json_extract(power, '$[0]') = ? COLLATE NOCASE OR power LIKE ?`,
                        args: [power, `%${power}%`]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPower.powerplay.eddn', error
                    })
                })

                const systems1 = resultSi.rows.map((row) => row.system_name as string)
                const systems2 = resultPp.rows.map((row) => row.system_name as string)

                return Array.from(new Set([...systems1, ...systems2]))
            }),

            findSystemsByState: (state) => Effect.gen(function* () {
                const resultState = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_faction WHERE state = ? COLLATE NOCASE",
                        args: [state]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByState.state.eddn', error
                    })
                })

                const resultActive = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_faction WHERE active_states LIKE ?",
                        args: [`%${state}%`]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByState.active.eddn', error
                    })
                })

                const systems1 = resultState.rows.map((row) => row.system_name as string)
                const systems2 = resultActive.rows.map((row) => row.system_name as string)

                return Array.from(new Set([...systems1, ...systems2]))
            }),

            findSystemsByRecoveringState: (state) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_faction WHERE recovering_states LIKE ?",
                        args: [`%${state}%`]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByRecoveringState.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsByPendingState: (state) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_faction WHERE pending_states LIKE ?",
                        args: [`%${state}%`]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPendingState.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsWithConflicts: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_conflict",
                        args: []
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsWithConflicts.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
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
                    try: () => client.execute({ sql, args }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPopulation.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsByPowerplayState: (state) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_powerplay WHERE powerplay_state = ? COLLATE NOCASE",
                        args: [state]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsByPowerplayState.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),

            findSystemsWithConflictsForFaction: (factionName) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT DISTINCT system_name FROM eddn_conflict WHERE faction1 = ? COLLATE NOCASE OR faction2 = ? COLLATE NOCASE",
                        args: [factionName, factionName]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findSystemsWithConflictsForFaction.eddn', error
                    })
                })

                return result.rows.map((row) => row.system_name as string)
            }),
        })
    })
)
