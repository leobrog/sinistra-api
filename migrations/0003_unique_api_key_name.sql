-- Create Unique Index for API key names per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_user_id_name ON api_keys(user_id, name);
