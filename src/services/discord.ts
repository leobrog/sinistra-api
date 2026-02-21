/**
 * Discord service - Port of Flask's discord.py and discord_auth.py
 *
 * Provides Discord webhook, role fetching, and OAuth integration.
 */

import { Effect, Schema } from "effect"

/**
 * Discord API base URL
 */
const DISCORD_API_BASE = "https://discord.com/api/v10"

/**
 * Discord API errors
 */
export class DiscordWebhookError extends Schema.TaggedError<DiscordWebhookError>()(
  "DiscordWebhookError",
  {
    message: Schema.String,
    status: Schema.Number,
    response: Schema.optional(Schema.String),
  }
) {}

export class DiscordApiError extends Schema.TaggedError<DiscordApiError>()("DiscordApiError", {
  message: Schema.String,
  status: Schema.optional(Schema.Number),
  response: Schema.optional(Schema.String),
}) {}

export class DiscordOAuthError extends Schema.TaggedError<DiscordOAuthError>()("DiscordOAuthError", {
  message: Schema.String,
  error: Schema.optional(Schema.String),
}) {}

/**
 * Discord webhook payload
 */
export interface DiscordWebhookPayload {
  readonly content?: string
  readonly username?: string
  readonly embeds?: Array<{
    readonly title?: string
    readonly description?: string
    readonly color?: number
    readonly fields?: Array<{
      readonly name: string
      readonly value: string
      readonly inline?: boolean
    }>
  }>
}

/**
 * Discord user data from OAuth
 */
export const DiscordUser = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  discriminator: Schema.String,
  avatar: Schema.NullOr(Schema.String),
  email: Schema.optional(Schema.NullOr(Schema.String)),
})

export type DiscordUser = Schema.Schema.Type<typeof DiscordUser>

/**
 * Discord OAuth token response
 */
const DiscordTokenResponse = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  expires_in: Schema.Number,
  refresh_token: Schema.optional(Schema.String),
  scope: Schema.String,
})

/**
 * Discord guild member data
 */
const DiscordGuildMember = Schema.Struct({
  user: Schema.optional(DiscordUser),
  roles: Schema.Array(Schema.String),
  nick: Schema.optional(Schema.NullOr(Schema.String)),
})

/**
 * Discord role data
 */
const DiscordRole = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})

/**
 * Send a message to a Discord webhook
 *
 * @param url - Discord webhook URL
 * @param payload - Webhook payload (content or embeds)
 * @returns Effect that succeeds when webhook is sent
 */
export const sendWebhook = (
  url: string,
  payload: DiscordWebhookPayload
): Effect.Effect<void, DiscordWebhookError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (response.status !== 204 && !response.ok) {
        const text = await response.text()
        throw new DiscordWebhookError({
          message: `Discord webhook failed with status ${response.status}`,
          status: response.status,
          response: text,
        })
      }
    },
    catch: (error) => {
      if (error instanceof DiscordWebhookError) return error
      return new DiscordWebhookError({
        message: `Failed to send Discord webhook: ${error}`,
        status: 0,
      })
    },
  })

/**
 * Get a user's Discord roles from a guild
 *
 * @param userId - Discord user ID
 * @param guildId - Discord guild (server) ID
 * @param botToken - Discord bot token
 * @returns Effect containing array of role names
 */
