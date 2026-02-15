-- Create Flask-compatible Users Table for Dashboard Authentication
-- This is separate from the SaaS users table and matches Flask's schema
CREATE TABLE IF NOT EXISTS flask_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Create Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_flask_users_username ON flask_users(username);
CREATE INDEX IF NOT EXISTS idx_flask_users_discord_id ON flask_users(discord_id);
