-- Create Protected Faction Table (UUID-based, replacing Flask INTEGER-based table)

-- Protected Faction Table
CREATE TABLE IF NOT EXISTS protected_faction (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  webhook_url TEXT,
  description TEXT,
  protected INTEGER NOT NULL DEFAULT 1  -- Boolean: 0 = false, 1 = true
);

CREATE INDEX IF NOT EXISTS idx_protected_faction_name ON protected_faction(name);
CREATE INDEX IF NOT EXISTS idx_protected_faction_protected ON protected_faction(protected);
