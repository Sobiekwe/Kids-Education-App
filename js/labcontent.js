// Lesson content for each Pattern Lab pattern: the guide shown at the start,
// contrast words, a bank of yes/no questions (a few are drawn per lesson), and
// the short recap used on later sittings. Reviewed and approved by Simon.
//
// Highlight notation: [ ] = the long vowel letters, { } = the silent e.
// e.g. "c[a]k{e}", "l[igh]t".

export const LAB_CONTENT = {
  long_vowels: {
    rule: "A long vowel makes the same sound as its letter name. The a in cake sounds like the letter A. Often a silent e at the end of the word makes the vowel before it say its name.",
    examples: [
      { word: "invite", hl: "inv[i]t{e}", note: "The i says its name (I) because of the silent e.", group: "silent" },
      { word: "reinstate", hl: "reinst[a]t{e}", note: "The a says its name (A) because of the silent e.", group: "silent" },
      { word: "basement", hl: "b[a]s{e}ment", note: "The a says its name (A) because of the silent e.", group: "silent" },
      { word: "proclaim", hl: "procl[ai]m", note: "Two letters, ai, together say A.", group: "other" },
      { word: "relief", hl: "rel[ie]f", note: "The letters ie together say E.", group: "other" },
    ],
    contrast: [
      { word: "kelp", why: "The e is short, like the e in bed. There is no silent e." },
      { word: "tractor", why: "The first a is short, like the a in cat." },
      { word: "cuddle", why: "The u is short, like the u in sun." },
      { word: "puffy", why: "The u is short, like the u in cup." },
      { word: "give", why: "It has a silent e, but the i is short, like the i in sit." },
      { word: "have", why: "It has a silent e, but the a is short, like the a in cat." },
      { word: "love", why: "It has a silent e, but the o is short, like the u in sun." },
    ],
    questions: [
      { word: "cake", yes: true, hl: "c[a]k{e}", feedback: "The a says its name (A) because of the silent e." },
      { word: "bike", yes: true, hl: "b[i]k{e}", feedback: "The i says its name (I) because of the silent e." },
      { word: "home", yes: true, hl: "h[o]m{e}", feedback: "The o says its name (O) because of the silent e." },
      { word: "cube", yes: true, hl: "c[u]b{e}", feedback: "The u says its name (U) because of the silent e." },
      { word: "these", yes: true, hl: "th[e]s{e}", feedback: "The e says its name (E) because of the silent e." },
      { word: "time", yes: true, hl: "t[i]m{e}", feedback: "The i says its name (I) because of the silent e." },
      { word: "rose", yes: true, hl: "r[o]s{e}", feedback: "The o says its name (O) because of the silent e." },
      { word: "plane", yes: true, hl: "pl[a]n{e}", feedback: "The a says its name (A) because of the silent e." },
      { word: "smile", yes: true, hl: "sm[i]l{e}", feedback: "The i says its name (I) because of the silent e." },
      { word: "huge", yes: true, hl: "h[u]g{e}", feedback: "The u says its name (U) because of the silent e." },
      { word: "light", yes: true, hl: "l[igh]t", feedback: "The letters igh together say the long I." },
      { word: "train", yes: true, hl: "tr[ai]n", feedback: "The letters ai together say the long A." },
      { word: "cat", yes: false, feedback: "The a is short, like the a in apple. There is no silent e." },
      { word: "bed", yes: false, feedback: "The e is short, like the e in egg. There is no silent e." },
      { word: "hop", yes: false, feedback: "The o is short, like the o in top. There is no silent e." },
      { word: "sun", yes: false, feedback: "The u is short, like the u in cup. There is no silent e." },
      { word: "plant", yes: false, feedback: "The a is short. Two consonants after it keep it short." },
      { word: "milk", yes: false, feedback: "The i is short, like the i in sit." },
      { word: "give", yes: false, feedback: "It has a silent e, but the i is short. Give breaks the rule." },
      { word: "have", yes: false, feedback: "It has a silent e, but the a is short. Have breaks the rule." },
      { word: "love", yes: false, feedback: "It has a silent e, but the o says the short u sound. Love breaks the rule." },
      { word: "done", yes: false, feedback: "It has a silent e, but the o says the short u sound. Done breaks the rule." },
      { word: "gone", yes: false, feedback: "It has a silent e, but the o does not say its name. It sounds like the o in dawn. Gone breaks the rule." },
      { word: "come", yes: false, feedback: "It has a silent e, but the o says the short u sound. Come breaks the rule." },
    ],
    recap:
      "A long vowel says its letter name. Look for a silent e at the end: c[a]k{e}, b[i]k{e}, h[o]m{e}. A few words break the rule, like give, have and love. Now try 3 quick ones.",
    recapExamples: ["c[a]k{e}", "b[i]k{e}", "h[o]m{e}"],
    fullQuestions: 6,
    recapQuestions: 3,
  },
};
