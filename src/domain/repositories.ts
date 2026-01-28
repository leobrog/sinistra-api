import { Context, Effect, Option } from "effect";
import type { User, UserApiKey } from "./models.ts";
import type { ApiKey, ApiKeyId, Email, UserId } from "./ids.ts";
import type { DatabaseError, UserNotFoundError, UserAlreadyExistsError, ApiKeyNameAlreadyExistsError } from "./errors.ts";


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