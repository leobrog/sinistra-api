-- Create Activity Tables (UUID-based, replacing Flask INTEGER-based tables)

-- Activity Table
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  tickid TEXT NOT NULL,
  ticktime TEXT NOT NULL,
  timestamp TEXT NOT NULL,  -- ISO 8601
  cmdr TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_tickid ON activity(tickid);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_cmdr ON activity(cmdr);

-- System Table (for activity tracking)
CREATE TABLE IF NOT EXISTS system (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address INTEGER NOT NULL,
  activity_id TEXT NOT NULL,
  FOREIGN KEY (activity_id) REFERENCES activity(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_system_activity_id ON system(activity_id);
CREATE INDEX IF NOT EXISTS idx_system_name ON system(name);
CREATE INDEX IF NOT EXISTS idx_system_address ON system(address);

-- Faction Table (for activity tracking)
CREATE TABLE IF NOT EXISTS faction (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  system_id TEXT NOT NULL,
  bvs INTEGER,
  cbs INTEGER,
  exobiology INTEGER,
  exploration INTEGER,
  scenarios INTEGER,
  infprimary INTEGER,
  infsecondary INTEGER,
  missionfails INTEGER,
  murdersground INTEGER,
  murdersspace INTEGER,
  tradebm INTEGER,
  FOREIGN KEY (system_id) REFERENCES system(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_faction_system_id ON faction(system_id);
CREATE INDEX IF NOT EXISTS idx_faction_name ON faction(name);
CREATE INDEX IF NOT EXISTS idx_faction_state ON faction(state);
