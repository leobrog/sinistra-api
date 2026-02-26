import { Effect, Option } from "effect"
import { HttpApiBuilder } from "@effect/platform"
import { v4 as uuid } from "uuid"
import { Api } from "../index.js"
import { EventRepository } from "../../domain/repositories.js"
import { TursoClient } from "../../database/client.js"
import { AppConfig } from "../../lib/config.js"
import { runConflictDiff, parseConflictsFromEntries } from "../../schedulers/conflict-scheduler.js"
import type { EventData } from "./dtos.js"
import {
  Event,
  MarketBuyEvent,
  MarketSellEvent,
  MissionCompletedEvent,
  MissionCompletedInfluence,
  FactionKillBondEvent,
  MissionFailedEvent,
  MultiSellExplorationDataEvent,
  RedeemVoucherEvent,
  SellExplorationDataEvent,
  CommitCrimeEvent,
  SyntheticCZ,
  SyntheticGroundCZ,
} from "../../domain/models.js"
import type {
  EventId,
  MarketBuyEventId,
  MarketSellEventId,
  MissionCompletedEventId,
  MissionCompletedInfluenceId,
  FactionKillBondEventId,
  MissionFailedEventId,
  MultiSellExplorationDataEventId,
  RedeemVoucherEventId,
  SellExplorationDataEventId,
  CommitCrimeEventId,
  SyntheticCZId,
  SyntheticGroundCZId,
} from "../../domain/ids.js"

/**
 * Extract CZ type from event data (for Synthetic CZ events)
 */
const extractCzType = (data: EventData): Option.Option<string> => {
  if (data.low === 1) return Option.some("low")
  if (data.medium === 1) return Option.some("medium")
  if (data.high === 1) return Option.some("high")
  return Option.none()
}

/**
 * Convert EventData DTO to domain Event entity
 */
const eventDataToEvent = (data: EventData): Event => {
  const eventId = uuid() as EventId

  return new Event({
    id: eventId,
    event: data.event,
    timestamp: data.timestamp,
    tickid: data.tickid || "",
    ticktime: data.ticktime || "",
    cmdr: Option.fromNullable(data.Cmdr),
    starsystem: Option.fromNullable(data.StarSystem),
    systemaddress: Option.fromNullable(data.SystemAddress),
    rawJson: Option.some(JSON.stringify(data)),
  })
}

/**
 * Create sub-events based on event type
 */
