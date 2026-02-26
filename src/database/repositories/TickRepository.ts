import { Effect, Layer, Option, Schema } from "effect";
import { PgClient } from "../client.ts";
import { TickRepository } from "../../domain/repositories.ts";
import { TickState } from "../../domain/models.ts";
import { DatabaseError } from "../../domain/errors.ts";
import { mapRowToTickState } from "../../lib/utils.ts";

export const TickRepositoryLive = Layer.effect(
    TickRepository,
    Effect.gen(function* () {
        const client = yield* PgClient
        const decodeTickState = Schema.decodeUnknown(TickState)

        return TickRepository.of({
            upsert: (tick) => Effect.gen(function* () {
                // Use INSERT OR REPLACE for upsert behavior
                yield* Effect.tryPromise({
                    try: () => client`INSERT INTO tick_state (id, tickid, ticktime, last_updated)
                              VALUES (${tick.id}, ${tick.tickid}, ${tick.ticktime}, ${tick.lastUpdated.toISOString()})
                              ON CONFLICT(tickid) DO UPDATE SET
                                ticktime = excluded.ticktime,
                                last_updated = excluded.last_updated`,
                    catch: (error) => new DatabaseError({
                        operation: 'upsert.tickState', error
                    })
                })
            }),

            getCurrent: () => Effect.gen(function* () {
                const result = yield* Effect.tryPromise({
                    try: () => client`SELECT * FROM tick_state ORDER BY last_updated DESC LIMIT 1`,
                    catch: (error) => new DatabaseError({
                        operation: 'getCurrent.tickState', error
                    })
                })

                const row = (result as any)[0]
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
                    try: () => client`SELECT * FROM tick_state WHERE id = ${id}`,
                    catch: (error) => new DatabaseError({
                        operation: 'findById.tickState', error
                    })
                })

                const row = (result as any)[0]
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
