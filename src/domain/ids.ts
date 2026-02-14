import { Schema } from "effect"

// Branded ID types for type-safe entity references
export const UserId = Schema.String.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export const RateId = Schema.String.pipe(Schema.brand("RateId"))
export type RateId = typeof RateId.Type

export const ApiKeyId = Schema.String.pipe(Schema.brand("ApiKeyId"))
export type ApiKeyId = typeof ApiKeyId.Type

// Branded primitives
export const Email = Schema.String.pipe(Schema.brand("Email"))
export type Email = typeof Email.Type

export const HashedPassword = Schema.String.pipe(Schema.brand("HashedPassword"))
export type HashedPassword = typeof HashedPassword.Type

export const ApiKey = Schema.String.pipe(Schema.brand("ApiKey"))
export type ApiKey = typeof ApiKey.Type

// Sinistra Entity IDs
export const EventId = Schema.String.pipe(Schema.brand("EventId"))
export type EventId = typeof EventId.Type

export const ActivityId = Schema.String.pipe(Schema.brand("ActivityId"))
export type ActivityId = typeof ActivityId.Type

export const SystemId = Schema.String.pipe(Schema.brand("SystemId"))
export type SystemId = typeof SystemId.Type

export const FactionId = Schema.String.pipe(Schema.brand("FactionId"))
export type FactionId = typeof FactionId.Type

export const ObjectiveId = Schema.String.pipe(Schema.brand("ObjectiveId"))
export type ObjectiveId = typeof ObjectiveId.Type

export const ObjectiveTargetId = Schema.String.pipe(Schema.brand("ObjectiveTargetId"))
export type ObjectiveTargetId = typeof ObjectiveTargetId.Type

export const ObjectiveTargetSettlementId = Schema.String.pipe(Schema.brand("ObjectiveTargetSettlementId"))
export type ObjectiveTargetSettlementId = typeof ObjectiveTargetSettlementId.Type

export const CmdrId = Schema.String.pipe(Schema.brand("CmdrId"))
export type CmdrId = typeof CmdrId.Type

export const ColonyId = Schema.String.pipe(Schema.brand("ColonyId"))
export type ColonyId = typeof ColonyId.Type

export const ProtectedFactionId = Schema.String.pipe(Schema.brand("ProtectedFactionId"))
export type ProtectedFactionId = typeof ProtectedFactionId.Type

// Event sub-type IDs
export const MarketBuyEventId = Schema.String.pipe(Schema.brand("MarketBuyEventId"))
export type MarketBuyEventId = typeof MarketBuyEventId.Type

export const MarketSellEventId = Schema.String.pipe(Schema.brand("MarketSellEventId"))
export type MarketSellEventId = typeof MarketSellEventId.Type

export const MissionCompletedEventId = Schema.String.pipe(Schema.brand("MissionCompletedEventId"))
export type MissionCompletedEventId = typeof MissionCompletedEventId.Type

export const MissionCompletedInfluenceId = Schema.String.pipe(Schema.brand("MissionCompletedInfluenceId"))
export type MissionCompletedInfluenceId = typeof MissionCompletedInfluenceId.Type

export const FactionKillBondEventId = Schema.String.pipe(Schema.brand("FactionKillBondEventId"))
export type FactionKillBondEventId = typeof FactionKillBondEventId.Type

export const MissionFailedEventId = Schema.String.pipe(Schema.brand("MissionFailedEventId"))
export type MissionFailedEventId = typeof MissionFailedEventId.Type

export const MultiSellExplorationDataEventId = Schema.String.pipe(Schema.brand("MultiSellExplorationDataEventId"))
export type MultiSellExplorationDataEventId = typeof MultiSellExplorationDataEventId.Type

export const RedeemVoucherEventId = Schema.String.pipe(Schema.brand("RedeemVoucherEventId"))
export type RedeemVoucherEventId = typeof RedeemVoucherEventId.Type

export const SellExplorationDataEventId = Schema.String.pipe(Schema.brand("SellExplorationDataEventId"))
export type SellExplorationDataEventId = typeof SellExplorationDataEventId.Type

export const CommitCrimeEventId = Schema.String.pipe(Schema.brand("CommitCrimeEventId"))
export type CommitCrimeEventId = typeof CommitCrimeEventId.Type

export const SyntheticGroundCZId = Schema.String.pipe(Schema.brand("SyntheticGroundCZId"))
export type SyntheticGroundCZId = typeof SyntheticGroundCZId.Type

export const SyntheticCZId = Schema.String.pipe(Schema.brand("SyntheticCZId"))
export type SyntheticCZId = typeof SyntheticCZId.Type

// EDDN Entity IDs
export const EddnMessageId = Schema.String.pipe(Schema.brand("EddnMessageId"))
export type EddnMessageId = typeof EddnMessageId.Type

export const EddnSystemInfoId = Schema.String.pipe(Schema.brand("EddnSystemInfoId"))
export type EddnSystemInfoId = typeof EddnSystemInfoId.Type

export const EddnFactionId = Schema.String.pipe(Schema.brand("EddnFactionId"))
export type EddnFactionId = typeof EddnFactionId.Type

export const EddnConflictId = Schema.String.pipe(Schema.brand("EddnConflictId"))
export type EddnConflictId = typeof EddnConflictId.Type

export const EddnPowerplayId = Schema.String.pipe(Schema.brand("EddnPowerplayId"))
export type EddnPowerplayId = typeof EddnPowerplayId.Type

// Tick state
export const TickId = Schema.String.pipe(Schema.brand("TickId"))
export type TickId = typeof TickId.Type
