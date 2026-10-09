-- Migration 013 (staging): what the Pattern Lab (Stage 2, slice 2b) needs.
-- Run this in the STAGING Supabase project's SQL Editor, after
-- migration_010 and migration_012. Do NOT run against production until the
-- Pattern Lab has been tested and approved.
--
-- 1. Two new session modes for Lab sittings and pattern checks, plus the
--    pattern each one belongs to. Progress is derived from these rows.
-- 2. words.difficulty (1 easy, 2 medium, 3 hard) so sittings can move from
--    easier to harder words as a child completes more of them.
-- 3. word_progress.lab_last_shown_at: the Lab's own "last shown" clock, so
--    its rotation of the original 50 words isn't skewed by Practice/Quiz.

alter table sessions drop constraint if exists sessions_mode_check;
alter table sessions add constraint sessions_mode_check
  check (mode in ('practice', 'quiz', 'review', 'learn_gate', 'lab', 'lab_check'));

alter table sessions add column if not exists pattern_id text references patterns(id);

alter table words add column if not exists difficulty int not null default 2;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'words_difficulty_check') then
    alter table words add constraint words_difficulty_check check (difficulty between 1 and 3);
  end if;
end $$;

alter table word_progress add column if not exists lab_last_shown_at timestamptz;

-- Tier the 50 long_vowels words (17 easy, 17 medium, 16 hard).
update words set difficulty = 1 where stage = 2 and word in
  ('tadpole','parade','shade','flame','slope','globe','stripe','grape','flute','prize','cube','tune','bike','chase','vase','kite','plume');
update words set difficulty = 2 where stage = 2 and word in
  ('compete','reptile','decide','suppose','inhale','unite','delight','rotate','escape','locate','donate','excite','include','provide','promote','observe','compose');
update words set difficulty = 3 where stage = 2 and word in
  ('celebrate','anticipate','dedicate','hibernate','illustrate','imitate','navigate','estimate','evaporate','accelerate','decorate','participate','cooperate','migrate','vibrate','recognize');
