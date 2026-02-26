import { Effect, Layer, Option, Schema } from "effect";
import { PgClient } from "../client.ts";
import { CmdrRepository } from "../../domain/repositories.ts";
import { Cmdr } from "../../domain/models.ts";
import { DatabaseError, CmdrNotFoundError, CmdrAlreadyExistsError } from "../../domain/errors.ts";
import { mapRowToCmdr } from "../../lib/utils.ts";

export const CmdrRepositoryLive = Layer.effect(
    CmdrRepository,
    Effect.gen(function* () {
        const client = yield* PgClient
        const decodeCmdr = Schema.decodeUnknown(Cmdr)

        return CmdrRepository.of({
            create: (cmdr) => Effect.tryPromise({
                try: () => client`INSERT INTO cmdr (id, name, rank_combat, rank_trade, rank_explore, rank_cqc, rank_empire, rank_federation, rank_power, credits, assets, inara_url, squadron_name, squadron_rank)
                          VALUES (${cmdr.id}, ${cmdr.name}, ${Option.getOrNull(cmdr.rankCombat)}, ${Option.getOrNull(cmdr.rankTrade)}, ${Option.getOrNull(cmdr.rankExplore)}, ${Option.getOrNull(cmdr.rankCqc)}, ${Option.getOrNull(cmdr.rankEmpire)}, ${Option.getOrNull(cmdr.rankFederation)}, ${Option.getOrNull(cmdr.rankPower)}, ${Option.getOrNull(cmdr.credits)}, ${Option.getOrNull(cmdr.assets)}, ${Option.getOrNull(cmdr.inaraUrl)}, ${Option.getOrNull(cmdr.squadronName)}, ${Option.getOrNull(cmdr.squadronRank)})`,
                catch: (error: any) => {
                    if (error?.message?.includes("UNIQUE constraint failed: cmdr.name")) {
                        return new CmdrAlreadyExistsError({ name: cmdr.name })
                    }
                    return new DatabaseError({
                        operation: 'create.cmdr', error
                    })
                }
            }).pipe(Effect.asVoid),

            findById: (id) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM cmdr WHERE id = ${id}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findById.cmdr', error
                    })
                })

                const row = (result as any)[0]
                if (!row) return Option.none()

                const cmdr = yield* decodeCmdr(mapRowToCmdr(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.cmdr', error
                    }))
                )

                return Option.some(cmdr)
            }),

            findByName: (name) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM cmdr WHERE name = ${name}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findByName.cmdr', error
                    })
                })

                const row = (result as any)[0]
                if (!row) return Option.none()

                const cmdr = yield* decodeCmdr(mapRowToCmdr(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.cmdr', error
                    }))
                )

                return Option.some(cmdr)
            }),

            findAll: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM cmdr ORDER BY name`,
                    catch: (error) => new DatabaseError({
                        operation: 'findAll.cmdr', error
                    })
                })

                // Collect raw data first, then decode all at once
                const rawCmdrs = result.map(mapRowToCmdr)

                const cmdrs = yield* Effect.forEach(rawCmdrs, (raw) =>
                    decodeCmdr(raw).pipe(
                        Effect.mapError((error) => new DatabaseError({
                            operation: 'decode.cmdr', error
                        }))
                    )
                )

                return cmdrs
            }),

            update: (cmdr) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`UPDATE cmdr
                              SET name = ${cmdr.name}, rank_combat = ${Option.getOrNull(cmdr.rankCombat)}, rank_trade = ${Option.getOrNull(cmdr.rankTrade)}, rank_explore = ${Option.getOrNull(cmdr.rankExplore)}, rank_cqc = ${Option.getOrNull(cmdr.rankCqc)},
                                  rank_empire = ${Option.getOrNull(cmdr.rankEmpire)}, rank_federation = ${Option.getOrNull(cmdr.rankFederation)}, rank_power = ${Option.getOrNull(cmdr.rankPower)}, credits = ${Option.getOrNull(cmdr.credits)}, assets = ${Option.getOrNull(cmdr.assets)},
                                  inara_url = ${Option.getOrNull(cmdr.inaraUrl)}, squadron_name = ${Option.getOrNull(cmdr.squadronName)}, squadron_rank = ${Option.getOrNull(cmdr.squadronRank)}
                              WHERE id = ${cmdr.id}`,
                    catch: (error) => new DatabaseError({
                        operation: "update.cmdr", error
                    })
                })

                if((result as any).length === 0) {
                    return yield* Effect.fail(new CmdrNotFoundError({ id: cmdr.id }))
                }
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client`DELETE FROM cmdr WHERE id = ${id}`,
                catch: (error) => new DatabaseError({ operation: 'delete.cmdr', error })
            }).pipe(Effect.asVoid)
        })
    })
)
