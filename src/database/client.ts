import { SQL } from 'bun';
import { Config, Context, Effect, Layer } from "effect";

export class PgClient extends Context.Tag("PgClient")<PgClient, SQL>() {}

export const PgClientLive = Layer.effect(
  PgClient,
  Effect.gen(function* () {
    const url = yield* Config.string("DATABASE_URL");
    const client = new SQL(url);

    return PgClient.of(client);
  }),
);
