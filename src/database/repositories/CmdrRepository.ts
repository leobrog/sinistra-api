import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { CmdrRepository } from "../../domain/repositories.ts";
import { Cmdr } from "../../domain/models.ts";
import { DatabaseError, CmdrNotFoundError, CmdrAlreadyExistsError } from "../../domain/errors.ts";
import { mapRowToCmdr } from "../../lib/utils.ts";

export const CmdrRepositoryLive = Layer.effect(
    CmdrRepository,
    Effect.gen(function* () {
        const client = yield* TursoClient
        const decodeCmdr = Schema.decodeUnknown(Cmdr)

        return CmdrRepository.of({
            create: (cmdr) => Effect.tryPromise({
                try: () => client.execute({
                    sql: `INSERT INTO cmdr (id, name, rank_combat, rank_trade, rank_explore, rank_cqc, rank_empire, rank_federation, rank_power, credits, assets, inara_url, squadron_name, squadron_rank)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        cmdr.id,
                        cmdr.name,
                        Option.getOrNull(cmdr.rankCombat),
                        Option.getOrNull(cmdr.rankTrade),
                        Option.getOrNull(cmdr.rankExplore),
                        Option.getOrNull(cmdr.rankCqc),
                        Option.getOrNull(cmdr.rankEmpire),
                        Option.getOrNull(cmdr.rankFederation),
                        Option.getOrNull(cmdr.rankPower),
                        Option.getOrNull(cmdr.credits),
                        Option.getOrNull(cmdr.assets),
                        Option.getOrNull(cmdr.inaraUrl),
                        Option.getOrNull(cmdr.squadronName),
                        Option.getOrNull(cmdr.squadronRank),
                    ],
                }),
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
                    try: () => client.execute({
                        sql: "SELECT * FROM cmdr WHERE id = ?",
                        args: [id]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findById.cmdr', error
                    })
                })

                const row = result.rows[0]
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
                    try: () => client.execute({
                        sql: "SELECT * FROM cmdr WHERE name = ?",
                        args: [name]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findByName.cmdr', error
                    })
                })

                const row = result.rows[0]
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
                    try: () => client.execute("SELECT * FROM cmdr ORDER BY name"),
                    catch: (error) => new DatabaseError({
                        operation: 'findAll.cmdr', error
                    })
                })

                // Collect raw data first, then decode all at once
                const rawCmdrs = result.rows.map(mapRowToCmdr)

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
                    try: () => client.execute({
                        sql: `UPDATE cmdr
                              SET name = ?, rank_combat = ?, rank_trade = ?, rank_explore = ?, rank_cqc = ?,
                                  rank_empire = ?, rank_federation = ?, rank_power = ?, credits = ?, assets = ?,
                                  inara_url = ?, squadron_name = ?, squadron_rank = ?
                              WHERE id = ?`,
                        args: [
                            cmdr.name,
                            Option.getOrNull(cmdr.rankCombat),
                            Option.getOrNull(cmdr.rankTrade),
                            Option.getOrNull(cmdr.rankExplore),
                            Option.getOrNull(cmdr.rankCqc),
                            Option.getOrNull(cmdr.rankEmpire),
                            Option.getOrNull(cmdr.rankFederation),
                            Option.getOrNull(cmdr.rankPower),
                            Option.getOrNull(cmdr.credits),
                            Option.getOrNull(cmdr.assets),
                            Option.getOrNull(cmdr.inaraUrl),
                            Option.getOrNull(cmdr.squadronName),
                            Option.getOrNull(cmdr.squadronRank),
                            cmdr.id
                        ]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: "update.cmdr", error
                    })
                })

                if(result.rowsAffected === 0) {
                    return yield* Effect.fail(new CmdrNotFoundError({ id: cmdr.id }))
                }
            }),

            delete: (id) => Effect.tryPromise({
                try: () => client.execute({
                    sql: "DELETE FROM cmdr WHERE id = ?",
                    args: [id]
                }),
                catch: (error) => new DatabaseError({ operation: 'delete.cmdr', error })
            }).pipe(Effect.asVoid)
        })
    })
)
