-- Migration: add user_id, source_meta, path, and updated_at to chat_logs
-- Run this in your Supabase SQL editor or via psql against the project database.
BEGIN;

-- Add user_id to track which authenticated user sent the message (nullable for anonymous sessions)
ALTER TABLE IF EXISTS chat_logs
  ADD COLUMN IF NOT EXISTS user_id text;

-- Add structured source metadata (JSON) and a path column indicating deterministic|llm|mock|canned
ALTER TABLE IF EXISTS chat_logs
  ADD COLUMN IF NOT EXISTS source_meta jsonb DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS chat_logs
  ADD COLUMN IF NOT EXISTS path text;

-- Optional: track last updated time
ALTER TABLE IF EXISTS chat_logs
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Helpful indexes for querying by user and created time
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON chat_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs (created_at);

COMMIT;

-- Notes:
-- 1) This migration keeps columns nullable so it won't break existing inserts from anonymous clients.
-- 2) If you prefer to reference auth.users with a uuid type, alter user_id to uuid and add a foreign key.
-- 3) Alternatively, you can skip adding source_meta/path columns and instead persist source metadata inside the
--    existing metadata jsonb column. The server currently writes source_meta and path as top-level columns, so
--    adding these columns keeps server and schema aligned.
