-- Create Commander Table (UUID-based, replacing Flask INTEGER-based table)

-- Commander Table
CREATE TABLE IF NOT EXISTS cmdr (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rank_combat TEXT,
  rank_trade TEXT,
  rank_explore TEXT,
  rank_cqc TEXT,
  rank_empire TEXT,
  rank_federation TEXT,
  rank_power TEXT,
  credits BIGINT,
  assets BIGINT,
  inara_url TEXT,
  squadron_name TEXT,
  squadron_rank TEXT
);

CREATE INDEX IF NOT EXISTS idx_cmdr_name ON cmdr(name);
CREATE INDEX IF NOT EXISTS idx_cmdr_squadron_name ON cmdr(squadron_name);
