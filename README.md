# Spelling Practice App (Phase 1)

A private, login-free spelling practice and quiz app for two kids, built
against `Spelling Bee App — Phase 1 Requirements (MVP)`. Plain HTML/CSS/JS —
no build step, no framework install needed.

## Staging environment

There are two environments, kept separate on purpose so testing never touches
the kids' real data:

- **`main` branch** → production. Deploys to the live Vercel URL. Points at
  the production Supabase project (Netochukwu/Chioma's real scores live
  here). Only updated when changes have been tested on staging first.
- **`staging` branch** → testing. Deploys to its own Vercel preview URL.
  Points at a separate Supabase project with the same schema but no real
  kids' data. All new features are built and pushed here first.

To promote staging to production once something's been tested: merge
`staging` into `main` and push (`git checkout main && git merge staging &&
git push`). Do this only when explicitly asked — new work should never land
on `main` by default.

## One-time setup

1. **Database**: open your Supabase project → SQL Editor → New query, paste
   and run `data/schema.sql`, then `data/seed_words.sql` (the 50 official
   Grade 4 words), then `data/migration_002_grades.sql` (adds Grades 1, 2, 3,
   5, 6 word lists, tags Grade 4 words with `grade_level`, and creates the
   `children` table with Netochukwu and Chioma carried over at Grade 4).
2. **Config**: edit `js/config.js` — set `parentPin` to whatever PIN you want
   to use to unlock Parent view. The Supabase URL/publishable key are already
   filled in. Children are no longer set here — add/edit them from Parent
   view in the running app.
3. **Deploy**: import this repo in Vercel (no build command, no output
   directory needed — it's a static site). Every push to `main` redeploys
   automatically.

## Children & grades

Parent view (PIN-gated) is where you add a child, name them, and assign a
grade 1–6 — that grade's word list is what they see in Study/Practice/Quiz.
Deactivating a child hides them from the home screen but keeps their score
history. The PIN is a soft deterrent only (checked in the browser, not a real
login) — good enough to keep kids from adding accounts themselves, not meant
to protect sensitive data.

## Continuous learning (staging only)

Two features, both gated on `data/migration_003_continuity.sql` having been
run (staging database only — not yet promoted to production):

- **Resume interrupted sessions**: if a Practice or Quiz is closed partway
  through, the home screen offers "Continue where you left off" with the
  exact same words in the exact same order, picking up at the right word.
  Starting a new set of that mode instead abandons the old one.
- **Systematic word coverage**: Practice/Quiz no longer pick words at random.
  Each child's `word_progress` row now tracks `last_shown_at` (separate from
  the mastery-tracking columns), and word selection always prefers words
  never shown, then words shown longest ago — so the full grade list gets
  even coverage over repeated sessions instead of the same words resurfacing
  while others go untouched. Review mode is unchanged — it already pulls a
  curated set of flagged/struggling words.

## Managing word lists

Also in Parent view, per grade: add one word at a time, or upload a CSV with
columns `word, meaning, sentence, part_of_speech (optional), accepted_variants
(optional, separate multiple with ;)`. Use "Download CSV template" to get a
correctly-formatted starting file. Uploads only ever add new words — a word
already in that grade (same spelling) is skipped, never overwritten, so
re-uploading a file is safe. "Remove" on a word soft-deletes it (hides it from
the app but keeps any attempt history intact); "Restore" brings it back.

## How it's organized

- `index.html` / `css/style.css` — the single page and its styling.
- `js/app.js` — home screen and screen switching.
- `js/practice.js` — Practice mode and Review-missed-words mode (same screen).
- `js/quiz.js` — timed Quiz mode.
- `js/parent.js` — PIN-gated parent view: create/edit/deactivate children,
  assign grades, and view read-only recent scores + flagged words.
- `js/db.js` — all Supabase reads/writes, including the review flag/clear
  state machine (requirement F10) and children CRUD.
- `js/tts.js` — browser text-to-speech (Web Speech API).
- `js/grading.js` — binary spelling grading/normalization (F07).
- `js/config.js` — the one file you edit to change the parent PIN, set sizes,
  timer length, and review-flag thresholds (F02 — no settings screen).
- `data/words.js` — the Grade 4 50-word list as a JS module (kept for
  reference/regenerating the SQL seed — the live app reads from Supabase).
- `data/grade_words.js` — starter word lists for Grades 1, 2, 3, 5, 6 (source
  for `scripts/build_grade_seed.mjs`, which generates the migration SQL).
- `data/schema.sql`, `data/seed_words.sql`, `data/migration_002_grades.sql` —
  run once in Supabase, in that order.

## What's intentionally NOT here (Phase 2+)

Full 450-word list, broader word banks, content editor/importer, device
pairing or parent recovery codes, trend charts, flashcards/multiple choice,
Math/Science subjects. See the requirements doc's "Build in this order" and
"Scope rule" — nothing here should be extended before the class bee without
checking it against those first.
