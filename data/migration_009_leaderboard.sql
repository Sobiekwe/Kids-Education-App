-- Migration 009 (staging): opt-in cross-family leaderboard.
-- Run this in the STAGING Supabase project's SQL Editor, after
-- migration_008_families_auth.sql.
--
-- Design: families.leaderboard_opt_in (added in migration_008) defaults to
-- false -- a family's kids never appear on the leaderboard unless a parent
-- turns it on in Parent view. When it's on, ONLY first name, grade, and
-- points balance are exposed -- never full name, scores, flagged words,
-- time spent, or anything else from Reports. This function is the single
-- controlled gap in RLS: everything else stays private per family.

create or replace function get_leaderboard()
returns table (first_name text, grade_level int, points int, avatar_emoji text)
language sql
security definer
stable
as $$
  select
    split_part(c.name, ' ', 1) as first_name,
    c.grade_level,
    coalesce(c.points_balance, 0) as points,
    a.emoji as avatar_emoji
  from children c
  join families f on f.id = c.family_id
  left join avatars a on a.id = c.avatar_id
  where f.leaderboard_opt_in = true
    and c.active = true
  order by c.grade_level asc, points desc;
$$;

-- Callable by anyone, logged in or not -- the leaderboard is meant to be a
-- shared, low-friction page for families to check together.
grant execute on function get_leaderboard() to anon, authenticated;
