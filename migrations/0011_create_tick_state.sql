-- Create Tick State Table (UUID-based, replacing Flask INTEGER-based table)

-- Tick State Table
CREATE TABLE IF NOT EXISTS tick_state (
  id TEXT PRIMARY KEY,
  tickid TEXT NOT NULL UNIQUE,
  ticktime TEXT NOT NULL,
  last_updated TEXT NOT NULL  -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_tick_state_tickid ON tick_state(tickid);
CREATE INDEX IF NOT EXISTS idx_tick_state_last_updated ON tick_state(last_updated);
