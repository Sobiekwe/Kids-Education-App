// Parent-editable configuration (F02). No settings screen on purpose —
// change values here and redeploy when you want to adjust something.

export const CONFIG = {
  // Supabase project connection (safe to keep the publishable key here —
  // it is the public client key, not the secret one).
  supabaseUrl: "https://pbcenkjcxjikoupamdfb.supabase.co",
  supabasePublishableKey: "sb_publishable_xc5y9KdcA_bq4T70liSu2g_kt_TSid7",

  // Two preconfigured children (F01). Change the "name" fields to your kids'
  // actual names — "id" must stay unique and unchanged once you've started
  // saving scores, since it's the key used in the shared database.
  children: [
    { id: "child1", name: "Netochukwu" },
    { id: "child2", name: "Chioma" },
  ],

  // Set sizes and timing (F02)
  practiceSetSize: 10,
  quizSetSize: 20,
  quizSecondsPerWord: 20,
  reviewSetSize: 10,

  // Review flag/clear rule (F10)
  flagAfterConsecutiveMisses: 2,
  clearAfterConsecutiveCorrectSessions: 2,

  // Word list version tag (must match a list_version value in the `words`
  // table — see data/schema.sql and data/words.js)
  listVersion: "two-bee-grade4-2026-2027",

  // Voice (F09). Leave null to auto-pick the clearest available US-English
  // voice. To force a specific one, open /voices.html on the device you
  // care about, listen to the options, and paste the exact name you liked
  // here (e.g. "Google US English", "Microsoft Aria Online (Natural)").
  preferredVoiceName: null,
};
