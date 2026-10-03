-- Migration 008 (staging): real parent accounts + per-family privacy.
-- Run this in the STAGING Supabase project's SQL Editor. Do NOT run against
-- production until this has been tested and approved.
--
-- Before running this, you (the project owner) must manually create one
-- Supabase Auth user for yourself (the existing household), because this
-- migration needs that user's id to attach your existing kids to a family.
-- Steps:
--   1. Supabase dashboard -> Authentication -> Users -> Add user -> create
--      a user with your email + a password (check "Auto Confirm User").
--   2. Copy that user's UUID (shown in the Users list).
--   3. Paste it below in place of '<YOUR-AUTH-USER-UUID>' before running
--      this whole file.
--
-- Also recommended, same dashboard area: Authentication -> Providers ->
-- Email -> turn OFF "Confirm email" (so new signups can log in immediately
-- without clicking an email link) -- fine for a small family/friends app.

-- 1. Families -- one row per parent/household that signs up.
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  leaderboard_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2. Children now belong to a family.
alter table children add column if not exists family_id uuid references families(id);

-- 3. Seed your existing family from the auth user you created above, and
-- attach your existing kids to it. Safe to re-run (on conflict do nothing /
-- idempotent update).
insert into families (owner_user_id, name)
values ('<YOUR-AUTH-USER-UUID>', 'Simon''s family')
on conflict (owner_user_id) do nothing;

update children
set family_id = (select id from families where owner_user_id = '<YOUR-AUTH-USER-UUID>')
where family_id is null;

-- 4. From here on, every new child MUST have a family_id.
alter table children alter column family_id set not null;

-- 5. Helper: the calling user's family id (or null if they have none / are
-- not logged in). security definer + stable so RLS policies can use it
-- cheaply without each policy re-deriving the same subquery.
create or replace function my_family_id()
returns uuid
language sql
security definer
stable
as $$
  select id from families where owner_user_id = auth.uid();
$$;

-- 6a. New children default to the logged-in parent's family automatically,
-- so createChild() in the app doesn't need to change to pass family_id --
-- it's filled in server-side from whoever is authenticated.
alter table children alter column family_id set default my_family_id();

-- 6b. Row Level Security -- from here on, a family can only see/touch its
-- own children and their data. Words/patterns/avatars stay global catalogs,
-- untouched (no RLS -- every family reads the same word lists).

alter table families enable row level security;
create policy "owner can see own family row" on families
  for select
  using (owner_user_id = auth.uid());
create policy "owner can create own family row" on families
  for insert
  with check (owner_user_id = auth.uid());
create policy "owner can update own family row" on families
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

alter table children enable row level security;
create policy "family manages own children" on children
  for all
  using (family_id = my_family_id())
  with check (family_id = my_family_id());

alter table sessions enable row level security;
create policy "family manages own sessions" on sessions
  for all
  using (child_id in (select id from children where family_id = my_family_id()))
  with check (child_id in (select id from children where family_id = my_family_id()));

alter table attempts enable row level security;
create policy "family manages own attempts" on attempts
  for all
  using (child_id in (select id from children where family_id = my_family_id()))
  with check (child_id in (select id from children where family_id = my_family_id()));

alter table word_progress enable row level security;
create policy "family manages own word_progress" on word_progress
  for all
  using (child_id in (select id from children where family_id = my_family_id()))
  with check (child_id in (select id from children where family_id = my_family_id()));

alter table child_avatars enable row level security;
create policy "family manages own child_avatars" on child_avatars
  for all
  using (child_id in (select id from children where family_id = my_family_id()))
  with check (child_id in (select id from children where family_id = my_family_id()));

-- Words/patterns/avatars: explicitly world-readable catalogs, no RLS. Not
-- strictly necessary (RLS is off by default) but documents the decision.
-- (No ALTER needed -- just a note for future readers of this file.)
