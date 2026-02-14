-- Create Objective Tables (UUID-based, replacing Flask INTEGER-based tables)

-- Objective Table
CREATE TABLE IF NOT EXISTS objective (
  id TEXT PRIMARY KEY,
  title TEXT,
  priority INTEGER,
  type TEXT,
  system TEXT,
  faction TEXT,
  description TEXT,
  startdate TEXT,  -- ISO 8601 date
  enddate TEXT     -- ISO 8601 date
);

CREATE INDEX IF NOT EXISTS idx_objective_priority ON objective(priority);
CREATE INDEX IF NOT EXISTS idx_objective_type ON objective(type);
CREATE INDEX IF NOT EXISTS idx_objective_system ON objective(system);
CREATE INDEX IF NOT EXISTS idx_objective_faction ON objective(faction);

-- Objective Target Table
CREATE TABLE IF NOT EXISTS objective_target (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL,
  type TEXT,
  station TEXT,
  system TEXT,
  faction TEXT,
  progress INTEGER,
  targetindividual INTEGER,
  targetoverall INTEGER,
  FOREIGN KEY (objective_id) REFERENCES objective(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_objective_target_objective_id ON objective_target(objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_target_system ON objective_target(system);
CREATE INDEX IF NOT EXISTS idx_objective_target_faction ON objective_target(faction);

-- Objective Target Settlement Table
CREATE TABLE IF NOT EXISTS objective_target_settlement (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  name TEXT,
  targetindividual INTEGER,
  targetoverall INTEGER,
  progress INTEGER,
  FOREIGN KEY (target_id) REFERENCES objective_target(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_objective_target_settlement_target_id ON objective_target_settlement(target_id);
