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

### 3. Run migrations

```bash
bun run migrate
```

### 3. Running the Application

### 4. Start the server

```bash
# Development (hot reload)
bun run dev

# Production
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

For detailed endpoint definitions, refer to the `src/api/*/api.ts` files.

## Schedulers

The application runs background services (configurable via `ENABLE_SCHEDULERS`):

*   **Tick Monitor**: Polls for the Elite Dangerous server tick.
*   **Conflict Scheduler**: Updates conflict states.
*   **Shoutout Scheduler**: Posts shoutouts to Discord.
*   **Inara Sync**: Synchronizes roster and commander data with Inara.
*   **EDDN Client**: (Experimental) Listens to EDDN stream for real-time updates.

Sinistra receives data from BGS-Tally via two endpoints. Their roles and the trade-offs between them are described below.

### `POST /api/events`

BGS-Tally posts every Elite Dangerous journal event here in near-real-time (batched every ~5 seconds). The payload is an array of raw journal entries, each enriched with BGS-Tally metadata such as the commander name, tick ID, and current star system.

The handler parses each entry by event type and writes it into normalised sub-tables:

| Event type | Table |
|------------|-------|
| `MarketBuy` | `market_buy_event` |
| `MarketSell` | `market_sell_event` |
| `MissionCompleted` | `mission_completed_event`, `mission_completed_influence` |
| `MissionFailed` | `mission_failed_event` |
| `FactionKillBond` / `RedeemVoucher` | `faction_kill_bond_event`, `redeem_voucher_event` |
| `SellExplorationData` / `MultiSellExplorationData` | `sell_exploration_data_event`, `multi_sell_exploration_data_event` |
| `CommitCrime` | `commit_crime_event` |
| `SyntheticCZ` / `SyntheticGroundCZ` | `synthetic_cz`, `synthetic_ground_cz` |
| `FSDJump` / `Location` | conflict detection (real-time, via `conflict-scheduler`) |

This is the **primary data source** for all dashboard queries (summary, leaderboard, CZ summary, recruits, conflict tracking).

### `PUT /api/activities`

Every 60 seconds (when its internal state has changed), BGS-Tally also sends a full snapshot of its pre-computed activity accumulator for the current tick. This is a structured hierarchy of `commander → systems → factions`, containing aggregated counts for missions, trade, bounty vouchers, combat bonds, CZ wins, search-and-rescue, and Thargoid War operations.

The handler stores this snapshot in the `activity`, `system`, and `faction` tables and exposes it via `GET /api/activities`.

---

## Design Note: `/events` vs `/activities` (WIP)

> **This section describes an area of active development. The current implementation is a work in progress.**

The two ingestion endpoints represent two complementary but partially overlapping strategies for storing BGS data.

**`/events` (event-sourcing model):** raw journal events are stored individually and aggregates are derived on the fly by the query layer. This is the approach used by every current dashboard endpoint. Its advantages are a single source of truth, full auditability, and the ability to re-derive any metric from scratch.

**`/activities` (pre-computed snapshot model):** BGS-Tally's own aggregator runs inside the player's client and produces a ready-made summary. Consuming it is simpler — no aggregation logic needed on the server side — but introduces a second data store that must be kept consistent with the event stream.

### Current state

All dashboard and reporting queries use the event tables exclusively. The `activity`/`system`/`faction` tables populated by `PUT /api/activities` are stored but only retrievable as a raw dump via `GET /api/activities`; they are not used by any dashboard query.

This means several BGS activity types that BGS-Tally tracks are currently **captured but never surfaced**:

| Activity | Present in `/activities` | Present in `/events` pipeline |
|----------|--------------------------|-------------------------------|
| Missions, trade, bounties, combat bonds, CZ wins | Yes | Yes — fully handled |
| **Exobiology** (`SellOrganicData`) | Yes (`faction.exobiology`) | No — event not handled |
| **Megaship / installation scenarios** (`SyntheticScenario`) | Yes (`faction.scenarios`) | No — event not handled |
| **Search & Rescue breakdown** (`SearchAndRescue`) | Yes (`faction.sandr`) | No — event not handled |
| **Thargoid War** (kills, S&R, carrier reactivation, station missions) | Yes (`system.twkills`, `faction.stations`) | No — events not handled |
| **Black market trade** | Yes (`faction.tradebm`) | No — no corresponding event |

### Planned resolution

Two paths are under consideration:

1. **Complete the event pipeline.** Add handlers in `createSubEvents` for `SellOrganicData`, `SyntheticScenario`, `SearchAndRescue`, and Thargoid War synthetic events. Once all activity types are covered by the event stream, `PUT /api/activities` becomes redundant and can be retired, leaving a clean event-sourcing architecture.

2. **Use `/activities` for the gaps.** For activity types with no clean event representation (Thargoid War, scenarios, exobiology, S&R, black market), query the `faction`/`system` tables directly. The two stores would then serve distinct purposes: `/events` for per-commander audit data, `/activities` for faction-level aggregates that BGS-Tally has already computed.

*   `src/api`: HTTP API definitions, handlers, and DTOs.
*   `src/database`: Database client, migrations, and repositories.
*   `src/domain`: Domain models, errors, and interfaces.
*   `src/schedulers`: Background tasks and cron jobs.
*   `src/services`: Shared business logic and integrations.
*   `migrations`: SQL migration files.

## License

Private
