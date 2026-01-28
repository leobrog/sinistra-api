# Sinistra API

A robust REST API built with [Bun](https://bun.sh), [Effect-TS](https://effect.website), and [Turso](https://turso.tech) (LibSQL).

## Features

*   **User Management**: Registration, Login, Profile retrieval, and Deletion.
*   **Authentication**: JWT-based authentication for protected routes.
*   **API Key Management**: Generate, list, and delete API keys for users.
*   **Type Safety**: End-to-end type safety using Effect Schema.
*   **Database**: SQLite/LibSQL support via Turso.

## Tech Stack

*   **Runtime**: [Bun](https://bun.sh)
*   **Framework**: [Effect-TS](https://effect.website) (@effect/platform, @effect/schema)
*   **Database**: [Turso](https://turso.tech) / LibSQL
*   **Auth**: [Jose](https://github.com/panva/jose) (JWT)

## Prerequisites

*   [Bun](https://bun.sh) (v1.0.0 or later)
*   A Turso database or a local SQLite file.

## Getting Started

### 1. Install Dependencies

```bash
bun install
```

### 2. Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Or run the helper script:

```bash
bun run gen:env-example
```

Edit `.env` with your credentials:

*   `TURSO_DATABASE_URL`: Your Turso database URL (e.g., `libsql://...`) or a local file path (e.g., `file:local.db`).
*   `TURSO_AUTH_TOKEN`: Your Turso authentication token (required for remote Turso DB).
*   `JWT_SECRET`: A secure secret string for signing JWTs.

### 3. Database Migrations

Run the migrations to set up your database schema:

```bash
bun run migrate
```

### 4. Running the Application

**Development Mode (Hot Reload):**

```bash
bun run dev
```

**Production Mode:**

```bash
bun run start
```

The server will start on port `3000`.

### 5. Testing

Run the test suite:

```bash
bun test
```

## API Endpoints

### Authentication
*   `POST /users/login` - Login with email and password. Returns a JWT access token.
*   `POST /users` - Register a new user.

### User Management (Protected)
*   `GET /users/:id` - Get user details.
*   `DELETE /users/:id` - Delete a user.

### API Keys (Protected)
*   `POST /users/:userId/api-keys` - Create a new API key.
*   `GET /users/:userId/api-keys` - List all API keys for a user.
*   `DELETE /users/:userId/api-keys/:keyId` - Delete an API key.

## Project Structure

*   `src/api`: HTTP API definitions, handlers, and DTOs.
*   `src/database`: Database client, migrations, and repositories.
*   `src/domain`: Domain models, errors, and interfaces.
*   `src/lib`: Utilities (JWT, etc.).
*   `migrations`: SQL migration files.

## License

Private