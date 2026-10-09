// Parent-editable configuration (F02). No settings screen on purpose —
// change values here and redeploy when you want to adjust something.

export const CONFIG = {
  // Supabase project connection (safe to keep the publishable key here —
  // it is the public client key, not the secret one).
  // PRODUCTION: this branch points at the live production Supabase project
  // — never the staging one — see README's "Staging environment" section.
  supabaseUrl: "https://pbcenkjcxjikoupamdfb.supabase.co",
  supabasePublishableKey: "sb_publishable_xc5y9KdcA_bq4T70liSu2g_kt_TSid7",

  // Children now live in the `children` table (parent view can create/edit/
  // deactivate them) instead of being hardcoded here — see js/parent.js.

  // Parent view is gated by this shared PIN so kids can't create accounts or
  // change grades themselves. Change it to whatever you like and redeploy.
  // This is a simple deterrent, not real security — there is no login system
  // in this app (see schema.sql's note on Row Level Security).
  parentPin: "1234",

  // Set sizes and timing (F02)
  practiceSetSize: 5,
  quizSetSize: 20,
  quizSecondsPerWord: 20,
  reviewSetSize: 10,

  // Review flag/clear rule (F10)
  flagAfterConsecutiveMisses: 2,
  clearAfterConsecutiveCorrectSessions: 2,

  // Learn-gate: how many not-yet-known words make up one required "sitting"
  // before Practice/Quiz unlock. See learn.js / app.js's gate logic.
  learnBatchSize: 10,

  // Pattern Lab (Stage 2). A sitting is labNewWords new words from the
  // pattern's pool plus labReviewWords from the original list (2 weakest,
  // the rest longest-unseen). After labMinSittingsBeforeCheck sittings a
  // pattern check of labCheckSize unseen words unlocks the next pattern when
  // the child gets labCheckPassScore or more right on the first try.
  labNewWords: 10,
  labReviewWords: 5,
  labCheckSize: 6,
  labCheckPassScore: 5,
  labMinSittingsBeforeCheck: 3,

  // Voice (F09). Leave null to auto-pick the clearest available US-English
  // voice. To force a specific one, open /voices.html on the device you
  // care about, listen to the options, and paste the exact name you liked
  // here (e.g. "Google US English", "Microsoft Aria Online (Natural)").
  preferredVoiceName: null,
};
