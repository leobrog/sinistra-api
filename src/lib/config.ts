import { Config, Effect, Layer, Option } from "effect"

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
  Config.withDefault("https://elitebgs.app/api/ebgs/v5/ticks")
)

// Scheduler Config
export const EnableSchedulers = Config.boolean("ENABLE_SCHEDULERS").pipe(
  Config.withDefault(true)
)

// Composite Config
export class AppConfig {
  constructor(
    readonly database: {
      url: string
      eddnUrl: string
    },
    readonly server: {
      port: number
      host: string
      nodeEnv: string
      name: string
      description: string
      url: string
      apiVersion: string
      apiKey: string
      frontendUrl: string
    },
    readonly faction: {
      name: string
    },
    readonly jwt: {
      secret: string
      expiresIn: string
    },
    readonly discord: {
      oauth: {
        clientId: string
        clientSecret: string
        redirectUri: string
      }
      bot: {
        token: string
        serverId: string
      }
      webhooks: {
        bgs: Option.Option<string>
        shoutout: Option.Option<string>
        conflict: Option.Option<string>
        debug: Option.Option<string>
      }
    },
    readonly inara: {
      apiKey: string
      appName: string
      apiUrl: string
    },
    readonly eddn: {
      zmqUrl: string
      cleanupIntervalMs: number
      messageRetentionMs: number
    },
    readonly tick: {
      pollIntervalMs: number
      apiUrl: string
    },
    readonly schedulers: {
      enabled: boolean
    }
  ) {}
}

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
      apiKey: Config.string(ApiKey),
      frontendUrl: FrontendUrl,
    }),
    faction: Effect.all({
      name: FactionName,
    }),
    jwt: Effect.all({
      secret: Config.string(JwtSecret),
      expiresIn: JwtExpiresIn,
    }),
    discord: Effect.all({
      oauth: Effect.all({
        clientId: DiscordClientId,
        clientSecret: Config.string(DiscordClientSecret),
        redirectUri: DiscordRedirectUri,
      }),
      bot: Effect.all({
        token: Config.string(DiscordBotToken),
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
      apiKey: Config.string(InaraApiKey),
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
  }).pipe(Effect.map((config) => new AppConfig(...Object.values(config))))
)