export const getUserRoles = (
  userId: string,
  guildId: string,
  botToken: string
): Effect.Effect<string[], DiscordApiError> =>
  Effect.gen(function* () {
    // Fetch guild member data
    const memberUrl = `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`
    const memberResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(memberUrl, {
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
        }),
      catch: (error) =>
        new DiscordApiError({
          message: `Failed to fetch guild member: ${error}`,
        }),
    })

    // Handle 404 - user not in guild
    if (memberResponse.status === 404) {
      return []
    }

    // Handle other errors
    if (!memberResponse.ok) {
      const text = yield* Effect.tryPromise({
        try: () => memberResponse.text(),
        catch: (error) =>
          new DiscordApiError({
            message: `Failed to read error response: ${error}`,
          }),
      })
      return yield* Effect.fail(
        new DiscordApiError({
          message: "Failed to fetch guild member",
          status: memberResponse.status,
          response: text,
        })
      )
    }

    // Parse member data
    const memberData = yield* Effect.tryPromise({
      try: () => memberResponse.json(),
      catch: (error) =>
        new DiscordApiError({
          message: `Failed to parse member data: ${error}`,
        }),
    })

    const member = yield* Schema.decodeUnknown(DiscordGuildMember)(memberData)
    const userRoleIds = member.roles

    if (userRoleIds.length === 0) {
      return []
    }

    // Fetch all guild roles to resolve IDs to names
    const rolesUrl = `${DISCORD_API_BASE}/guilds/${guildId}/roles`
    const rolesResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(rolesUrl, {
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
        }),
      catch: (error) =>
        new DiscordApiError({
          message: `Failed to fetch guild roles: ${error}`,
        }),
    })

    if (!rolesResponse.ok) {
      const text = yield* Effect.tryPromise({
        try: () => rolesResponse.text(),
        catch: (error) =>
          new DiscordApiError({
            message: `Failed to read error response: ${error}`,
          }),
      })
      return yield* Effect.fail(
        new DiscordApiError({
          message: "Failed to fetch guild roles",
          status: rolesResponse.status,
          response: text,
        })
      )
    }

    // Parse roles data
    const rolesData = yield* Effect.tryPromise({
      try: () => rolesResponse.json(),
      catch: (error) =>
        new DiscordApiError({
          message: `Failed to parse roles data: ${error}`,
        }),
    })

    const allRoles = yield* Schema.decodeUnknown(Schema.Array(DiscordRole))(rolesData)

    // Create lookup map and resolve role IDs to names
    const roleLookup = new Map(allRoles.map((role) => [role.id, role.name]))
    const userRoleNames = userRoleIds.map((roleId) => roleLookup.get(roleId) ?? roleId)

    return userRoleNames
  }).pipe(
    Effect.catchTag("ParseError", (error) =>
      Effect.fail(
        new DiscordApiError({
          message: `Failed to decode Discord API response: ${error.message}`,
        })
      )
    )
  )

/**
 * Exchange OAuth authorization code for access token and user data
 *
 * @param code - OAuth authorization code
 * @param clientId - Discord application client ID
 * @param clientSecret - Discord application client secret
 * @param redirectUri - OAuth redirect URI
 * @returns Effect containing Discord user data
 */
export const exchangeOAuthCode = (
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Effect.Effect<DiscordUser, DiscordOAuthError> =>
  Effect.gen(function* () {
    // Exchange code for access token
    const tokenUrl = `${DISCORD_API_BASE}/oauth2/token`
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    })

    const tokenResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: tokenParams.toString(),
        }),
      catch: (error) =>
        new DiscordOAuthError({
          message: `Failed to exchange OAuth code: ${error}`,
        }),
    })

    if (!tokenResponse.ok) {
      const text = yield* Effect.tryPromise({
        try: () => tokenResponse.text(),
        catch: (error) =>
          new DiscordOAuthError({
            message: `Failed to read error response: ${error}`,
          }),
      })
      return yield* Effect.fail(
        new DiscordOAuthError({
          message: "Token exchange failed",
          error: text,
        })
      )
    }

    // Parse token response
    const tokenData = yield* Effect.tryPromise({
      try: () => tokenResponse.json(),
      catch: (error) =>
        new DiscordOAuthError({
          message: `Failed to parse token response: ${error}`,
        }),
    })

    const token = yield* Schema.decodeUnknown(DiscordTokenResponse)(tokenData)

    // Fetch user info using access token
    const userUrl = `${DISCORD_API_BASE}/users/@me`
    const userResponse = yield* Effect.tryPromise({
      try: () =>
        fetch(userUrl, {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        }),
      catch: (error) =>
        new DiscordOAuthError({
          message: `Failed to fetch user info: ${error}`,
        }),
    })

    if (!userResponse.ok) {
      const text = yield* Effect.tryPromise({
        try: () => userResponse.text(),
        catch: (error) =>
          new DiscordOAuthError({
            message: `Failed to read error response: ${error}`,
          }),
      })
      return yield* Effect.fail(
        new DiscordOAuthError({
          message: "User fetch failed",
          error: text,
        })
      )
    }

    // Parse and validate user data
    const userData = yield* Effect.tryPromise({
      try: () => userResponse.json(),
      catch: (error) =>
        new DiscordOAuthError({
          message: `Failed to parse user data: ${error}`,
        }),
    })

    const user = yield* Schema.decodeUnknown(DiscordUser)(userData)
    return user
  }).pipe(
    Effect.catchTag("ParseError", (error) =>
      Effect.fail(
        new DiscordOAuthError({
          message: `Failed to decode Discord API response: ${error.message}`,
        })
      )
    )
  )

/**
 * Build Discord OAuth authorization URL
 *
 * @param clientId - Discord application client ID
 * @param redirectUri - OAuth redirect URI
 * @param scopes - OAuth scopes (default: ["identify"])
 * @returns Authorization URL to redirect user to
 */
export const buildOAuthUrl = (
  clientId: string,
  redirectUri: string,
  scopes: string[] = ["identify"]
): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
  })
  return `https://discord.com/oauth2/authorize?${params.toString()}`
}
