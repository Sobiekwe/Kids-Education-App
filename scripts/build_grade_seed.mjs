// Generates data/migration_002_grades.sql from data/grade_words.js.
// Run with: node scripts/build_grade_seed.mjs
import { GRADE_WORDS } from "../data/grade_words.js";
import { writeFileSync } from "fs";

function esc(str) {
  if (str === null || str === undefined) return "null";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

let sql = `-- Migration 002: multi-grade support (grades 1-6) + parent-managed children.
-- Run this in the Supabase SQL Editor AFTER schema.sql / seed_words.sql have
-- already been run once. Safe to run once; re-running skips what already exists.

-- 1. Tag existing words with their grade level (the 50 official words are Grade 4).
alter table words add column if not exists grade_level int not null default 4;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'words_grade_level_check') then
    alter table words add constraint words_grade_level_check check (grade_level between 1 and 6);
  end if;
end $$;

-- 2. Children move from config.js into a real table the parent can manage.
create table if not exists children (
  id text primary key,
  name text not null,
  grade_level int not null check (grade_level between 1 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Preserve the two existing children (same ids used in sessions/attempts so
-- their history stays linked) — both were on the Grade 4 list.
insert into children (id, name, grade_level) values
  ('child1', 'Netochukwu', 4),
  ('child2', 'Chioma', 4)
on conflict (id) do nothing;

-- 3. Seed words for grades 1, 2, 3, 5, and 6 (Grade 4 already seeded).
--    A unique constraint on (word, grade_level) lets these inserts be re-run
--    safely without creating duplicates.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'words_word_grade_unique') then
    alter table words add constraint words_word_grade_unique unique (word, grade_level);
  end if;
end $$;
`;

for (const [grade, words] of Object.entries(GRADE_WORDS)) {
  const listVersion = `grade${grade}-2026-2027`;
  sql += `\ninsert into words (word, meaning, sentence, part_of_speech, list_version, grade_level) values\n`;
  sql += words
    .map(
      (w) =>
        `  (${esc(w.word)}, ${esc(w.meaning)}, ${esc(w.sentence)}, ${esc(w.pos)}, ${esc(listVersion)}, ${grade})`
    )
    .join(",\n");
  sql += "\non conflict (word, grade_level) do nothing;\n";
}

sql += `
-- This is a private household app with no logins — Row Level Security stays
-- OFF on the children table too, same as the rest (see schema.sql's note).
`;

writeFileSync(new URL("../data/migration_002_grades.sql", import.meta.url), sql);
console.log("Wrote data/migration_002_grades.sql");
