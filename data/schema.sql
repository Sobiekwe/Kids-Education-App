-- Spelling Bee App — Phase 1 schema
-- Paste this whole file into: Supabase project → SQL Editor → New query → Run

-- Word list (F03)
create table if not exists words (
  id serial primary key,
  word text not null,
  meaning text,
  sentence text,
  part_of_speech text,
  accepted_variants text[] default '{}',  -- extra accepted spellings, parent-set (F07)
  list_version text not null default 'two-bee-grade4-2026',
  active boolean not null default true
);

-- One row per Practice/Quiz/Review attempt run (groups attempts, needed for
-- the "two distinct sessions" review-clearing rule in F10)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  child_id text not null,               -- 'child1' / 'child2', matches config.js
  mode text not null check (mode in ('practice','quiz','review')),
  size int not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score int,
  total int,
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned'))
);

-- Every submitted answer (F10: only the first submitted answer per word per
-- session counts toward mastery; retries after a reveal are just is_first_attempt = false)
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  child_id text not null,
  word_id int not null references words(id),
  submitted_answer text,
  is_correct boolean not null,
  is_timeout boolean not null default false,
  is_first_attempt boolean not null default true,
  created_at timestamptz not null default now()
);

-- Per-child, per-word review state (F10, F11)
create table if not exists word_progress (
  child_id text not null,
  word_id int not null references words(id),
  miss_streak int not null default 0,
  correct_streak int not null default 0,
  last_session_id uuid,
  flagged boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (child_id, word_id)
);

-- This is a private household app with no logins (F01/F12), so there is no
-- Supabase Auth user to check — the publishable key is used directly from
-- the browser. Row Level Security stays OFF on these tables (Supabase's
-- default for new tables) so the app can read/write with just that key.
-- Don't put anything more sensitive than spelling practice data in this project.
