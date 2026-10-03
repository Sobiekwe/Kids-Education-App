-- Migration 007: points + avatar shop (motivation/gamification), and
-- per-attempt response time (ms) for parent-facing speed reports.
-- Run this in the Supabase SQL Editor AFTER migration_006 has been run.
-- Safe to run once; re-running skips what already exists.

-- 1. Per-attempt response time: ms from the question being shown/audio
--    finishing to the child submitting. For Quiz this is derived from the
--    countdown timer at submit time; for Practice/Review it's wall-clock
--    time since the word was displayed. Nullable -- older rows have none,
--    and Learn mode's mini-quizzes don't record attempts at all (Learn
--    stays untimed/invisible to the child by design).
alter table attempts add column if not exists response_ms int;

-- 2. Running points balance per child, and which avatar they've equipped.
alter table children add column if not exists points_balance int not null default 0;
alter table children add column if not exists avatar_id text;

-- 3. Avatar catalog -- a small curated set. Two free starters (preserving
--    what Chioma/Netochukwu already see today) plus paid unlocks in a few
--    cost tiers so the points balance actually matters.
create table if not exists avatars (
  id text primary key,
  emoji text not null,
  name text not null,
  cost int not null default 0,
  sort_order int not null default 0
);

insert into avatars (id, emoji, name, cost, sort_order) values
  ('fox', '🦊', 'Fox', 0, 1),
  ('panda', '🐼', 'Panda', 0, 2),
  ('lion', '🦁', 'Lion', 20, 3),
  ('frog', '🐸', 'Frog', 20, 4),
  ('tiger', '🐯', 'Tiger', 30, 5),
  ('koala', '🐨', 'Koala', 30, 6),
  ('owl', '🦉', 'Owl', 40, 7),
  ('unicorn', '🦄', 'Unicorn', 50, 8),
  ('robot', '🤖', 'Robot', 60, 9),
  ('dragon', '🐉', 'Dragon', 65, 10),
  ('dino', '🦖', 'Dino', 75, 11),
  ('shark', '🦈', 'Shark', 90, 12),
  ('wizard', '🧙', 'Wizard', 100, 13),
  ('superhero', '🦸', 'Superhero', 120, 14)
on conflict (id) do nothing;

-- 4. Which paid avatars a child has unlocked. Cost-0 avatars never need a
--    row here -- the app treats them as always available.
create table if not exists child_avatars (
  child_id text not null references children(id) on delete cascade,
  avatar_id text not null references avatars(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (child_id, avatar_id)
);

-- Preserve today's look (fox/panda, assigned by child-picker order) as each
-- child's starting equipped avatar, so this migration doesn't change what
-- they see on Home.
update children set avatar_id = 'fox' where id = 'child2' and avatar_id is null;    -- Chioma
update children set avatar_id = 'panda' where id = 'child1' and avatar_id is null;  -- Netochukwu

-- 5. Atomic point award. A single-statement SQL function so a read-then-
-- write race can't drop points -- fine for a household app with no
-- concurrent writers per child, but cheap to make safe anyway.
create or replace function increment_points(p_child_id text, p_amount int)
returns int
language sql
as $$
  update children set points_balance = points_balance + p_amount
  where id = p_child_id
  returning points_balance;
$$;

-- 6. Atomic avatar purchase: spend points and record the unlock in one
-- transaction, so a double-click can't grant an avatar for free or charge
-- twice. Raises if the balance is insufficient (caller shows a friendly
-- message rather than letting this exception surface).
create or replace function unlock_avatar(p_child_id text, p_avatar_id text, p_cost int)
returns int
language plpgsql
as $$
declare
  new_balance int;
begin
  update children set points_balance = points_balance - p_cost
  where id = p_child_id and points_balance >= p_cost
  returning points_balance into new_balance;

  if new_balance is null then
    raise exception 'not enough points';
  end if;

  insert into child_avatars (child_id, avatar_id) values (p_child_id, p_avatar_id)
  on conflict (child_id, avatar_id) do nothing;

  return new_balance;
end;
$$;
