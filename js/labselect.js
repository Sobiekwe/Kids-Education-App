import { sampleUnique, pickCoverageSet } from "./util.js";

// Pure word-selection logic for the Pattern Lab (Stage 2). No database or DOM
// access in here, so it can be tested on its own. `labShown` everywhere is a
// word_id -> ISO timestamp map (a word absent from it has never been shown in
// the Lab), as returned by db.js's fetchLabShownMap().

/**
 * Splits a pattern's Stage 2 words into the pool used for sittings and a
 * reserved held-out set used only by the pattern check, so a check always
 * tests words the child has not practiced. Deterministic: sorted by id, every
 * 4th word is reserved, which spreads the reserved set across all tiers.
 */
export function splitReserved(words) {
  const sorted = [...words].sort((a, b) => a.id - b.id);
  const pool = [];
  const reserved = [];
  sorted.forEach((w, i) => (i % 4 === 3 ? reserved : pool).push(w));
  return { pool, reserved };
}

/** How many new words of each difficulty tier a sitting draws, by how many
 * sittings the child has already finished for this pattern: easy first, then
 * the mix shifts toward harder words. Always totals `count`. */
export function tierQuotas(sittingsDone, count) {
  const mix = sittingsDone < 2 ? [0.6, 0.4, 0] : sittingsDone < 4 ? [0.3, 0.4, 0.3] : [0.2, 0.4, 0.4];
  const q = mix.map((m) => Math.floor(m * count));
  // Hand any rounding remainder to the middle tier.
  q[1] += count - q.reduce((a, b) => a + b, 0);
  return { 1: q[0], 2: q[1], 3: q[2] };
}

/**
 * The new words for one sitting: per-tier quotas, each filled by coverage
 * (never-shown first, then longest ago). If a tier is short, the gap is
 * filled from whatever remains in the pool, again by coverage.
 */
export function pickNewWords(pool, labShown, sittingsDone, count) {
  const quotas = tierQuotas(sittingsDone, count);
  const chosen = [];
  for (const tier of [1, 2, 3]) {
    const tierWords = pool.filter((w) => (w.difficulty || 2) === tier);
    chosen.push(...pickCoverageSet(tierWords, labShown, quotas[tier]));
  }
  if (chosen.length < count) {
    const have = new Set(chosen.map((w) => w.id));
    const rest = pool.filter((w) => !have.has(w.id));
    chosen.push(...pickCoverageSet(rest, labShown, count - chosen.length));
  }
  return chosen.slice(0, count);
}

/**
 * Review words from the original (Stage 1) list: up to `weakCount` of the
 * words the child is currently weakest on (flagged or still "learning"),
 * oldest-reviewed first, then the rest by longest-unseen-in-the-Lab so every
 * original word gets its turn sitting after sitting.
 */
export function pickReviewWords(stage1Words, labShown, weakIds, count, weakCount = 2) {
  const weakSet = new Set(weakIds);
  const weak = stage1Words
    .filter((w) => weakSet.has(w.id))
    .sort((a, b) => new Date(labShown[a.id] || 0) - new Date(labShown[b.id] || 0))
    .slice(0, Math.min(weakCount, count));
  const taken = new Set(weak.map((w) => w.id));
  const rest = stage1Words.filter((w) => !taken.has(w.id));
  return [...weak, ...pickCoverageSet(rest, labShown, count - weak.length)];
}

/** A full sitting: new + review words, shuffled together. */
export function buildSitting({ pool, stage1Words, labShown, weakIds, sittingsDone, newCount, reviewCount }) {
  const fresh = pickNewWords(pool, labShown, sittingsDone, newCount);
  const review = pickReviewWords(stage1Words, labShown, weakIds, reviewCount);
  return {
    fresh,
    review,
    words: sampleUnique([...fresh, ...review], fresh.length + review.length),
  };
}

/** The held-out words for a pattern check. Each attempt takes the next
 * `size` reserved words, wrapping around, so a retry never repeats the same
 * set (with 12 reserved words and size 6 there are two distinct sets). */
export function pickCheckWords(reserved, checkAttemptsDone, size) {
  if (reserved.length <= size) return sampleUnique(reserved, reserved.length);
  const sets = Math.floor(reserved.length / size);
  const start = (checkAttemptsDone % sets) * size;
  return sampleUnique(reserved.slice(start, start + size), size);
}
