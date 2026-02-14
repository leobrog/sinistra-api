-- Create Event Tables (UUID-based, replacing Flask INTEGER-based tables)

-- Main Event Table
CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  timestamp TEXT NOT NULL,  -- ISO 8601
  tickid TEXT NOT NULL,
  ticktime TEXT NOT NULL,
  cmdr TEXT,
  starsystem TEXT,
  systemaddress INTEGER,
  raw_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_tickid ON event(tickid);
CREATE INDEX IF NOT EXISTS idx_event_timestamp ON event(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_cmdr ON event(cmdr);
CREATE INDEX IF NOT EXISTS idx_event_starsystem ON event(starsystem);

-- Market Buy Event
CREATE TABLE IF NOT EXISTS market_buy_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  stock INTEGER,
  stock_bracket INTEGER,
  value INTEGER,
  count INTEGER,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_buy_event_event_id ON market_buy_event(event_id);

-- Market Sell Event
CREATE TABLE IF NOT EXISTS market_sell_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  demand INTEGER,
  demand_bracket INTEGER,
  profit INTEGER,
  value INTEGER,
  count INTEGER,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_sell_event_event_id ON market_sell_event(event_id);

-- Mission Completed Event
CREATE TABLE IF NOT EXISTS mission_completed_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  awarding_faction TEXT,
  mission_name TEXT,
  reward INTEGER,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mission_completed_event_event_id ON mission_completed_event(event_id);

-- Mission Completed Influence
CREATE TABLE IF NOT EXISTS mission_completed_influence (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  system TEXT,
  influence TEXT,
  trend TEXT,
  faction_name TEXT,
  reputation TEXT,
  reputation_trend TEXT,
  effect TEXT,
  effect_trend TEXT,
  FOREIGN KEY (mission_id) REFERENCES mission_completed_event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mission_completed_influence_mission_id ON mission_completed_influence(mission_id);

-- Faction Kill Bond Event
CREATE TABLE IF NOT EXISTS faction_kill_bond_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  killer_ship TEXT,
  awarding_faction TEXT,
  victim_faction TEXT,
  reward INTEGER,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_faction_kill_bond_event_event_id ON faction_kill_bond_event(event_id);

-- Mission Failed Event
CREATE TABLE IF NOT EXISTS mission_failed_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  mission_name TEXT,
  awarding_faction TEXT,
  fine INTEGER,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mission_failed_event_event_id ON mission_failed_event(event_id);

-- Multi Sell Exploration Data Event
CREATE TABLE IF NOT EXISTS multi_sell_exploration_data_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  total_earnings INTEGER,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_multi_sell_exploration_data_event_event_id ON multi_sell_exploration_data_event(event_id);

-- Redeem Voucher Event
CREATE TABLE IF NOT EXISTS redeem_voucher_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  amount INTEGER,
  faction TEXT,
  type TEXT,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_redeem_voucher_event_event_id ON redeem_voucher_event(event_id);

-- Sell Exploration Data Event
CREATE TABLE IF NOT EXISTS sell_exploration_data_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  earnings INTEGER,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sell_exploration_data_event_event_id ON sell_exploration_data_event(event_id);

-- Commit Crime Event
CREATE TABLE IF NOT EXISTS commit_crime_event (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  crime_type TEXT,
  faction TEXT,
  victim TEXT,
  victim_faction TEXT,
  bounty INTEGER,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_commit_crime_event_event_id ON commit_crime_event(event_id);

-- Synthetic Ground CZ (Ground Conflict Zones)
CREATE TABLE IF NOT EXISTS synthetic_ground_cz (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  cz_type TEXT,
  settlement TEXT,
  faction TEXT,
  cmdr TEXT,
  station_faction_name TEXT,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_synthetic_ground_cz_event_id ON synthetic_ground_cz(event_id);

-- Synthetic CZ (Space Conflict Zones)
CREATE TABLE IF NOT EXISTS synthetic_cz (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  cz_type TEXT,
  faction TEXT,
  cmdr TEXT,
  station_faction_name TEXT,
  FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_synthetic_cz_event_id ON synthetic_cz(event_id);
