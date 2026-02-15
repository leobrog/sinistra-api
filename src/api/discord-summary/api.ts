import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect"
import { Schema } from "effect"
import {
  TriggerTickSummaryRequest,
  SyntheticCZSummaryRequest,
  SyntheticGroundCZSummaryRequest,
  CustomDiscordMessageRequest,
  DiscordSummaryResponse,
  Top5SummaryResponse,
} from "./dtos"

export class DiscordSummaryApi extends HttpApiGroup.make("discord")
  .add(
    HttpApiEndpoint.post("sendTop5All", "/api/summary/discord/top5all")
      .addSuccess(Top5SummaryResponse)
      .annotate(OpenApi.Title, "Send Top 5 Summary to Discord")
      .annotate(
        OpenApi.Description,
        `Sends comprehensive top 5 statistics to Discord webhook.

Includes top 5 for:
- Market Events (buy/sell volume)
- Missions Completed
- Influence by Faction
- Bounty Vouchers
- Combat Bonds
- Exploration Sales
- Bounty Fines

Requires API key authentication.`
      )
  )
  .add(
    HttpApiEndpoint.post("triggerTickSummary", "/api/summary/discord/tick")
      .addSuccess(DiscordSummaryResponse)
      .setUrlParams(TriggerTickSummaryRequest)
      .annotate(OpenApi.Title, "Trigger Daily Tick Summary")
      .annotate(
        OpenApi.Description,
        `Triggers the daily tick summary to be sent to Discord.

Query parameter:
- period: Time period for summary (ct, lt, cw, lw, cm, lm, etc.) - defaults to "ct" (current tick)

Requires API key authentication.`
      )
  )
  .add(
    HttpApiEndpoint.post("sendSyntheticCZ", "/api/summary/discord/syntheticcz")
      .addSuccess(DiscordSummaryResponse)
      .setPayload(SyntheticCZSummaryRequest)
      .annotate(OpenApi.Title, "Send Synthetic Space CZ Summary")
      .annotate(
        OpenApi.Description,
        `Sends synthetic space conflict zone summary to Discord.

Body parameter:
- period: Time period (cw, lw, cm, lm, 2m, y, cd, ld, all)

Requires API key authentication.`
      )
  )
  .add(
    HttpApiEndpoint.post("sendSyntheticGroundCZ", "/api/summary/discord/syntheticgroundcz")
      .addSuccess(DiscordSummaryResponse)
      .setPayload(SyntheticGroundCZSummaryRequest)
      .annotate(OpenApi.Title, "Send Synthetic Ground CZ Summary")
      .annotate(
        OpenApi.Description,
        `Sends synthetic ground conflict zone summary to Discord.

Body parameter:
- period: Time period (cw, lw, cm, lm, 2m, y, cd, ld, ct, lt, all)

Requires API key authentication.`
      )
  )
  .add(
    HttpApiEndpoint.post("sendCustomMessage", "/api/discord/trigger/custom-message")
      .addSuccess(DiscordSummaryResponse)
      .setPayload(CustomDiscordMessageRequest)
      .annotate(OpenApi.Title, "Send Custom Discord Message")
      .annotate(
        OpenApi.Description,
        `Send a custom message to a Discord webhook.

Body parameters:
- content: Message content (required)
- webhook: Webhook choice - "BGS", "shoutout", "conflict", or "debug" (default: "BGS")
- username: Display username (default: "Sinistra Admin")

Requires API key authentication.`
      )
  )
  .annotateEndpoints(OpenApi.Security, "apiKey") {}
