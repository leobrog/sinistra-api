import { Schema } from "effect"
import {
  ActivityId,
  ApiKey,
  ApiKeyId,
  CmdrId,
  ColonyId,
  CommitCrimeEventId,
  EddnConflictId,
  EddnFactionId,
  EddnMessageId,
  EddnPowerplayId,
  EddnSystemInfoId,
  Email,
  EventId,
  FactionId,
  FactionKillBondEventId,
  HashedPassword,
  MarketBuyEventId,
  MarketSellEventId,
  MissionCompletedEventId,
  MissionCompletedInfluenceId,
  MissionFailedEventId,
  MultiSellExplorationDataEventId,
  ObjectiveId,
  ObjectiveTargetId,
  ObjectiveTargetSettlementId,
  ProtectedFactionId,
  RedeemVoucherEventId,
  SellExplorationDataEventId,
  SyntheticCZId,
  SyntheticGroundCZId,
  SystemId,
  TickId,
  UserId,
} from "./ids.ts"

// Plan tiers
export const PlanTier = Schema.Literal("free", "pro", "enterprise")
export type PlanTier = typeof PlanTier.Type

// API Key
export class UserApiKey extends Schema.Class<UserApiKey>("UserApiKey")({
  id: ApiKeyId,
  userId: UserId,
  key: ApiKey,
  name: Schema.String,
  lastUsedAt: Schema.optionalWith(Schema.Date, { as: "Option" }),
  expiresAt: Schema.optionalWith(Schema.Date, { as: "Option" }),
  createdAt: Schema.Date,
}) {}

// User
export class User extends Schema.Class<User>("User")({
  id: UserId,
  email: Email,
  name: Schema.String,
  password: HashedPassword,
  company: Schema.optionalWith(Schema.String, { as: "Option" }),
  planTier: PlanTier,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}) {}

// ============================================================================
// Sinistra Domain Models
// ============================================================================

