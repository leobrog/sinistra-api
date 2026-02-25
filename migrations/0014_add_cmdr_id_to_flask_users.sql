-- Add cmdr_id foreign key to flask_users to support /linkcmdr bot command
ALTER TABLE flask_users ADD COLUMN cmdr_id TEXT REFERENCES cmdr(id);
