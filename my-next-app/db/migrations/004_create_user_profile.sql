-- Migration: create user_profile table
BEGIN;

-- Create user_profile table to store editable profile fields for signed users
CREATE TABLE IF NOT EXISTS user_profile (
  id uuid PRIMARY KEY,
  name text,
  contact_number text,
  email text,
  avatar_url text,
  is_anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_user_auth FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_id ON user_profile (id);

COMMIT;

-- Notes:
-- 1) `id` references `auth.users(id)` so each authenticated user can have a profile row.
-- 2) Columns are nullable except id so existing users aren't forced to provide values immediately.
-- 3) Run this in Supabase SQL editor or via psql connected to your project.