// Events
export class Event extends Schema.Class<Event>("Event")({
  id: EventId,
  event: Schema.String,
  timestamp: Schema.String, // ISO 8601
  tickid: Schema.String,
  ticktime: Schema.String,
  cmdr: Schema.optionalWith(Schema.String, { as: "Option" }),
  starsystem: Schema.optionalWith(Schema.String, { as: "Option" }),
  systemaddress: Schema.optionalWith(Schema.BigInt, { as: "Option" }),
  rawJson: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

export class MarketBuyEvent extends Schema.Class<MarketBuyEvent>("MarketBuyEvent")({
  id: MarketBuyEventId,
  eventId: EventId,
  stock: Schema.optionalWith(Schema.Int, { as: "Option" }),
  stockBracket: Schema.optionalWith(Schema.Int, { as: "Option" }),
  value: Schema.optionalWith(Schema.Int, { as: "Option" }),
  count: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class MarketSellEvent extends Schema.Class<MarketSellEvent>("MarketSellEvent")({
  id: MarketSellEventId,
  eventId: EventId,
  demand: Schema.optionalWith(Schema.Int, { as: "Option" }),
  demandBracket: Schema.optionalWith(Schema.Int, { as: "Option" }),
  profit: Schema.optionalWith(Schema.Int, { as: "Option" }),
  value: Schema.optionalWith(Schema.Int, { as: "Option" }),
  count: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class MissionCompletedEvent extends Schema.Class<MissionCompletedEvent>("MissionCompletedEvent")({
  id: MissionCompletedEventId,
  eventId: EventId,
  awardingFaction: Schema.optionalWith(Schema.String, { as: "Option" }),
  missionName: Schema.optionalWith(Schema.String, { as: "Option" }),
  reward: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class MissionCompletedInfluence extends Schema.Class<MissionCompletedInfluence>("MissionCompletedInfluence")({
  id: MissionCompletedInfluenceId,
  missionId: MissionCompletedEventId,
  system: Schema.optionalWith(Schema.String, { as: "Option" }),
  influence: Schema.optionalWith(Schema.String, { as: "Option" }),
  trend: Schema.optionalWith(Schema.String, { as: "Option" }),
  factionName: Schema.optionalWith(Schema.String, { as: "Option" }),
  reputation: Schema.optionalWith(Schema.String, { as: "Option" }),
  reputationTrend: Schema.optionalWith(Schema.String, { as: "Option" }),
  effect: Schema.optionalWith(Schema.String, { as: "Option" }),
  effectTrend: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

export class FactionKillBondEvent extends Schema.Class<FactionKillBondEvent>("FactionKillBondEvent")({
  id: FactionKillBondEventId,
  eventId: EventId,
  killerShip: Schema.optionalWith(Schema.String, { as: "Option" }),
  awardingFaction: Schema.optionalWith(Schema.String, { as: "Option" }),
  victimFaction: Schema.optionalWith(Schema.String, { as: "Option" }),
  reward: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class MissionFailedEvent extends Schema.Class<MissionFailedEvent>("MissionFailedEvent")({
  id: MissionFailedEventId,
  eventId: EventId,
  missionName: Schema.optionalWith(Schema.String, { as: "Option" }),
  awardingFaction: Schema.optionalWith(Schema.String, { as: "Option" }),
  fine: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class MultiSellExplorationDataEvent extends Schema.Class<MultiSellExplorationDataEvent>("MultiSellExplorationDataEvent")({
  id: MultiSellExplorationDataEventId,
  eventId: EventId,
  totalEarnings: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class RedeemVoucherEvent extends Schema.Class<RedeemVoucherEvent>("RedeemVoucherEvent")({
  id: RedeemVoucherEventId,
  eventId: EventId,
  amount: Schema.optionalWith(Schema.Int, { as: "Option" }),
  faction: Schema.optionalWith(Schema.String, { as: "Option" }),
  type: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

export class SellExplorationDataEvent extends Schema.Class<SellExplorationDataEvent>("SellExplorationDataEvent")({
  id: SellExplorationDataEventId,
  eventId: EventId,
  earnings: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class CommitCrimeEvent extends Schema.Class<CommitCrimeEvent>("CommitCrimeEvent")({
  id: CommitCrimeEventId,
  eventId: EventId,
  crimeType: Schema.optionalWith(Schema.String, { as: "Option" }),
  faction: Schema.optionalWith(Schema.String, { as: "Option" }),
  victim: Schema.optionalWith(Schema.String, { as: "Option" }),
  victimFaction: Schema.optionalWith(Schema.String, { as: "Option" }),
  bounty: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class SyntheticGroundCZ extends Schema.Class<SyntheticGroundCZ>("SyntheticGroundCZ")({
  id: SyntheticGroundCZId,
  eventId: EventId,
  czType: Schema.optionalWith(Schema.String, { as: "Option" }),
  settlement: Schema.optionalWith(Schema.String, { as: "Option" }),
  faction: Schema.optionalWith(Schema.String, { as: "Option" }),
  cmdr: Schema.optionalWith(Schema.String, { as: "Option" }),
  stationFactionName: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

export class SyntheticCZ extends Schema.Class<SyntheticCZ>("SyntheticCZ")({
  id: SyntheticCZId,
  eventId: EventId,
  czType: Schema.optionalWith(Schema.String, { as: "Option" }),
  faction: Schema.optionalWith(Schema.String, { as: "Option" }),
  cmdr: Schema.optionalWith(Schema.String, { as: "Option" }),
  stationFactionName: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

// Activity and nested entities
export class Faction extends Schema.Class<Faction>("Faction")({
  id: FactionId,
  name: Schema.String,
  state: Schema.String,
  systemId: SystemId,
  bvs: Schema.optionalWith(Schema.Int, { as: "Option" }),
  cbs: Schema.optionalWith(Schema.Int, { as: "Option" }),
  exobiology: Schema.optionalWith(Schema.Int, { as: "Option" }),
  exploration: Schema.optionalWith(Schema.Int, { as: "Option" }),
  scenarios: Schema.optionalWith(Schema.Int, { as: "Option" }),
  infprimary: Schema.optionalWith(Schema.Int, { as: "Option" }),
  infsecondary: Schema.optionalWith(Schema.Int, { as: "Option" }),
  missionfails: Schema.optionalWith(Schema.Int, { as: "Option" }),
  murdersground: Schema.optionalWith(Schema.Int, { as: "Option" }),
  murdersspace: Schema.optionalWith(Schema.Int, { as: "Option" }),
  tradebm: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class System extends Schema.Class<System>("System")({
  id: SystemId,
  name: Schema.String,
  address: Schema.BigInt,
  activityId: ActivityId,
  factions: Schema.Array(Faction),
}) {}

export class Activity extends Schema.Class<Activity>("Activity")({
  id: ActivityId,
  tickid: Schema.String,
  ticktime: Schema.String,
  timestamp: Schema.String,
  cmdr: Schema.optionalWith(Schema.String, { as: "Option" }),
  systems: Schema.Array(System),
}) {}

// Objectives
export class ObjectiveTargetSettlement extends Schema.Class<ObjectiveTargetSettlement>("ObjectiveTargetSettlement")({
  id: ObjectiveTargetSettlementId,
  targetId: ObjectiveTargetId,
  name: Schema.optionalWith(Schema.String, { as: "Option" }),
  targetindividual: Schema.optionalWith(Schema.Int, { as: "Option" }),
  targetoverall: Schema.optionalWith(Schema.Int, { as: "Option" }),
  progress: Schema.optionalWith(Schema.Int, { as: "Option" }),
}) {}

export class ObjectiveTarget extends Schema.Class<ObjectiveTarget>("ObjectiveTarget")({
  id: ObjectiveTargetId,
  objectiveId: ObjectiveId,
  type: Schema.optionalWith(Schema.String, { as: "Option" }),
  station: Schema.optionalWith(Schema.String, { as: "Option" }),
  system: Schema.optionalWith(Schema.String, { as: "Option" }),
  faction: Schema.optionalWith(Schema.String, { as: "Option" }),
  progress: Schema.optionalWith(Schema.Int, { as: "Option" }),
  targetindividual: Schema.optionalWith(Schema.Int, { as: "Option" }),
  targetoverall: Schema.optionalWith(Schema.Int, { as: "Option" }),
  settlements: Schema.Array(ObjectiveTargetSettlement),
}) {}

export class Objective extends Schema.Class<Objective>("Objective")({
  id: ObjectiveId,
  title: Schema.optionalWith(Schema.String, { as: "Option" }),
  priority: Schema.optionalWith(Schema.Int, { as: "Option" }),
  type: Schema.optionalWith(Schema.String, { as: "Option" }),
  system: Schema.optionalWith(Schema.String, { as: "Option" }),
  faction: Schema.optionalWith(Schema.String, { as: "Option" }),
  description: Schema.optionalWith(Schema.String, { as: "Option" }),
  startdate: Schema.optionalWith(Schema.Date, { as: "Option" }),
  enddate: Schema.optionalWith(Schema.Date, { as: "Option" }),
  targets: Schema.Array(ObjectiveTarget),
}) {}

// Commanders
export class Cmdr extends Schema.Class<Cmdr>("Cmdr")({
  id: CmdrId,
  name: Schema.String,
  rankCombat: Schema.optionalWith(Schema.String, { as: "Option" }),
  rankTrade: Schema.optionalWith(Schema.String, { as: "Option" }),
  rankExplore: Schema.optionalWith(Schema.String, { as: "Option" }),
  rankCqc: Schema.optionalWith(Schema.String, { as: "Option" }),
  rankEmpire: Schema.optionalWith(Schema.String, { as: "Option" }),
  rankFederation: Schema.optionalWith(Schema.String, { as: "Option" }),
  rankPower: Schema.optionalWith(Schema.String, { as: "Option" }),
  credits: Schema.optionalWith(Schema.BigInt, { as: "Option" }),
  assets: Schema.optionalWith(Schema.BigInt, { as: "Option" }),
  inaraUrl: Schema.optionalWith(Schema.String, { as: "Option" }),
  squadronName: Schema.optionalWith(Schema.String, { as: "Option" }),
  squadronRank: Schema.optionalWith(Schema.String, { as: "Option" }),
}) {}

// Colonies
export class Colony extends Schema.Class<Colony>("Colony")({
  id: ColonyId,
  cmdr: Schema.optionalWith(Schema.String, { as: "Option" }),
  starsystem: Schema.optionalWith(Schema.String, { as: "Option" }),
  ravenurl: Schema.optionalWith(Schema.String, { as: "Option" }),
  priority: Schema.Int,
}) {}

// Protected Factions
export class ProtectedFaction extends Schema.Class<ProtectedFaction>("ProtectedFaction")({
  id: ProtectedFactionId,
  name: Schema.String,
  webhookUrl: Schema.optionalWith(Schema.String, { as: "Option" }),
  description: Schema.optionalWith(Schema.String, { as: "Option" }),
  protected: Schema.Boolean,
}) {}

// EDDN Models
export class EddnMessage extends Schema.Class<EddnMessage>("EddnMessage")({
  id: EddnMessageId,
  schemaRef: Schema.String,
  headerGatewayTimestamp: Schema.optionalWith(Schema.Date, { as: "Option" }),
  messageType: Schema.optionalWith(Schema.String, { as: "Option" }),
  messageJson: Schema.String,
  timestamp: Schema.Date,
}) {}

export class EddnSystemInfo extends Schema.Class<EddnSystemInfo>("EddnSystemInfo")({
  id: EddnSystemInfoId,
  eddnMessageId: Schema.optionalWith(EddnMessageId, { as: "Option" }),
  systemName: Schema.String,
  controllingFaction: Schema.optionalWith(Schema.String, { as: "Option" }),
  controllingPower: Schema.optionalWith(Schema.String, { as: "Option" }),
  population: Schema.optionalWith(Schema.Int, { as: "Option" }),
  security: Schema.optionalWith(Schema.String, { as: "Option" }),
  government: Schema.optionalWith(Schema.String, { as: "Option" }),
  allegiance: Schema.optionalWith(Schema.String, { as: "Option" }),
  updatedAt: Schema.Date,
}) {}

export class EddnFaction extends Schema.Class<EddnFaction>("EddnFaction")({
  id: EddnFactionId,
  eddnMessageId: Schema.optionalWith(EddnMessageId, { as: "Option" }),
  systemName: Schema.String,
  name: Schema.String,
  influence: Schema.optionalWith(Schema.Number, { as: "Option" }),
  state: Schema.optionalWith(Schema.String, { as: "Option" }),
  allegiance: Schema.optionalWith(Schema.String, { as: "Option" }),
  government: Schema.optionalWith(Schema.String, { as: "Option" }),
  recoveringStates: Schema.optionalWith(Schema.Unknown, { as: "Option" }), // JSON
  activeStates: Schema.optionalWith(Schema.Unknown, { as: "Option" }), // JSON
  pendingStates: Schema.optionalWith(Schema.Unknown, { as: "Option" }), // JSON
  updatedAt: Schema.Date,
}) {}

export class EddnConflict extends Schema.Class<EddnConflict>("EddnConflict")({
  id: EddnConflictId,
  eddnMessageId: Schema.optionalWith(EddnMessageId, { as: "Option" }),
  systemName: Schema.String,
  faction1: Schema.optionalWith(Schema.String, { as: "Option" }),
  faction2: Schema.optionalWith(Schema.String, { as: "Option" }),
  stake1: Schema.optionalWith(Schema.String, { as: "Option" }),
  stake2: Schema.optionalWith(Schema.String, { as: "Option" }),
  wonDays1: Schema.optionalWith(Schema.Int, { as: "Option" }),
  wonDays2: Schema.optionalWith(Schema.Int, { as: "Option" }),
  status: Schema.optionalWith(Schema.String, { as: "Option" }),
  warType: Schema.optionalWith(Schema.String, { as: "Option" }),
  updatedAt: Schema.Date,
}) {}

export class EddnPowerplay extends Schema.Class<EddnPowerplay>("EddnPowerplay")({
  id: EddnPowerplayId,
  eddnMessageId: Schema.optionalWith(EddnMessageId, { as: "Option" }),
  systemName: Schema.String,
  power: Schema.optionalWith(Schema.Unknown, { as: "Option" }), // JSON
  powerplayState: Schema.optionalWith(Schema.String, { as: "Option" }),
  controlProgress: Schema.optionalWith(Schema.Int, { as: "Option" }),
  reinforcement: Schema.optionalWith(Schema.Int, { as: "Option" }),
  undermining: Schema.optionalWith(Schema.Int, { as: "Option" }),
  updatedAt: Schema.Date,
}) {}

// Tick State
export class TickState extends Schema.Class<TickState>("TickState")({
  id: TickId,
  tickid: Schema.String,
  ticktime: Schema.String,
  lastUpdated: Schema.Date,
}) {}
