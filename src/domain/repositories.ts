import { Context, Effect, Option } from "effect";
import type {
  Activity,
  Cmdr,
  Colony,
  Event,
  MarketBuyEvent,
  MarketSellEvent,
  MissionCompletedEvent,
  MissionFailedEvent,
  MultiSellExplorationDataEvent,
  RedeemVoucherEvent,
  SellExplorationDataEvent,
  CommitCrimeEvent,
  FactionKillBondEvent,
  SyntheticGroundCZ,
  SyntheticCZ,
  Objective,
  ProtectedFaction,
  TickState,
  User,
  UserApiKey,
  EddnMessage,
  EddnSystemInfo,
  EddnFaction,
  EddnConflict,
  EddnPowerplay,
} from "./models.ts";
import type {
  ActivityId,
  ApiKey,
  ApiKeyId,
  CmdrId,
  ColonyId,
  Email,
  EventId,
  ObjectiveId,
  ProtectedFactionId,
  TickId,
  UserId,
} from "./ids.ts";
import type {
  ActivityNotFoundError,
  ApiKeyNameAlreadyExistsError,
  CmdrAlreadyExistsError,
  CmdrNotFoundError,
  ColonyNotFoundError,
  DatabaseError,
  EventNotFoundError,
  ObjectiveNotFoundError,
  ProtectedFactionAlreadyExistsError,
  ProtectedFactionNotFoundError,
  UserAlreadyExistsError,
  UserNotFoundError,
} from "./errors.ts";


export class UserRepository extends Context.Tag('UserRepository')<
    UserRepository,
    {
        create(user: User): Effect.Effect<void, DatabaseError | UserAlreadyExistsError>
        findById(id: UserId): Effect.Effect<Option.Option<User>, DatabaseError>
        findByEmail(email: Email): Effect.Effect<Option.Option<User>, DatabaseError>
        update(user: User): Effect.Effect<void, DatabaseError | UserNotFoundError>
        delete(id: UserId): Effect.Effect<void, DatabaseError>
    }
>() {}

export class ApiKeyRepository extends Context.Tag('ApiKeyRepository')<
    ApiKeyRepository,
    {
        create(apiKey: UserApiKey): Effect.Effect<void, DatabaseError | ApiKeyNameAlreadyExistsError>
        find(apiKey: ApiKey): Effect.Effect<Option.Option<ApiKey>, DatabaseError>
        findByUserId(userId: UserId): Effect.Effect<Array<UserApiKey>, DatabaseError>
        delete(id: ApiKeyId): Effect.Effect<void, DatabaseError>
    }
>() {}

// ============================================================================
// Sinistra Domain Repositories
// ============================================================================

export class EventRepository extends Context.Tag('EventRepository')<
    EventRepository,
    {
        createEvent(event: Event, subEvents?: {
            marketBuy?: MarketBuyEvent[]
            marketSell?: MarketSellEvent[]
            missionCompleted?: MissionCompletedEvent[]
            missionFailed?: MissionFailedEvent[]
            multiSellExplorationData?: MultiSellExplorationDataEvent[]
            redeemVoucher?: RedeemVoucherEvent[]
            sellExplorationData?: SellExplorationDataEvent[]
            commitCrime?: CommitCrimeEvent[]
            factionKillBond?: FactionKillBondEvent[]
            syntheticGroundCZ?: SyntheticGroundCZ[]
            syntheticCZ?: SyntheticCZ[]
        }): Effect.Effect<void, DatabaseError>
        findById(id: EventId): Effect.Effect<Option.Option<Event>, DatabaseError>
        findByTickId(tickId: string): Effect.Effect<Array<Event>, DatabaseError>
        findByDateRange(startDate: string, endDate: string): Effect.Effect<Array<Event>, DatabaseError>
    }
>() {}

export class ActivityRepository extends Context.Tag('ActivityRepository')<
    ActivityRepository,
    {
        upsert(activity: Activity): Effect.Effect<void, DatabaseError>
        findById(id: ActivityId): Effect.Effect<Option.Option<Activity>, DatabaseError>
        findByTickId(tickId: string): Effect.Effect<Option.Option<Activity>, DatabaseError>
        findByDateRange(startDate: string, endDate: string): Effect.Effect<Array<Activity>, DatabaseError>
        findByCmdr(cmdr: string): Effect.Effect<Array<Activity>, DatabaseError>
    }
>() {}

