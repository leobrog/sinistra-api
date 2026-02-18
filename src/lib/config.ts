import { Config, Context, Effect, Layer, Option, Secret } from "effect"

// Database Config
export const DatabaseUrl = Config.string("DATABASE_URL").pipe(
  Config.withDefault("file:./db/sinistra.db")
)

export const EddnDatabaseUrl = Config.string("EDDN_DATABASE_URL").pipe(
  Config.withDefault("file:./db/sinistra_eddn.db")
)

// Server Config
export const Port = Config.integer("PORT").pipe(Config.withDefault(3000))
export const Host = Config.string("HOST").pipe(Config.withDefault("0.0.0.0"))
export const NodeEnv = Config.string("NODE_ENV").pipe(
  Config.withDefault("development")
)

export const ServerName = Config.string("SERVER_NAME").pipe(
  Config.withDefault("Sinistra Server")
)

export const ServerDescription = Config.string("SERVER_DESCRIPTION").pipe(
  Config.withDefault("Sinistra BGS Tracking Server")
)

export const ServerUrl = Config.string("SERVER_URL").pipe(
  Config.withDefault("http://localhost:3000")
)

export const ApiVersion = Config.string("API_VERSION").pipe(
  Config.withDefault("2.0.0")
)

export const ApiKey = Config.secret("API_KEY")

export const FrontendUrl = Config.string("FRONTEND_URL").pipe(
  Config.withDefault("http://localhost:5000")
)

// Faction Config
export const FactionName = Config.string("FACTION_NAME").pipe(
  Config.withDefault("Communism Interstellar Union")
)

// JWT Config
export const JwtSecret = Config.secret("JWT_SECRET")
export const JwtExpiresIn = Config.string("JWT_EXPIRES_IN").pipe(
  Config.withDefault("7d")
)

// Discord OAuth Config
export const DiscordClientId = Config.string("DISCORD_CLIENT_ID")
export const DiscordClientSecret = Config.secret("DISCORD_CLIENT_SECRET")
export const DiscordRedirectUri = Config.string("DISCORD_REDIRECT_URI").pipe(
  Config.withDefault("http://localhost:3000/api/auth/discord/callback")
)

// Discord Bot Config
export const DiscordBotToken = Config.secret("DISCORD_BOT_TOKEN")
export const DiscordServerId = Config.string("DISCORD_SERVER_ID")

// Discord Webhook URLs
export const DiscordBgsWebhook = Config.option(Config.string("DISCORD_BGS_WEBHOOK"))

export const DiscordShoutoutWebhook = Config.option(Config.string("DISCORD_SHOUTOUT_WEBHOOK"))

export const DiscordConflictWebhook = Config.option(Config.string("DISCORD_CONFLICT_WEBHOOK"))

export const DiscordDebugWebhook = Config.option(Config.string("DISCORD_DEBUG_WEBHOOK"))

// Inara API Config
export const InaraApiKey = Config.secret("INARA_API_KEY")
export const InaraAppName = Config.string("INARA_APP_NAME").pipe(
  Config.withDefault("CIUChatBot")
)

export const InaraApiUrl = Config.string("INARA_API_URL").pipe(
  Config.withDefault("https://inara.cz/inapi/v1/")
)

// EDDN Config
export const EddnZmqUrl = Config.string("EDDN_ZMQ_URL").pipe(
  Config.withDefault("tcp://eddn.edcd.io:9500")
)

export const EddnCleanupIntervalMs = Config.integer(
  "EDDN_CLEANUP_INTERVAL_MS"
).pipe(Config.withDefault(3600000)) // 1 hour

export const EddnMessageRetentionMs = Config.integer(
  "EDDN_MESSAGE_RETENTION_MS"
).pipe(Config.withDefault(86400000)) // 24 hours

// Tick Monitor Config
export const TickPollIntervalMs = Config.integer("TICK_POLL_INTERVAL_MS").pipe(
  Config.withDefault(300000)
) // 5 minutes

