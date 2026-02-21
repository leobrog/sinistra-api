-- Create Colony Table (UUID-based, replacing Flask INTEGER-based table)

-- Colony Table
CREATE TABLE IF NOT EXISTS colony (
  id TEXT PRIMARY KEY,
  cmdr TEXT,
  starsystem TEXT,
  ravenurl TEXT,
  priority INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_colony_cmdr ON colony(cmdr);
CREATE INDEX IF NOT EXISTS idx_colony_starsystem ON colony(starsystem);
CREATE INDEX IF NOT EXISTS idx_colony_priority ON colony(priority);
