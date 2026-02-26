-- Create EDDN Tables (UUID-based, consolidating separate EDDN database into main DB)

-- EDDN Message Table
CREATE TABLE IF NOT EXISTS eddn_message (
  id TEXT PRIMARY KEY,
  schema_ref TEXT NOT NULL,
  header_gateway_timestamp TEXT,  -- ISO 8601
  message_type TEXT,
  message_json TEXT NOT NULL,
  timestamp TEXT NOT NULL  -- ISO 8601
);

CREATE INDEX IF NOT EXISTS idx_eddn_message_timestamp ON eddn_message(timestamp);
CREATE INDEX IF NOT EXISTS idx_eddn_message_type ON eddn_message(message_type);
CREATE INDEX IF NOT EXISTS idx_eddn_message_schema_ref ON eddn_message(schema_ref);

-- EDDN System Info Table
CREATE TABLE IF NOT EXISTS eddn_system_info (
  id TEXT PRIMARY KEY,
  eddn_message_id TEXT,
  system_name TEXT NOT NULL,
  controlling_faction TEXT,
  controlling_power TEXT,
  population BIGINT,
  security TEXT,
  government TEXT,
  allegiance TEXT,
  updated_at TEXT NOT NULL,  -- ISO 8601
  FOREIGN KEY (eddn_message_id) REFERENCES eddn_message(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_eddn_system_info_system_name ON eddn_system_info(system_name);
CREATE INDEX IF NOT EXISTS idx_eddn_system_info_updated_at ON eddn_system_info(updated_at);

-- EDDN Faction Table
CREATE TABLE IF NOT EXISTS eddn_faction (
  id TEXT PRIMARY KEY,
  eddn_message_id TEXT,
  system_name TEXT NOT NULL,
  name TEXT NOT NULL,
  influence REAL,
  state TEXT,
  allegiance TEXT,
  government TEXT,
  recovering_states JSONB,
  active_states JSONB,
  pending_states JSONB,
  updated_at TEXT NOT NULL,  -- ISO 8601
  FOREIGN KEY (eddn_message_id) REFERENCES eddn_message(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_eddn_faction_system_name ON eddn_faction(system_name);
CREATE INDEX IF NOT EXISTS idx_eddn_faction_name ON eddn_faction(name);
CREATE INDEX IF NOT EXISTS idx_eddn_faction_updated_at ON eddn_faction(updated_at);

-- EDDN Conflict Table
CREATE TABLE IF NOT EXISTS eddn_conflict (
  id TEXT PRIMARY KEY,
  eddn_message_id TEXT,
  system_name TEXT NOT NULL,
  faction1 TEXT,
  faction2 TEXT,
  stake1 TEXT,
  stake2 TEXT,
  won_days1 INTEGER,
  won_days2 INTEGER,
  status TEXT,
  war_type TEXT,
  updated_at TEXT NOT NULL,  -- ISO 8601
  FOREIGN KEY (eddn_message_id) REFERENCES eddn_message(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_eddn_conflict_system_name ON eddn_conflict(system_name);
CREATE INDEX IF NOT EXISTS idx_eddn_conflict_updated_at ON eddn_conflict(updated_at);

-- EDDN Powerplay Table
CREATE TABLE IF NOT EXISTS eddn_powerplay (
  id TEXT PRIMARY KEY,
  eddn_message_id TEXT,
  system_name TEXT NOT NULL,
  power JSONB,
  powerplay_state TEXT,
  control_progress INTEGER,
  reinforcement INTEGER,
  undermining INTEGER,
  updated_at TEXT NOT NULL,  -- ISO 8601
  FOREIGN KEY (eddn_message_id) REFERENCES eddn_message(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_eddn_powerplay_system_name ON eddn_powerplay(system_name);
CREATE INDEX IF NOT EXISTS idx_eddn_powerplay_updated_at ON eddn_powerplay(updated_at);
