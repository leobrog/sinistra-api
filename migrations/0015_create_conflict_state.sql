-- Migration: create conflict_state table
-- Persists the last known conflict state per system for event-driven diff notifications.
-- Survives restarts. On first run all active conflicts are loaded as baseline.

CREATE TABLE IF NOT EXISTS conflict_state (
  system        TEXT PRIMARY KEY,
  faction1      TEXT NOT NULL,
  faction2      TEXT NOT NULL,
  war_type      TEXT NOT NULL,
  won_days1     INTEGER NOT NULL DEFAULT 0,
  won_days2     INTEGER NOT NULL DEFAULT 0,
  stake1        TEXT,
  stake2        TEXT,
  last_tick_id  TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
