-- Migration 003 (staging): continuous-learning support.
-- Run this in the STAGING Supabase project's SQL Editor after
-- migration_002_grades.sql. Do NOT run against production until this has
-- been tested and approved.

-- 1. Sessions remember their exact word list and how far the child got, so
--    an interrupted Practice/Quiz can be resumed instead of lost.
alter table sessions add column if not exists word_ids int[] not null default '{}';
alter table sessions add column if not exists current_index int not null default 0;

-- 2. Track when a word was last SHOWN to a child (regardless of whether they
--    got it right) so Practice/Quiz can prioritize words never seen, then
--    least-recently-seen, instead of picking randomly. This is separate from
--    the existing miss_streak/correct_streak/flagged columns, which track
--    mastery for the Review system — last_shown_at tracks coverage only.
alter table word_progress add column if not exists last_shown_at timestamptz;