const createSubEvents = (
  eventId: EventId,
  data: EventData
): {
  marketBuy?: MarketBuyEvent[]
  marketSell?: MarketSellEvent[]
  missionCompleted?: { event: MissionCompletedEvent; influences: MissionCompletedInfluence[] }[]
  factionKillBond?: FactionKillBondEvent[]
  missionFailed?: MissionFailedEvent[]
  multiSellExplorationData?: MultiSellExplorationDataEvent[]
  redeemVoucher?: RedeemVoucherEvent[]
  sellExplorationData?: SellExplorationDataEvent[]
  commitCrime?: CommitCrimeEvent[]
  syntheticCZ?: SyntheticCZ[]
  syntheticGroundCZ?: SyntheticGroundCZ[]
} => {
  switch (data.event) {
    case "MarketBuy":
      return {
        marketBuy: [
          new MarketBuyEvent({
            id: uuid() as MarketBuyEventId,
            eventId,
            stock: Option.fromNullable(data.Stock),
            stockBracket: Option.fromNullable(data.StockBracket),
            value: Option.fromNullable(data.TotalCost),
            count: Option.fromNullable(data.Count),
          }),
        ],
      }

    case "MarketSell":
      return {
        marketSell: [
          new MarketSellEvent({
            id: uuid() as MarketSellEventId,
            eventId,
            demand: Option.fromNullable(data.Demand),
            demandBracket: Option.fromNullable(data.DemandBracket),
            profit: Option.fromNullable(data.Profit),
            value: Option.fromNullable(data.TotalSale),
            count: Option.fromNullable(data.Count),
          }),
        ],
      }

    case "MissionCompleted": {
      const missionEvent = new MissionCompletedEvent({
        id: uuid() as MissionCompletedEventId,
        eventId,
        awardingFaction: Option.fromNullable(data.Faction),
        missionName: Option.fromNullable(data.Name),
        reward: Option.fromNullable(data.Reward),
      })

      // Process FactionEffects -> MissionCompletedInfluence entries
      const influences: MissionCompletedInfluence[] = []
      const factionEffects = data.FactionEffects || []

      for (const effect of factionEffects) {
        const effectObj = effect as any
        const factionName = effectObj.Faction
        const reputation = effectObj.Reputation
        const reputationTrend = effectObj.ReputationTrend
        const effectEntries = effectObj.Effects || []
        const influenceEntries = effectObj.Influence || []

        for (const infl of influenceEntries) {
          influences.push(
            new MissionCompletedInfluence({
              id: uuid() as MissionCompletedInfluenceId,
              missionId: missionEvent.id,
              systemAddress: Option.fromNullable(infl.SystemAddress),
              influence: Option.fromNullable(infl.Influence),
              trend: Option.fromNullable(infl.Trend),
              factionName: Option.fromNullable(factionName),
              reputation: Option.fromNullable(reputation),
              reputationTrend: Option.fromNullable(reputationTrend),
              effect: effectEntries.length > 0 ? Option.some(effectEntries[0].Effect) : Option.none(),
              effectTrend: effectEntries.length > 0 ? Option.some(effectEntries[0].Trend) : Option.none(),
            })
          )
        }
      }

      return {
        missionCompleted: [{ event: missionEvent, influences }],
      }
    }

    case "FactionKillBond":
      return {
        factionKillBond: [
          new FactionKillBondEvent({
            id: uuid() as FactionKillBondEventId,
            eventId,
            killerShip: Option.fromNullable(data.KillerShip),
            awardingFaction: Option.fromNullable(data.AwardingFaction),
            victimFaction: Option.fromNullable(data.VictimFaction),
            reward: Option.fromNullable(data.Reward),
          }),
        ],
      }

    case "MissionFailed":
      return {
        missionFailed: [
          new MissionFailedEvent({
            id: uuid() as MissionFailedEventId,
            eventId,
            missionName: Option.fromNullable(data.Name),
            awardingFaction: Option.fromNullable(data.AwardingFaction),
            fine: Option.fromNullable(data.Fine),
          }),
        ],
      }

    case "MultiSellExplorationData":
      return {
        multiSellExplorationData: [
          new MultiSellExplorationDataEvent({
            id: uuid() as MultiSellExplorationDataEventId,
            eventId,
            totalEarnings: Option.fromNullable(data.TotalEarnings),
          }),
        ],
      }

    case "RedeemVoucher": {
      // RedeemVoucher can have multiple factions - create one record per faction
      const vouchers: RedeemVoucherEvent[] = []
      const factions = data.Factions || []

      if (factions.length > 0) {
        for (const fac of factions) {
          const facObj = fac as any
          vouchers.push(
            new RedeemVoucherEvent({
              id: uuid() as RedeemVoucherEventId,
              eventId,
              amount: Option.fromNullable(facObj.Amount),
              faction: Option.fromNullable(facObj.Faction),
              type: Option.fromNullable(data.Type),
            })
          )
        }
      } else {
        // Fallback for events without Factions array
        vouchers.push(
          new RedeemVoucherEvent({
            id: uuid() as RedeemVoucherEventId,
            eventId,
            amount: Option.fromNullable(data.Amount),
            faction: Option.fromNullable(data.Faction),
            type: Option.fromNullable(data.Type),
          })
        )
      }

      return { redeemVoucher: vouchers }
    }

    case "SellExplorationData":
      return {
        sellExplorationData: [
          new SellExplorationDataEvent({
            id: uuid() as SellExplorationDataEventId,
            eventId,
            earnings: Option.fromNullable(data.TotalEarnings),
          }),
        ],
      }

    case "CommitCrime":
      return {
        commitCrime: [
          new CommitCrimeEvent({
            id: uuid() as CommitCrimeEventId,
            eventId,
            crimeType: Option.fromNullable(data.CrimeType),
            faction: Option.fromNullable(data.Faction),
            victim: Option.fromNullable(data.Victim),
            victimFaction: Option.fromNullable(data.VictimFaction),
            bounty: Option.fromNullable(data.Bounty),
          }),
        ],
      }

    case "SyntheticCZ": {
      const czType = extractCzType(data)
      const faction = data.faction || data.Faction

      return {
        syntheticCZ: [
          new SyntheticCZ({
            id: uuid() as SyntheticCZId,
            eventId,
            czType,
            faction: Option.fromNullable(faction),
            cmdr: Option.fromNullable(data.cmdr),
            stationFactionName: Option.fromNullable(data.station_faction_name),
          }),
        ],
      }
    }

    case "SyntheticGroundCZ": {
      const czType = extractCzType(data)
      const faction = data.faction || data.Faction

      return {
        syntheticGroundCZ: [
          new SyntheticGroundCZ({
            id: uuid() as SyntheticGroundCZId,
            eventId,
            czType,
            settlement: Option.fromNullable(data.settlement),
            faction: Option.fromNullable(faction),
            cmdr: Option.fromNullable(data.cmdr),
            stationFactionName: Option.fromNullable(data.station_faction_name),
          }),
        ],
      }
    }

    default:
      // Event type not recognized - no sub-events
      return {}
  }
}

/**
 * Events API handlers
 */
export const EventsApiLive = HttpApiBuilder.group(Api, "events", (handlers) =>
  handlers.handle("postEvents", (request) =>
    Effect.gen(function* () {
      const eventRepo = yield* EventRepository

      // Process each event
      for (const eventData of request.payload) {
        const event = eventDataToEvent(eventData)
        const subEvents = createSubEvents(event.id, eventData)

        yield* eventRepo.createEvent(event, subEvents)
      }

      // Immediate conflict detection: FSDJump/Location events with Conflicts data
      const conflictEvents = request.payload.filter(
        (e) => ["FSDJump", "Location"].includes(e.event) && (e.Conflicts as any[])?.length > 0
      )

      if (conflictEvents.length > 0) {
        const client = yield* TursoClient
        const config = yield* AppConfig
        const webhookUrl = Option.getOrNull(config.discord.webhooks.conflict)

        yield* Effect.forkDaemon(
          Effect.gen(function* () {
            const factionNames = yield* Effect.tryPromise({
              try: async () => {
                const result = await client.execute("SELECT name FROM protected_faction")
                return new Set(result.rows.map((r) => String(r.name)))
              },
              catch: (e) => new Error(`${e}`),
            })
            const conflictMap = parseConflictsFromEntries(conflictEvents, factionNames)
            if (conflictMap.size > 0) {
              yield* runConflictDiff(
                client,
                webhookUrl,
                conflictMap,
                factionNames,
                new Date().toISOString(),
                "Event conflict check"
              )
            }
          }).pipe(Effect.catchAll((e) => Effect.logWarning(`Event conflict check: ${e}`)))
        )
      }

      return {
        status: "success" as const,
        eventsProcessed: request.payload.length,
      }
    })
  )
)
