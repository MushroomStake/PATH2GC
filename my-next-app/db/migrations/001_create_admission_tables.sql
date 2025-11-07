-- Create tables for admission content and chat logs
-- Run this in Supabase SQL editor or via psql using the service role key

create table if not exists admission_steps (
  id uuid primary key default gen_random_uuid(),
  step_order int not null,
  title text not null,
  description text not null,
  checklist jsonb default '[]'::jsonb,
  related_resources jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  topic text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  type text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists chat_logs (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  user_message text,
  assistant_response text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
