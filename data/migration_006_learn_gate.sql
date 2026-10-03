-- Migration 006 (staging): Learn-gate ("today's words") support.
-- Run this in the STAGING Supabase project's SQL Editor. Do NOT run against
-- production until this has been tested and approved.
--
-- The gate reuses the existing `sessions` table with a new mode value,
-- 'learn_gate', to track the child's current required Learn sitting (see
-- js/db.js's findActiveLearnGate / js/app.js's gate logic). No new table or
-- columns are needed -- sessions already has word_ids/current_index/status
-- from migration_003_continuity.sql -- just a widened mode check.

alter table sessions drop constraint if exists sessions_mode_check;
alter table sessions add constraint sessions_mode_check
  check (mode in ('practice', 'quiz', 'review', 'learn_gate'));
