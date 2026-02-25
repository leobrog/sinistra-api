import { Effect, Option } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"
import { FlaskUserRepository, CmdrRepository } from "../../domain/repositories.js"
import { TursoClient } from "../../database/client.js"
import { DatabaseError } from "../../domain/errors.js"
import { CmdrNotFoundByDiscordError } from "./api.js"

export const CmdrLocationApiLive = HttpApiBuilder.group(Api, "cmdrLocation", (handlers) =>
  handlers.handle("getCmdrSystem", ({ urlParams }) =>
    Effect.gen(function* () {
      const flaskUserRepo = yield* FlaskUserRepository
      const cmdrRepo = yield* CmdrRepository
      const client = yield* TursoClient

      const userOption = yield* flaskUserRepo.findByDiscordId(urlParams.discord_id)

      if (Option.isNone(userOption)) {
        return yield* Effect.fail(
          new CmdrNotFoundByDiscordError({ message: `No user found for discord_id: ${urlParams.discord_id}` })
        )
      }

      const user = userOption.value

      if (Option.isNone(user.cmdrId)) {
        return yield* Effect.fail(
          new CmdrNotFoundByDiscordError({ message: "No cmdr linked to this user" })
        )
      }

      const cmdrOption = yield* cmdrRepo.findById(Option.getOrThrow(user.cmdrId))

      if (Option.isNone(cmdrOption)) {
        return yield* Effect.fail(
          new CmdrNotFoundByDiscordError({ message: "Cmdr not found" })
        )
      }

      const cmdrName = cmdrOption.value.name

      const result = yield* Effect.tryPromise({
        try: () =>
          client.execute({
            sql: "SELECT starsystem, timestamp FROM event WHERE cmdr = ? AND starsystem IS NOT NULL ORDER BY timestamp DESC LIMIT 1",
            args: [cmdrName],
          }),
        catch: (error) => new DatabaseError({ operation: "getCmdrSystem.query", error }),
      })

      const row = result.rows[0]

      return {
        cmdr_name: cmdrName,
        current_system: row ? (row["starsystem"] as string | null) : null,
        timestamp: row ? (row["timestamp"] as string | null) : null,
      }
    })
  )
)
