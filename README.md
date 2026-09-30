# Spelling Practice App (Phase 1)

A private, login-free spelling practice and quiz app for two kids, built
against `Spelling Bee App — Phase 1 Requirements (MVP)`. Plain HTML/CSS/JS —
no build step, no framework install needed.

## One-time setup

1. **Database**: open your Supabase project → SQL Editor → New query, paste
   and run `data/schema.sql`, then do the same with `data/seed_words.sql`
   (adds the 50 official words with original, non-copyrighted definitions).
2. **Config**: edit `js/config.js` — set your two kids' real names in the
   `children` array. The Supabase URL/publishable key are already filled in.
3. **Deploy**: import this repo in Vercel (no build command, no output
   directory needed — it's a static site). Every push to `main` redeploys
   automatically.

## How it's organized

- `index.html` / `css/style.css` — the single page and its styling.
- `js/app.js` — home screen and screen switching.
- `js/practice.js` — Practice mode and Review-missed-words mode (same screen).
- `js/quiz.js` — timed Quiz mode.
- `js/parent.js` — read-only parent view.
- `js/db.js` — all Supabase reads/writes, including the review flag/clear
  state machine (requirement F10).
- `js/tts.js` — browser text-to-speech (Web Speech API).
- `js/grading.js` — binary spelling grading/normalization (F07).
- `js/config.js` — the one file you edit to change child names, set sizes,
  timer length, and review-flag thresholds (F02 — no settings screen).
- `data/words.js` — the 50-word list as a JS module (kept for reference /
  regenerating the SQL seed — the live app reads from Supabase, not this file).
- `data/schema.sql`, `data/seed_words.sql` — run once in Supabase.

## What's intentionally NOT here (Phase 2+)

Full 450-word list, broader word banks, content editor/importer, device
pairing or parent recovery codes, trend charts, flashcards/multiple choice,
Math/Science subjects. See the requirements doc's "Build in this order" and
"Scope rule" — nothing here should be extended before the class bee without
checking it against those first.
