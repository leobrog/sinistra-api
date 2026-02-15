import { Effect, Layer, Option, Schema } from "effect";
import { TursoClient } from "../client.ts";
import { TickRepository } from "../../domain/repositories.ts";
import { TickState } from "../../domain/models.ts";
import { DatabaseError } from "../../domain/errors.ts";
import { mapRowToTickState } from "../../lib/utils.ts";

export const TickRepositoryLive = Layer.effect(
    TickRepository,
    Effect.gen(function* () {
        const client = yield* TursoClient
        const decodeTickState = Schema.decodeUnknown(TickState)

        return TickRepository.of({
            upsert: (tick) => Effect.gen(function* () {
                // Use INSERT OR REPLACE for upsert behavior
                yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: `INSERT INTO tick_state (id, tickid, ticktime, last_updated)
                              VALUES (?, ?, ?, ?)
                              ON CONFLICT(tickid) DO UPDATE SET
                                ticktime = excluded.ticktime,
                                last_updated = excluded.last_updated`,
                        args: [
                            tick.id,
                            tick.tickid,
                            tick.ticktime,
                            tick.lastUpdated.toISOString(),
                        ],
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'upsert.tickState', error
                    })
                })
            }),

            getCurrent: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM tick_state ORDER BY last_updated DESC LIMIT 1",
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'getCurrent.tickState', error
                    })
                })

                const row = result.rows[0]
                if (!row) return Option.none()

                const tick = yield* decodeTickState(mapRowToTickState(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.tickState', error
                    }))
                )

                return Option.some(tick)
            }),

            findById: (id) => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client.execute({
                        sql: "SELECT * FROM tick_state WHERE id = ?",
                        args: [id]
                    }),
                    catch: (error) => new DatabaseError({
                        operation: 'findById.tickState', error
                    })
                })

                const row = result.rows[0]
                if (!row) return Option.none()

                const tick = yield* decodeTickState(mapRowToTickState(row)).pipe(
                    Effect.mapError((error) => new DatabaseError({
                        operation: 'decode.tickState', error
                    }))
                )

                return Option.some(tick)
            }),
        })
    })
)
