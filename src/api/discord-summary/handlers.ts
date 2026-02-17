import { Effect, Option } from "effect"
import { AppConfig } from "../../lib/config.js"
import { DiscordApiError } from "../../domain/errors.js"
import { sendWebhook } from "../../services/discord.js"
import type {
  TriggerTickSummaryRequest,
  SyntheticCZSummaryRequest,
  SyntheticGroundCZSummaryRequest,
  CustomDiscordMessageRequest,
} from "./dtos.js"
import { DiscordSummaryResponse, Top5SummaryResponse } from "./dtos.js"

/**
 * Handle POST /api/summary/discord/top5all
 * Sends top 5 stats across all categories to Discord webhook
 */
export const handleSendTop5AllToDiscord = () =>
  Effect.gen(function* () {
    const config = yield* AppConfig

    const webhookUrlOption = config.discord.webhooks.shoutout
    if (Option.isNone(webhookUrlOption)) {
      return yield* Effect.fail(
        new DiscordApiError({
          message: "Shoutout webhook URL not configured",
          statusCode: Option.none(),
          response: Option.none()
        })
      )
    }
    const webhookUrl = webhookUrlOption.value

    // TODO: Implement top5 queries (Market Events, Missions, Combat Bonds, etc.)
    // For now, send a test message
    yield* sendWebhook(webhookUrl, {
      content: "**Top 5 Summary**\n\nTODO: Implement top 5 query aggregation",
    })

    return new Top5SummaryResponse({
      status: "sent",
      results: [
        {
          tenant: config.faction.name,
          status: "sent",
        },
      ],
    })
  }).pipe(
    Effect.catchAll((error) =>
      Effect.succeed(
        new Top5SummaryResponse({
          status: "error",
          results: [
            {
              tenant: "unknown",
              status: "error",
              reason: String(error),
            },
          ],
        })
      )
    )
  )

/**
 * Handle POST /api/summary/discord/tick
 * Triggers daily tick summary to Discord
 */
export const handleTriggerDailyTickSummary = (request: TriggerTickSummaryRequest) =>
  Effect.gen(function* () {
    const config = yield* AppConfig
    const { period } = request

    const webhookUrlOption = config.discord.webhooks.shoutout
    if (Option.isNone(webhookUrlOption)) {
      return yield* Effect.fail(
        new DiscordApiError({
          message: "Shoutout webhook URL not configured",
          statusCode: Option.none(),
          response: Option.none()
        })
      )
    }
    const webhookUrl = webhookUrlOption.value

    // TODO: Implement tick summary formatting (from fac_shoutout_scheduler.py logic)
    yield* sendWebhook(webhookUrl, {
      content: `**Daily Tick Summary (Period: ${period})**\n\nTODO: Implement tick summary query aggregation`,
    })

    return new DiscordSummaryResponse({
      status: `Daily summary triggered for period: ${period}`,
    })
  }).pipe(
    Effect.catchTag("DiscordWebhookError", (error) =>
      Effect.fail(
        new DiscordApiError({
          message: error.message,
          statusCode: Option.none(),
          response: Option.none()
        })
      )
    )
  )

/**
 * Handle POST /api/summary/discord/syntheticcz
 * Sends synthetic space CZ summary to Discord
 */
export const handleSendSyntheticCZSummary = (request: SyntheticCZSummaryRequest) =>
  Effect.gen(function* () {
    const config = yield* AppConfig
    const { period } = request

    const webhookUrlOption = config.discord.webhooks.conflict
    if (Option.isNone(webhookUrlOption)) {
      return yield* Effect.fail(
        new DiscordApiError({
          message: "Conflict webhook URL not configured",
          statusCode: Option.none(),
          response: Option.none()
        })
      )
    }
    const webhookUrl = webhookUrlOption.value

    // TODO: Implement synthetic CZ query logic (from send_syntheticcz_summary_to_discord)
    yield* sendWebhook(webhookUrl, {
      content: `**Synthetic Space CZ Summary (Period: ${period || "default"})**\n\nTODO: Implement synthetic CZ query`,
    })

    return new DiscordSummaryResponse({
      status: `SyntheticCZ summary sent for tenant: ${config.faction.name} (${period || "default"})`,
    })
  }).pipe(
    Effect.catchTag("DiscordWebhookError", (error) =>
      Effect.fail(
        new DiscordApiError({
          message: error.message,
          statusCode: Option.none(),
          response: Option.none()
        })
      )
    )
  )

/**
 * Handle POST /api/summary/discord/syntheticgroundcz
 * Sends synthetic ground CZ summary to Discord
 */
