-- Add station_faction to trade/exploration sell event tables.
-- BGS-Tally-API enriches MarketSell, SellExplorationData, and
-- MultiSellExplorationData with a StationFaction string identifying
-- the faction that owns the station where the sale occurred.

ALTER TABLE market_sell_event ADD COLUMN station_faction TEXT;
ALTER TABLE sell_exploration_data_event ADD COLUMN station_faction TEXT;
ALTER TABLE multi_sell_exploration_data_event ADD COLUMN station_faction TEXT;
