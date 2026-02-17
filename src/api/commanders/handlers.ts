import { HttpApiBuilder } from "@effect/platform"
import { Effect, Option } from "effect"
import { Api } from "../index.js"
import { SyncCmdrsResponse, SyncCmdrsError } from "./dtos.js"
import { EventRepository, CmdrRepository } from "../../domain/repositories.js"
import { Cmdr } from "../../domain/models.js"
import { CmdrId } from "../../domain/ids.js"
import { fetchCmdrProfile } from "../../services/inara.js"
import { AppConfig } from "../../lib/config.js"
import { v4 as uuid } from "uuid"

const RATE_LIMIT_DELAY_MS = 60_000 // 60 seconds between Inara requests

export const CommandersApiLive = HttpApiBuilder.group(
  Api,
  "commanders",
  (handlers) =>
    handlers.handle("syncCmdrs", ({ urlParams }) =>
      Effect.gen(function* () {
        const eventRepo = yield* EventRepository
        const cmdrRepo = yield* CmdrRepository
        const config = yield* AppConfig

        const inaraParam = Option.getOrElse(Option.fromNullable(urlParams.inara), () => "true")
        const useInara = inaraParam.toLowerCase() === "true" || inaraParam === "1" || inaraParam === "yes"

        // Get distinct commander names from events (limit 100)
        const cmdrNames = yield* eventRepo.getDistinctCmdrNames(100)

        let added = 0
        let updated = 0
        let skipped = 0

        if (useInara) {
          // Sync with Inara API
          for (const cmdrName of cmdrNames) {
            // Check if commander already exists
            const existing = yield* cmdrRepo.findByName(cmdrName)

            // Fetch Inara profile
            const profileResult = yield* fetchCmdrProfile(
              cmdrName,
              config.inara.apiKey
            ).pipe(
              Effect.either // Convert errors to Either so we can handle them
            )

            // Handle rate limiting
            if (profileResult._tag === "Left") {
              const error = profileResult.left
              if (error._tag === "InaraRateLimitError") {
                // Rate limit reached - abort sync
                yield* Effect.logWarning(
                  `Inara API rate limit reached - sync aborted at cmdr: ${cmdrName}`
                )
                yield* Effect.sleep(RATE_LIMIT_DELAY_MS)
                break
              }

              // Other Inara error - create/skip cmdr without Inara data
              yield* Effect.logWarning(
                `No Inara data for ${cmdrName}: ${error.message}`
              )

              if (Option.isNone(existing)) {
                // Create commander with just name
                yield* cmdrRepo.create(
                  new Cmdr({
                    id: uuid() as CmdrId,
                    name: cmdrName,
                    rankCombat: Option.none(),
                    rankTrade: Option.none(),
                    rankExplore: Option.none(),
                    rankCqc: Option.none(),
                    rankEmpire: Option.none(),
                    rankFederation: Option.none(),
                    rankPower: Option.none(),
                    credits: Option.none(),
                    assets: Option.none(),
                    inaraUrl: Option.none(),
                    squadronName: Option.none(),
                    squadronRank: Option.none(),
                  })
                ).pipe(
                  Effect.catchTag("CmdrAlreadyExistsError", () =>
                    Effect.void
                  )
                )
                added++
              } else {
                skipped++
              }

              yield* Effect.sleep(RATE_LIMIT_DELAY_MS)
              continue
            }

            // Successfully fetched Inara profile
            const profile = profileResult.right

            if (Option.isNone(existing)) {
              // Create new commander with Inara data
              yield* cmdrRepo.create(
                new Cmdr({
                  id: uuid() as CmdrId,
                  name: cmdrName,
                  // Convert number ranks to strings for database
                  rankCombat: Option.map(profile.rankCombat, String),
                  rankTrade: Option.map(profile.rankTrade, String),
                  rankExplore: Option.map(profile.rankExplore, String),
                  rankCqc: Option.map(profile.rankCqc, String),
                  rankEmpire: Option.map(profile.rankEmpire, String),
                  rankFederation: Option.map(profile.rankFederation, String),
                  rankPower: profile.rankPower,
                  credits: Option.none(),
                  assets: Option.none(),
                  inaraUrl: profile.inaraUrl,
                  squadronName: profile.squadronName,
                  squadronRank: profile.squadronRank,
                })
              ).pipe(
                Effect.catchTag("CmdrAlreadyExistsError", () =>
                  Effect.void
                )
              )
              added++
            } else {
              // Update existing commander with Inara data
              const existingCmdr = existing.value
              yield* cmdrRepo.update(
                new Cmdr({
                  ...existingCmdr,
                  rankCombat: Option.map(profile.rankCombat, String),
                  rankTrade: Option.map(profile.rankTrade, String),
                  rankExplore: Option.map(profile.rankExplore, String),
                  rankCqc: Option.map(profile.rankCqc, String),
                  rankEmpire: Option.map(profile.rankEmpire, String),
                  rankFederation: Option.map(profile.rankFederation, String),
                  rankPower: profile.rankPower,
                  inaraUrl: profile.inaraUrl,
                  squadronName: profile.squadronName,
                  squadronRank: profile.squadronRank,
                })
              ).pipe(
                Effect.catchTag("CmdrNotFoundError", () => Effect.void)
              )
              updated++
            }

            // Sleep to avoid rate limits
            yield* Effect.sleep(RATE_LIMIT_DELAY_MS)
          }
        } else {
          // Add commanders from events without Inara lookup
          for (const cmdrName of cmdrNames) {
            const existing = yield* cmdrRepo.findByName(cmdrName)

            if (Option.isNone(existing)) {
              yield* cmdrRepo.create(
                new Cmdr({
                  id: uuid() as CmdrId,
                  name: cmdrName,
                  rankCombat: Option.none(),
                  rankTrade: Option.none(),
                  rankExplore: Option.none(),
                  rankCqc: Option.none(),
                  rankEmpire: Option.none(),
                  rankFederation: Option.none(),
                  rankPower: Option.none(),
                  credits: Option.none(),
                  assets: Option.none(),
                  inaraUrl: Option.none(),
                  squadronName: Option.none(),
                  squadronRank: Option.none(),
                })
              ).pipe(
                Effect.catchTag("CmdrAlreadyExistsError", () =>
                  Effect.void
                )
              )
              added++
            } else {
              skipped++
            }
          }
        }

        const message = useInara
          ? `Synced commanders with Inara: ${added} added, ${updated} updated, ${skipped} skipped`
          : `Added commanders from events: ${added} added, ${skipped} skipped`

        return new SyncCmdrsResponse({
          status: "completed",
          added,
          updated,
          skipped,
          message,
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new SyncCmdrsError({
              message: `Commander sync failed: ${error}`,
            })
          )
        )
      )
    )
)
