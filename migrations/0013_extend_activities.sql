-- Extend activity tables with complex nested data fields
-- Replaces the Flask approach of storing these as JSON text blobs

-- System-level Thargoid War data (flat columns)
ALTER TABLE system ADD COLUMN twreactivate INTEGER;
ALTER TABLE system ADD COLUMN twkills_cyclops INTEGER;
ALTER TABLE system ADD COLUMN twkills_basilisk INTEGER;
ALTER TABLE system ADD COLUMN twkills_medusa INTEGER;
ALTER TABLE system ADD COLUMN twkills_hydra INTEGER;
ALTER TABLE system ADD COLUMN twkills_orthrus INTEGER;
ALTER TABLE system ADD COLUMN twkills_scout INTEGER;
ALTER TABLE system ADD COLUMN twkills_revenant INTEGER;
ALTER TABLE system ADD COLUMN twkills_banshee INTEGER;
ALTER TABLE system ADD COLUMN twkills_scythe_glaive INTEGER;
ALTER TABLE system ADD COLUMN twsandr_blackboxes INTEGER;
ALTER TABLE system ADD COLUMN twsandr_damagedpods INTEGER;
ALTER TABLE system ADD COLUMN twsandr_occupiedpods INTEGER;
ALTER TABLE system ADD COLUMN twsandr_tissuesamples INTEGER;
ALTER TABLE system ADD COLUMN twsandr_thargoidpods INTEGER;

-- Faction-level CZ data (flat columns, settlements go in child table)
ALTER TABLE faction ADD COLUMN czspace_low INTEGER;
ALTER TABLE faction ADD COLUMN czspace_medium INTEGER;
ALTER TABLE faction ADD COLUMN czspace_high INTEGER;
ALTER TABLE faction ADD COLUMN czground_low INTEGER;
ALTER TABLE faction ADD COLUMN czground_medium INTEGER;
ALTER TABLE faction ADD COLUMN czground_high INTEGER;

-- Faction-level Search & Rescue
ALTER TABLE faction ADD COLUMN sandr_blackboxes INTEGER;
ALTER TABLE faction ADD COLUMN sandr_damagedpods INTEGER;
ALTER TABLE faction ADD COLUMN sandr_occupiedpods INTEGER;
ALTER TABLE faction ADD COLUMN sandr_thargoidpods INTEGER;
ALTER TABLE faction ADD COLUMN sandr_wreckagecomponents INTEGER;
ALTER TABLE faction ADD COLUMN sandr_personaleffects INTEGER;
ALTER TABLE faction ADD COLUMN sandr_politicalprisoners INTEGER;
ALTER TABLE faction ADD COLUMN sandr_hostages INTEGER;

-- Faction-level trade buy (no profit column — profit is sell-only per spec)
ALTER TABLE faction ADD COLUMN tradebuy_high_items INTEGER;
ALTER TABLE faction ADD COLUMN tradebuy_high_value INTEGER;
ALTER TABLE faction ADD COLUMN tradebuy_low_items INTEGER;
ALTER TABLE faction ADD COLUMN tradebuy_low_value INTEGER;
ALTER TABLE faction ADD COLUMN tradebuy_zero_items INTEGER;
ALTER TABLE faction ADD COLUMN tradebuy_zero_value INTEGER;

-- Faction-level trade sell
ALTER TABLE faction ADD COLUMN tradesell_high_items INTEGER;
ALTER TABLE faction ADD COLUMN tradesell_high_value INTEGER;
ALTER TABLE faction ADD COLUMN tradesell_high_profit INTEGER;
ALTER TABLE faction ADD COLUMN tradesell_low_items INTEGER;
ALTER TABLE faction ADD COLUMN tradesell_low_value INTEGER;
ALTER TABLE faction ADD COLUMN tradesell_low_profit INTEGER;
ALTER TABLE faction ADD COLUMN tradesell_zero_items INTEGER;
ALTER TABLE faction ADD COLUMN tradesell_zero_value INTEGER;
ALTER TABLE faction ADD COLUMN tradesell_zero_profit INTEGER;

-- CZ ground settlements (child of faction, variable-length array)
CREATE TABLE IF NOT EXISTS faction_settlement (
  id TEXT PRIMARY KEY,
  faction_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  count INTEGER NOT NULL,
  FOREIGN KEY (faction_id) REFERENCES faction(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_faction_settlement_faction_id ON faction_settlement(faction_id);

-- Stations (child of faction, variable-length array)
-- All station sub-data stored as flat columns rather than further nesting
CREATE TABLE IF NOT EXISTS faction_station (
  id TEXT PRIMARY KEY,
  faction_id TEXT NOT NULL,
  name TEXT NOT NULL,
  twreactivate INTEGER,
  twcargo_sum INTEGER,
  twcargo_count INTEGER,
  twescapepods_low_sum INTEGER,
  twescapepods_low_count INTEGER,
  twescapepods_medium_sum INTEGER,
  twescapepods_medium_count INTEGER,
  twescapepods_high_sum INTEGER,
  twescapepods_high_count INTEGER,
  twpassengers_low_sum INTEGER,
  twpassengers_low_count INTEGER,
  twpassengers_medium_sum INTEGER,
  twpassengers_medium_count INTEGER,
  twpassengers_high_sum INTEGER,
  twpassengers_high_count INTEGER,
  twmassacre_cyclops_sum INTEGER,
  twmassacre_cyclops_count INTEGER,
  twmassacre_basilisk_sum INTEGER,
  twmassacre_basilisk_count INTEGER,
  twmassacre_medusa_sum INTEGER,
  twmassacre_medusa_count INTEGER,
  twmassacre_hydra_sum INTEGER,
  twmassacre_hydra_count INTEGER,
  twmassacre_orthrus_sum INTEGER,
  twmassacre_orthrus_count INTEGER,
  twmassacre_scout_sum INTEGER,
  twmassacre_scout_count INTEGER,
  FOREIGN KEY (faction_id) REFERENCES faction(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_faction_station_faction_id ON faction_station(faction_id);