export const TickApiUrl = Config.string("TICK_API_URL").pipe(
  Config.withDefault("http://tick.infomancer.uk/galtick.json")
)

// Scheduler Config
export const EnableSchedulers = Config.boolean("ENABLE_SCHEDULERS").pipe(
  Config.withDefault(true)
)

// Composite Config
export class AppConfig extends Context.Tag("AppConfig")<
  AppConfig,
  {
    readonly database: {
      readonly url: string
      readonly eddnUrl: string
    }
    readonly server: {
      readonly port: number
      readonly host: string
      readonly nodeEnv: string
      readonly name: string
      readonly description: string
      readonly url: string
      readonly apiVersion: string
      readonly apiKey: string
      readonly frontendUrl: string
    }
    readonly faction: {
      readonly name: string
    }
    readonly jwt: {
      readonly secret: string
      readonly expiresIn: string
    }
    readonly discord: {
      readonly oauth: {
        readonly clientId: string
        readonly clientSecret: string
        readonly redirectUri: string
      }
      readonly bot: {
        readonly token: string
        readonly serverId: string
      }
      readonly webhooks: {
        readonly bgs: Option.Option<string>
        readonly shoutout: Option.Option<string>
        readonly conflict: Option.Option<string>
        readonly debug: Option.Option<string>
      }
    }
    readonly inara: {
      readonly apiKey: string
      readonly appName: string
      readonly apiUrl: string
    }
    readonly eddn: {
      readonly zmqUrl: string
      readonly cleanupIntervalMs: number
      readonly messageRetentionMs: number
    }
    readonly tick: {
      readonly pollIntervalMs: number
      readonly apiUrl: string
    }
    readonly schedulers: {
      readonly enabled: boolean
    }
  }
>() {}

// Config Layer
export const AppConfigLive = Layer.effect(
  AppConfig,
  Effect.all({
    database: Effect.all({
      url: DatabaseUrl,
      eddnUrl: EddnDatabaseUrl,
    }),
    server: Effect.all({
      port: Port,
      host: Host,
      nodeEnv: NodeEnv,
      name: ServerName,
      description: ServerDescription,
      url: ServerUrl,
      apiVersion: ApiVersion,
      apiKey: ApiKey.pipe(Config.map(Secret.value)),
      frontendUrl: FrontendUrl,
    }),
    faction: Effect.all({
      name: FactionName,
    }),
    jwt: Effect.all({
      secret: JwtSecret.pipe(Config.map(Secret.value)),
      expiresIn: JwtExpiresIn,
    }),
    discord: Effect.all({
      oauth: Effect.all({
        clientId: DiscordClientId,
        clientSecret: DiscordClientSecret.pipe(Config.map(Secret.value)),
        redirectUri: DiscordRedirectUri,
      }),
      bot: Effect.all({
        token: DiscordBotToken.pipe(Config.map(Secret.value)),
        serverId: DiscordServerId,
      }),
      webhooks: Effect.all({
        bgs: DiscordBgsWebhook,
        shoutout: DiscordShoutoutWebhook,
        conflict: DiscordConflictWebhook,
        debug: DiscordDebugWebhook,
      }),
    }),
    inara: Effect.all({
      apiKey: InaraApiKey.pipe(Config.map(Secret.value)),
      appName: InaraAppName,
      apiUrl: InaraApiUrl,
    }),
    eddn: Effect.all({
      zmqUrl: EddnZmqUrl,
      cleanupIntervalMs: EddnCleanupIntervalMs,
      messageRetentionMs: EddnMessageRetentionMs,
    }),
    tick: Effect.all({
      pollIntervalMs: TickPollIntervalMs,
      apiUrl: TickApiUrl,
    }),
    schedulers: Effect.all({
      enabled: EnableSchedulers,
    }),
  })
)