export class ObjectiveRepository extends Context.Tag('ObjectiveRepository')<
    ObjectiveRepository,
    {
        create(objective: Objective): Effect.Effect<void, DatabaseError>
        findById(id: ObjectiveId): Effect.Effect<Option.Option<Objective>, DatabaseError>
        findAll(): Effect.Effect<Array<Objective>, DatabaseError>
        findActive(now: Date): Effect.Effect<Array<Objective>, DatabaseError>
        update(objective: Objective): Effect.Effect<void, DatabaseError | ObjectiveNotFoundError>
        delete(id: ObjectiveId): Effect.Effect<void, DatabaseError>
    }
>() {}

export class CmdrRepository extends Context.Tag('CmdrRepository')<
    CmdrRepository,
    {
        create(cmdr: Cmdr): Effect.Effect<void, DatabaseError | CmdrAlreadyExistsError>
        findById(id: CmdrId): Effect.Effect<Option.Option<Cmdr>, DatabaseError>
        findByName(name: string): Effect.Effect<Option.Option<Cmdr>, DatabaseError>
        findAll(): Effect.Effect<Array<Cmdr>, DatabaseError>
        update(cmdr: Cmdr): Effect.Effect<void, DatabaseError | CmdrNotFoundError>
        delete(id: CmdrId): Effect.Effect<void, DatabaseError>
    }
>() {}

export class ColonyRepository extends Context.Tag('ColonyRepository')<
    ColonyRepository,
    {
        create(colony: Colony): Effect.Effect<void, DatabaseError>
        findById(id: ColonyId): Effect.Effect<Option.Option<Colony>, DatabaseError>
        findAll(): Effect.Effect<Array<Colony>, DatabaseError>
        findByCmdr(cmdr: string): Effect.Effect<Array<Colony>, DatabaseError>
        findBySystem(system: string): Effect.Effect<Array<Colony>, DatabaseError>
        findPriority(): Effect.Effect<Array<Colony>, DatabaseError>
        update(colony: Colony): Effect.Effect<void, DatabaseError | ColonyNotFoundError>
        delete(id: ColonyId): Effect.Effect<void, DatabaseError>
    }
>() {}

export class ProtectedFactionRepository extends Context.Tag('ProtectedFactionRepository')<
    ProtectedFactionRepository,
    {
        create(faction: ProtectedFaction): Effect.Effect<void, DatabaseError | ProtectedFactionAlreadyExistsError>
        findById(id: ProtectedFactionId): Effect.Effect<Option.Option<ProtectedFaction>, DatabaseError>
        findByName(name: string): Effect.Effect<Option.Option<ProtectedFaction>, DatabaseError>
        findAll(): Effect.Effect<Array<ProtectedFaction>, DatabaseError>
        findProtected(): Effect.Effect<Array<ProtectedFaction>, DatabaseError>
        update(faction: ProtectedFaction): Effect.Effect<void, DatabaseError | ProtectedFactionNotFoundError>
        delete(id: ProtectedFactionId): Effect.Effect<void, DatabaseError>
    }
>() {}

export class TickRepository extends Context.Tag('TickRepository')<
    TickRepository,
    {
        upsert(tick: TickState): Effect.Effect<void, DatabaseError>
        getCurrent(): Effect.Effect<Option.Option<TickState>, DatabaseError>
        findById(id: TickId): Effect.Effect<Option.Option<TickState>, DatabaseError>
    }
>() {}

export class EddnRepository extends Context.Tag('EddnRepository')<
    EddnRepository,
    {
        saveMessage(message: EddnMessage): Effect.Effect<void, DatabaseError>
        upsertSystemInfo(info: EddnSystemInfo): Effect.Effect<void, DatabaseError>
        upsertFaction(faction: EddnFaction): Effect.Effect<void, DatabaseError>
        upsertConflict(conflict: EddnConflict): Effect.Effect<void, DatabaseError>
        upsertPowerplay(powerplay: EddnPowerplay): Effect.Effect<void, DatabaseError>
        findSystemInfo(systemName: string): Effect.Effect<Option.Option<EddnSystemInfo>, DatabaseError>
        findFactionsInSystem(systemName: string): Effect.Effect<Array<EddnFaction>, DatabaseError>
        findConflictsInSystem(systemName: string): Effect.Effect<Array<EddnConflict>, DatabaseError>
        cleanupOldMessages(olderThan: Date): Effect.Effect<number, DatabaseError>
    }
>() {}