# Step 2: Schema Migrations

This document details the code changes required in the `migrations/*.sql` files for **Step 2** of the PostgreSQL migration plan. PostgreSQL enforces stricter typing, requiring updates to integer limits, JSON storage, and booleans.

## 1. 64-bit Integers (`BIGINT`)

SQLite's `INTEGER` holds up to 64-bit values, but PostgreSQL's `INTEGER` is limited to 32 bits (max ~2.1 billion). We must change specific columns expected to exceed this to `BIGINT`.

**Update `migrations/0004_create_events.sql`:**
- In `event`: Change `systemaddress INTEGER` to `systemaddress BIGINT`.
- In `market_buy_event`: Change `value INTEGER` to `value BIGINT`.
- In `market_sell_event`: Change `value INTEGER` to `value BIGINT`.
- In `mission_completed_event`: Change `reward INTEGER` to `reward BIGINT`.
- In `faction_kill_bond_event`: Change `reward INTEGER` to `reward BIGINT`.
- In `mission_failed_event`: Change `fine INTEGER` to `fine BIGINT`.
- In `multi_sell_exploration_data_event`: Change `total_earnings INTEGER` to `total_earnings BIGINT`.
- In `sell_exploration_data_event`: Change `earnings INTEGER` to `earnings BIGINT`.
- In `commit_crime_event`: Change `bounty INTEGER` to `bounty BIGINT`.

**Update `migrations/0007_create_cmdrs.sql`:**
- In `cmdr`: Change `credits INTEGER` to `credits BIGINT`.
- In `cmdr`: Change `assets INTEGER` to `assets BIGINT`.

**Update `migrations/0010_create_eddn_tables.sql`:**
- In `eddn_system_info`: Change `population INTEGER` to `population BIGINT`.

## 2. JSON Fields (`JSONB`)

Fields currently mapped to `TEXT` for storing JSON should be updated to `JSONB` in Postgres to allow for advanced JSON querying capabilities.

**Update `migrations/0004_create_events.sql`:**
- In `event`: Change `raw_json TEXT` to `raw_json JSONB`.

**Update `migrations/0010_create_eddn_tables.sql`:**
- In `eddn_faction`:
  - Change `recovering_states TEXT` to `recovering_states JSONB`.
  - Change `active_states TEXT` to `active_states JSONB`.
  - Change `pending_states TEXT` to `pending_states JSONB`.
- In `eddn_powerplay`: Change `power TEXT` to `power JSONB`.

## 3. Booleans (`BOOLEAN`)

SQLite emulates booleans via `INTEGER` values of `0` and `1`. PostgreSQL supports a native `BOOLEAN` type.

**Update `migrations/0009_create_protected_factions.sql`:**
- In `protected_faction`: Change `protected INTEGER NOT NULL DEFAULT 1` to `protected BOOLEAN NOT NULL DEFAULT TRUE`.

**Update `migrations/0012_create_flask_users.sql`:**
- In `flask_users`:
  - Change `is_admin INTEGER NOT NULL DEFAULT 0` to `is_admin BOOLEAN NOT NULL DEFAULT FALSE`.
  - Change `active INTEGER NOT NULL DEFAULT 1` to `active BOOLEAN NOT NULL DEFAULT TRUE`.

---
*Note: Make sure to drop and recreate your local database or run these migrations on a fresh PostgreSQL instance since PostgreSQL doesn't allow changing data types of existing columns without an `ALTER TABLE ... USING` statement.*
