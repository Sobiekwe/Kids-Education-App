-- Migration 005 (staging): spelling patterns, origin, and per-kid word
-- status, for the new pattern tags + Learn mode feature.
-- Run this in the STAGING Supabase project's SQL Editor. Do NOT run against
-- production until this has been tested and approved.

-- 1. Lookup table for the 8 locked spelling patterns, so pattern names and
--    kid-friendly tips can be edited in one place without touching code.
create table if not exists patterns (
  id text primary key,
  name text not null,
  tip text not null,
  sort_order int not null
);

insert into patterns (id, name, tip, sort_order) values
  ('long_vowels',        'Long vowels',              'Long vowels say their own name, like the a in cake or the e in be.', 1),
  ('double_consonants',  'Double consonants',        'A doubled letter is still just one sound stretched over two letters.', 2),
  ('word_parts',         'Word parts',               'Break the word into smaller pieces, like un + happy, and spell each piece.', 3),
  ('adding_endings',     'Adding endings',           'Before adding an ending, check the base word: drop the silent e, double the last letter, or change y to i.', 4),
  ('unstressed_endings', 'Unstressed endings',       'Endings like -er, -or, -ar, and -ary can sound alike but are spelled differently -- learn the right one for each word.', 5),
  ('soft_c_g',           'Soft c and g',             'c and g can sound soft, like s and j, before e, i, or y.', 6),
  ('vowel_teams_r',      'Vowel teams and r-sounds', 'Watch for vowel pairs and vowels next to r -- they can change the sound completely.', 7),
  ('tricky',             'Tricky words',             'Some words just do not follow a rule -- the best way to learn them is practice.', 8)
on conflict (id) do update set name = excluded.name, tip = excluded.tip, sort_order = excluded.sort_order;

-- 2. Pattern tags + origin on words. Part of speech is NOT re-added here --
--    it already exists as words.part_of_speech (confirmed populated for all
--    50 Grade 4 words).
alter table words add column if not exists pattern_primary text references patterns(id);
alter table words add column if not exists pattern_secondary text references patterns(id);
alter table words add column if not exists origin text;
alter table words add column if not exists origin_verified boolean not null default false;

-- 3. Per-kid word status -- added to the existing word_progress table
--    (already the per-child, per-word table, keyed on child_id + word_id)
--    rather than a new table, since that would just duplicate the key.
--    A miss in Practice/Quiz sets this back to 'learning' (handled in code,
--    not here) so a child can't stay 'known' after failing a word.
alter table word_progress add column if not exists status text not null default 'new'
  check (status in ('new','learning','known'));
