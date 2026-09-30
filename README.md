# Spelling Practice App (Phase 1)

A private, login-free spelling practice and quiz app for two kids, built
against `Spelling Bee App — Phase 1 Requirements (MVP)`. Plain HTML/CSS/JS —
no build step, no framework install needed.

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
