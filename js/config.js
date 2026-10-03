// Parent-editable configuration (F02). No settings screen on purpose —
// change values here and redeploy when you want to adjust something.

export const CONFIG = {
  // Supabase project connection (safe to keep the publishable key here —
  // it is the public client key, not the secret one).
  // STAGING: this branch points at the separate staging Supabase project,
  // never the production one — see README's "Staging environment" section.
  supabaseUrl: "https://gnmvxumsuwzgveltdegu.supabase.co",
  supabasePublishableKey: "sb_publishable_ejiPucGHjjFV0E_VkG3Nsw_eEJTf0rc",

  // Children now live in the `children` table (parent view can create/edit/
  // deactivate them) instead of being hardcoded here — see js/parent.js.

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

  // Voice (F09). Leave null to auto-pick the clearest available US-English
  // voice. To force a specific one, open /voices.html on the device you
  // care about, listen to the options, and paste the exact name you liked
  // here (e.g. "Google US English", "Microsoft Aria Online (Natural)").
  preferredVoiceName: null,
};
