-- Migration 010 (staging): "Stage 2" word pool for the Pattern Lab, slice 2a.
-- Run this in the STAGING Supabase project's SQL Editor BEFORE the matching
-- code (js/db.js stage filter) is deployed there, or the staging app's word
-- query will fail on the missing column. Do NOT run against production until
-- Stage 2 has been tested and approved.
--
-- Design: Stage 1 (the original 50 official words and the other grades' starter
-- lists) keeps working exactly as before. Stage 2 words live in the same
-- `words` table, so audio, attempts, points, and reports all work unchanged,
-- but are flagged stage = 2 and are hidden from the Stage 1 flows (Study,
-- Practice, Quiz, Review) by a filter in js/db.js.
--
-- This slice (2a) loads ONE pattern (long_vowels), 10 words, Grade 4 level.
-- Meanings and sentences are original. Origins are best-effort and
-- origin_verified stays false until Simon confirms them.
-- Audio is NOT included here -- generate it afterwards with the usual backfill.

alter table words add column if not exists stage int not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'words_stage_check') then
    alter table words add constraint words_stage_check check (stage in (1, 2));
  end if;
end $$;

insert into words
  (word, meaning, sentence, part_of_speech, grade_level, stage, list_version, pattern_primary, pattern_secondary, origin)
values
  ('tadpole', 'a young frog that lives in water and has a tail.', 'The tadpole wiggled through the pond until it grew legs.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'English'),
  ('compete', 'to try to win by doing better than others.', 'Six teams will compete in the science fair this spring.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('reptile', 'a cold-blooded animal with scaly skin, such as a snake or lizard.', 'A lizard is a reptile that loves to bask on warm rocks.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('decide', 'to make up your mind about something.', 'It took her a while to decide which book to borrow.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('parade', 'a public procession with music, floats, or marchers.', 'We waved flags as the parade marched down Main Street.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'French'),
  ('suppose', 'to think something is probably true.', 'I suppose it will rain, since the sky is so dark.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('inhale', 'to breathe in.', 'Inhale slowly through your nose before you dive.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'word_parts', 'Latin'),
  ('unite', 'to join together as one.', 'The whole town came out to unite behind the school band.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin'),
  ('delight', 'great joy or pleasure.', 'The puppy jumped with delight when its owner came home.', 'noun', 4, 2, 'stage2-patterns-2026', 'long_vowels', 'tricky', 'French'),
  ('rotate', 'to turn around a center point, like a wheel.', 'The fan blades rotate faster on the highest setting.', 'verb', 4, 2, 'stage2-patterns-2026', 'long_vowels', null, 'Latin')
on conflict (word, grade_level) do nothing;
