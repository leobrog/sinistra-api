# Sinistra API

A robust REST API and background service for tracking Elite Dangerous BGS (Background Simulation) and Commander data. Built with [Bun](https://bun.sh), [Effect-TS](https://effect.website), and [Turso](https://turso.tech) (LibSQL).

## Features

*   **BGS Tracking**: Real-time tracking of systems, factions, conflicts, and states via EDDN and manual updates.
*   **Commander Integration**: Track commander locations, visited systems, and bounties.
*   **Discord Integration**:
    *   OAuth login with Discord.
    *   Bot integration for role management.
    *   Webhooks for BGS updates, conflicts, and shoutouts.
*   **Inara Synchronization**: Sync commander data with Inara.cz.
*   **Tick Monitoring**: Detects and broadcasts the Elite Dangerous server tick.
*   **Authentication**: Secure access via JWT and API Keys.
*   **Type Safety**: End-to-end type safety using Effect Schema.

## Tech Stack

*   **Runtime**: [Bun](https://bun.sh)
*   **Framework**: [Effect-TS](https://effect.website) (@effect/platform, @effect/schema)
*   **Database**: [Turso](https://turso.tech) / LibSQL
*   **Networking**: ZeroMQ (EDDN), HTTP

## Prerequisites

*   [Bun](https://bun.sh) (v1.0.0 or later)
*   A Turso database or a local SQLite file.

## Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Or manually create `.env` with the following variables:

| Variable | Description |
| :--- | :--- |
| `TURSO_DATABASE_URL` | **Required**. Database URL (e.g., `libsql://...` or `file:./db/sinistra.db`). |
| `TURSO_AUTH_TOKEN` | **Required** for remote Turso DB. Leave empty for local file. |
| `API_KEY` | **Required**. Shared secret for API clients. |
| `JWT_SECRET` | **Required**. Secret for signing JWT tokens. |
| `DISCORD_CLIENT_ID` | **Required**. Discord Application Client ID. |
| `DISCORD_CLIENT_SECRET` | **Required**. Discord Application Client Secret. |
| `DISCORD_REDIRECT_URI` | **Required**. OAuth callback URL (default: `http://localhost:3000/api/auth/discord/callback`). |
| `DISCORD_BOT_TOKEN` | **Required**. Bot token for guild interactions. |
| `INARA_API_KEY` | **Required**. API Key for Inara sync. |
| `FACTION_NAME` | **Required**. The BGS faction to track (default: "Communism Interstellar Union"). |
| `ENABLE_SCHEDULERS` | specific configuration: `true` to enable background tasks. |

See `.env.example` for a full list of options including webhook URLs and scheduler settings.

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Database Migrations

Run the migrations to set up your database schema:

```bash
bun run migrate
```

### 3. Running the Application

**Development Mode (Hot Reload):**

```bash
bun run dev
```

**Production Mode:**

```bash
bun run start
```

The server will start on port `3000` by default.

## API Endpoints

The API is organized into several domains:

*   **Auth**: Discord OAuth and API Key management.
*   **System**: Detailed system information (factions, conflicts, traffic).
*   **Factions**: Faction details, history, and expansion candidates.
*   **Commanders**: Commander profiles, location history, and stats.
*   **Events**: In-game event tracking.
*   **Activities**: Player activity logging.
*   **Objectives**: Mission and goal tracking.
*   **Discord Summary**: aggregated data for Discord bot commands.

## Schedulers

The application runs background services (configurable via `ENABLE_SCHEDULERS`):

*   **Tick Monitor**: Polls for the Elite Dangerous server tick.
*   **Conflict Scheduler**: Updates conflict states.
*   **Shoutout Scheduler**: Posts shoutouts to Discord.
*   **Inara Sync**: Synchronizes roster and commander data with Inara.
*   **EDDN Client**: (Experimental) Listens to EDDN stream for real-time updates.

## Project Structure

*   `src/api`: HTTP API definitions, handlers, and DTOs.
*   `src/database`: Database client, migrations, and repositories.
*   `src/domain`: Domain models, errors, and interfaces.
*   `src/schedulers`: Background tasks and cron jobs.
*   `src/services`: Shared business logic and integrations.
*   `migrations`: SQL migration files.

## License

Private