export const handleSendSyntheticGroundCZSummary = (request: SyntheticGroundCZSummaryRequest) =>
  Effect.gen(function* () {
    const config = yield* AppConfig
    const { period } = request

    const webhookUrlOption = config.discord.webhooks.conflict
    if (Option.isNone(webhookUrlOption)) {
      return yield* Effect.fail(
        new DiscordApiError({
          message: "Conflict webhook URL not configured",
          statusCode: Option.none(),
          response: Option.none()
        })
      )
    }
    const webhookUrl = webhookUrlOption.value

    // TODO: Implement synthetic ground CZ query logic (from send_syntheticgroundcz_summary_to_discord)
    yield* sendWebhook(webhookUrl, {
      content: `**Synthetic Ground CZ Summary (Period: ${period || "default"})**\n\nTODO: Implement synthetic ground CZ query`,
    })

    return new DiscordSummaryResponse({
      status: `SyntheticGroundCZ summary sent for tenant: ${config.faction.name} (${period || "default"})`,
    })
  }).pipe(
    Effect.catchTag("DiscordWebhookError", (error) =>
      Effect.fail(
        new DiscordApiError({
          message: error.message,
          statusCode: Option.none(),
          response: Option.none()
        })
      )
    )
  )

/**
 * Handle POST /api/discord/trigger/custom-message
 * Sends a custom message to Discord webhook
 */
export const handleSendCustomDiscordMessage = (request: CustomDiscordMessageRequest) =>
  Effect.gen(function* () {
    const config = yield* AppConfig
    const { content, webhook, username } = request

    // Determine webhook URL based on choice
    let webhookUrl: string
    switch (webhook.toLowerCase()) {
      case "bgs": {
        const webhookUrlOption = config.discord.webhooks.bgs
        if (Option.isNone(webhookUrlOption)) {
          return yield* Effect.fail(
            new DiscordApiError({
          message: "BGS webhook URL not configured",
          statusCode: Option.none(),
          response: Option.none()
        })
          )
        }
        webhookUrl = webhookUrlOption.value
        break
      }
      case "shoutout": {
        const webhookUrlOption = config.discord.webhooks.shoutout
        if (Option.isNone(webhookUrlOption)) {
          return yield* Effect.fail(
            new DiscordApiError({
          message: "Shoutout webhook URL not configured",
          statusCode: Option.none(),
          response: Option.none()
        })
          )
        }
        webhookUrl = webhookUrlOption.value
        break
      }
      case "conflict": {
        const webhookUrlOption = config.discord.webhooks.conflict
        if (Option.isNone(webhookUrlOption)) {
          return yield* Effect.fail(
            new DiscordApiError({
          message: "Conflict webhook URL not configured",
          statusCode: Option.none(),
          response: Option.none()
        })
          )
        }
        webhookUrl = webhookUrlOption.value
        break
      }
      case "debug": {
        const webhookUrlOption = config.discord.webhooks.debug
        if (Option.isNone(webhookUrlOption)) {
          return yield* Effect.fail(
            new DiscordApiError({
          message: "Debug webhook URL not configured",
          statusCode: Option.none(),
          response: Option.none()
        })
          )
        }
        webhookUrl = webhookUrlOption.value
        break
      }
      default:
        return yield* Effect.fail(
          new DiscordApiError({
            message: `Invalid webhook choice: ${webhook}. Must be one of: BGS, shoutout, conflict, debug`,
            statusCode: Option.none(),
            response: Option.none()
          })
        )
    }

    // Send to Discord
    yield* sendWebhook(webhookUrl, {
      content: `**${username}:** ${content}`,
      username: "Sinistra Dashboard",
    })

    return new DiscordSummaryResponse({
      status: `Custom message sent to ${webhook} channel`,
    })
  }).pipe(
    Effect.catchTag("DiscordWebhookError", (error) =>
      Effect.fail(
        new DiscordApiError({
          message: error.message,
          statusCode: Option.none(),
          response: Option.none()
        })
      )
    )
  )

// Import HttpApiBuilder for creating handler wrappers
import { HttpApiBuilder } from "@effect/platform"
import { Api } from "../index.js"

// Handler wrappers
export const sendTop5AllHandler = HttpApiBuilder.handler(
  Api,
  "discord",
  "sendTop5All",
  () => handleSendTop5AllToDiscord()
)

export const triggerTickSummaryHandler = HttpApiBuilder.handler(
  Api,
  "discord",
  "triggerTickSummary",
  ({ urlParams }) => handleTriggerDailyTickSummary(urlParams)
)

export const sendSyntheticCZHandler = HttpApiBuilder.handler(
  Api,
  "discord",
  "sendSyntheticCZ",
  ({ payload }) => handleSendSyntheticCZSummary(payload)
)

export const sendSyntheticGroundCZHandler = HttpApiBuilder.handler(
  Api,
  "discord",
  "sendSyntheticGroundCZ",
  ({ payload }) => handleSendSyntheticGroundCZSummary(payload)
)

export const sendCustomMessageHandler = HttpApiBuilder.handler(
  Api,
  "discord",
  "sendCustomMessage",
  ({ payload }) => handleSendCustomDiscordMessage(payload)
)

export const DiscordSummaryApiLive = HttpApiBuilder.group(Api, "discord", (handlers) =>
  handlers
    .handle("sendTop5All", sendTop5AllHandler)
    .handle("triggerTickSummary", triggerTickSummaryHandler)
    .handle("sendSyntheticCZ", sendSyntheticCZHandler)
    .handle("sendSyntheticGroundCZ", sendSyntheticGroundCZHandler)
    .handle("sendCustomMessage", sendCustomMessageHandler)
)
