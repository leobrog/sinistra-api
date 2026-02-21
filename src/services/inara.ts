/**
 * Inara service - Port of Flask's cmdr_sync_inara.py
 *
 * Provides integration with the Inara Elite Dangerous API.
 * https://inara.cz/inapi/
 */

import { Effect, Schema, Option } from "effect"

/**
 * Inara API base URL
 */
const INARA_API_BASE = "https://inara.cz/inapi/v1/"

/**
 * Inara API errors
 */
export class InaraApiError extends Schema.TaggedError<InaraApiError>()("InaraApiError", {
  message: Schema.String,
  status: Schema.optional(Schema.Number),
  statusText: Schema.optional(Schema.String),
}) {}

export class InaraRateLimitError extends Schema.TaggedError<InaraRateLimitError>()(
  "InaraRateLimitError",
  {
    message: Schema.String,
    statusText: Schema.String,
  }
) {}

/**
 * Commander rank data
 */
export const CmdrRank = Schema.Struct({
  rankName: Schema.String,
  rankValue: Schema.Number,
})

/**
 * Squadron info
 */
export const Squadron = Schema.Struct({
  squadronName: Schema.optional(Schema.String),
  squadronMemberRank: Schema.optional(Schema.String),
})

/**
 * Inara commander profile
 */
export interface InaraCommanderProfile {
  readonly rankCombat: Option.Option<number>
  readonly rankTrade: Option.Option<number>
  readonly rankExplore: Option.Option<number>
  readonly rankCqc: Option.Option<number>
  readonly rankEmpire: Option.Option<number>
  readonly rankFederation: Option.Option<number>
  readonly rankPower: Option.Option<string>
  readonly inaraUrl: Option.Option<string>
  readonly squadronName: Option.Option<string>
  readonly squadronRank: Option.Option<string>
}

/**
 * Inara API request payload (unused - kept for reference)
 */
// const InaraRequest = Schema.Struct({
//   header: Schema.Struct({
//     appName: Schema.String,
//     appVersion: Schema.String,
//     isDeveloped: Schema.Boolean,
//     APIkey: Schema.String,
//   }),
//   events: Schema.Array(
//     Schema.Struct({
//       eventName: Schema.String,
//       eventTimestamp: Schema.String,
//       eventData: Schema.Struct({
//         searchName: Schema.String,
//       }),
//     })
//   ),
// })

/**
 * Inara API response
 */
const InaraResponse = Schema.Struct({
  header: Schema.Struct({
    eventStatus: Schema.Number,
    eventStatusText: Schema.optional(Schema.String),
  }),
  events: Schema.Array(
    Schema.Struct({
      eventStatus: Schema.Number,
      eventData: Schema.optional(
        Schema.Struct({
          commanderRanksPilot: Schema.optional(Schema.Array(CmdrRank)),
          commanderSquadron: Schema.optional(Squadron),
          preferredPowerName: Schema.optional(Schema.String),
          inaraURL: Schema.optional(Schema.String),
        })
      ),
    })
  ),
})

/**
 * Fetch commander profile from Inara API
 *
 * @param cmdrName - Commander name to search for
 * @param inaraApiKey - Inara API key
 * @returns Effect containing commander profile or rate limit/API error
 */
export const fetchCmdrProfile = (
  cmdrName: string,
  inaraApiKey: string
): Effect.Effect<InaraCommanderProfile, InaraApiError | InaraRateLimitError> =>
  Effect.gen(function* () {
    // Build request payload
    const payload = {
      header: {
        appName: "Sinistra",
        appVersion: "2.0",
        isDeveloped: false,
        APIkey: inaraApiKey,
      },
      events: [
        {
          eventName: "getCommanderProfile",
          eventTimestamp: new Date().toISOString(),
          eventData: {
            searchName: cmdrName,
          },
        },
      ],
    }

    // Make API request
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(INARA_API_BASE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }),
      catch: (error) =>
        new InaraApiError({
          message: `Failed to fetch Inara profile: ${error}`,
        }),
    })

    // Check HTTP status
    if (!response.ok) {
      const text = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (_error) =>
          new InaraApiError({
            message: "Failed to read error response",
          }),
      }).pipe(Effect.catchAll(() => Effect.succeed("Unknown error")))

      return yield* Effect.fail(
        new InaraApiError({
          message: `Inara API HTTP error for Cmdr '${cmdrName}'`,
          status: response.status,
          statusText: text,
        })
      )
    }

    // Parse response
    const jsonData = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (error) =>
        new InaraApiError({
          message: `Failed to parse Inara response: ${error}`,
        }),
    })

    const inaraResponse = yield* Schema.decodeUnknown(InaraResponse)(jsonData).pipe(
      Effect.mapError((error) =>
        new InaraApiError({
          message: `Failed to decode Inara response: ${error}`,
        })
      )
    )

    // Check API-level status
    const status = inaraResponse.header.eventStatus
    const statusText = inaraResponse.header.eventStatusText ?? ""

    // Handle rate limiting (status 400)
    if (status === 400) {
      return yield* Effect.fail(
        new InaraRateLimitError({
          message: "Inara API rate limit reached",
          statusText,
        })
      )
    }

    // Check event status and data
    const event = inaraResponse.events[0]
    if (!event || !event.eventData) {
      return yield* Effect.fail(
        new InaraApiError({
          message: `No data received from Inara for Cmdr '${cmdrName}'`,
          status,
          statusText,
        })
      )
    }

    const data = event.eventData

    // Extract ranks
    const ranks = (data.commanderRanksPilot ?? []).reduce(
      (acc, rank) => {
        acc[rank.rankName] = rank.rankValue
        return acc
      },
      {} as Record<string, number>
    )

    // Extract squadron info
    const squadron = data.commanderSquadron ?? {}

    // Build profile with Option types for nullable fields
    const profile: InaraCommanderProfile = {
      rankCombat: Option.fromNullable(ranks["combat"]),
      rankTrade: Option.fromNullable(ranks["trade"]),
      rankExplore: Option.fromNullable(ranks["exploration"]),
      rankCqc: Option.fromNullable(ranks["cqc"]),
      rankEmpire: Option.fromNullable(ranks["empire"]),
      rankFederation: Option.fromNullable(ranks["federation"]),
      rankPower: Option.fromNullable(data.preferredPowerName),
      inaraUrl: Option.fromNullable(data.inaraURL),
      squadronName: Option.fromNullable(squadron.squadronName),
      squadronRank: Option.fromNullable(squadron.squadronMemberRank),
    }

    return profile
  })

/**
 * Helper to convert InaraCommanderProfile to database-compatible object
 * Converts Option types to nullable values
 */
export const profileToDbValues = (
  profile: InaraCommanderProfile
): {
  rankCombat: number | null
  rankTrade: number | null
  rankExplore: number | null
  rankCqc: number | null
  rankEmpire: number | null
  rankFederation: number | null
  rankPower: string | null
  inaraUrl: string | null
  squadronName: string | null
  squadronRank: string | null
} => ({
  rankCombat: Option.getOrNull(profile.rankCombat),
  rankTrade: Option.getOrNull(profile.rankTrade),
  rankExplore: Option.getOrNull(profile.rankExplore),
  rankCqc: Option.getOrNull(profile.rankCqc),
  rankEmpire: Option.getOrNull(profile.rankEmpire),
  rankFederation: Option.getOrNull(profile.rankFederation),
  rankPower: Option.getOrNull(profile.rankPower),
  inaraUrl: Option.getOrNull(profile.inaraUrl),
  squadronName: Option.getOrNull(profile.squadronName),
  squadronRank: Option.getOrNull(profile.squadronRank),
})
