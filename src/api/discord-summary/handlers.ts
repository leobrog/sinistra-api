import { Effect, Option } from "effect"
import { AppConfig } from "../../lib/config"
import { sendWebhook } from "../../services/discord"
import type {
  TriggerTickSummaryRequest,
  SyntheticCZSummaryRequest,
  SyntheticGroundCZSummaryRequest,
  CustomDiscordMessageRequest,
} from "./dtos"
import { DiscordSummaryResponse, Top5SummaryResponse } from "./dtos"

/**
 * Handle POST /api/summary/discord/top5all
 * Sends top 5 stats across all categories to Discord webhook
 */
export const handleSendTop5AllToDiscord = () =>
  Effect.gen(function* () {
    const config = yield* AppConfig

    const webhookUrl = yield* Effect.fromOption(config.discord.webhooks.shoutout)

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

    const webhookUrl = yield* Effect.fromOption(config.discord.webhooks.shoutout)

    // TODO: Implement tick summary formatting (from fac_shoutout_scheduler.py logic)
    yield* sendWebhook(webhookUrl, {
      content: `**Daily Tick Summary (Period: ${period})**\n\nTODO: Implement tick summary query aggregation`,
    })

    return new DiscordSummaryResponse({
      status: `Daily summary triggered for period: ${period}`,
    })
  })

/**
 * Handle POST /api/summary/discord/syntheticcz
 * Sends synthetic space CZ summary to Discord
 */
export const handleSendSyntheticCZSummary = (request: SyntheticCZSummaryRequest) =>
  Effect.gen(function* () {
    const config = yield* AppConfig
    const { period } = request

    const webhookUrl = yield* Effect.fromOption(config.discord.webhooks.conflict)

    // TODO: Implement synthetic CZ query logic (from send_syntheticcz_summary_to_discord)
    yield* sendWebhook(webhookUrl, {
      content: `**Synthetic Space CZ Summary (Period: ${period || "default"})**\n\nTODO: Implement synthetic CZ query`,
    })

    return new DiscordSummaryResponse({
      status: `SyntheticCZ summary sent for tenant: ${config.faction.name} (${period || "default"})`,
    })
  })

/**
 * Handle POST /api/summary/discord/syntheticgroundcz
 * Sends synthetic ground CZ summary to Discord
 */
export const handleSendSyntheticGroundCZSummary = (request: SyntheticGroundCZSummaryRequest) =>
  Effect.gen(function* () {
    const config = yield* AppConfig
    const { period } = request

    const webhookUrl = yield* Effect.fromOption(config.discord.webhooks.conflict)

    // TODO: Implement synthetic ground CZ query logic (from send_syntheticgroundcz_summary_to_discord)
    yield* sendWebhook(webhookUrl, {
      content: `**Synthetic Ground CZ Summary (Period: ${period || "default"})**\n\nTODO: Implement synthetic ground CZ query`,
    })

    return new DiscordSummaryResponse({
      status: `SyntheticGroundCZ summary sent for tenant: ${config.faction.name} (${period || "default"})`,
    })
  })

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
      case "bgs":
        webhookUrl = yield* Effect.fromOption(config.discord.webhooks.bgs)
        break
      case "shoutout":
        webhookUrl = yield* Effect.fromOption(config.discord.webhooks.shoutout)
        break
      case "conflict":
        webhookUrl = yield* Effect.fromOption(config.discord.webhooks.conflict)
        break
      case "debug":
        webhookUrl = yield* Effect.fromOption(config.discord.webhooks.debug)
        break
      default:
        return yield* Effect.fail(
          new Error(`Invalid webhook choice: ${webhook}. Must be one of: BGS, shoutout, conflict, debug`)
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
  })
