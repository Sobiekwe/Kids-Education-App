import { supabase } from "./supabaseClient.js";
import { CONFIG } from "./config.js";

// ---- Words -----------------------------------------------------------

export async function fetchWords(gradeLevel) {
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("grade_level", gradeLevel)
    .eq("active", true)
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

/** All words for a grade, active and inactive, for Parent view management. */
export async function fetchWordsForManagement(gradeLevel) {
  const { data, error } = await supabase
    .from("words")
    .select("*")
    .eq("grade_level", gradeLevel)
    .order("word", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Adds one or more words to a grade. Relies on the (word, grade_level)
 * unique constraint (added in migration_002_grades.sql) with
 * ignoreDuplicates so a word already in that grade is silently skipped
 * rather than erroring or overwriting existing content/progress history.
 * Returns how many rows were actually inserted.
 */
export async function addWords(gradeLevel, words) {
  const listVersion = `custom-grade${gradeLevel}-${new Date().toISOString().slice(0, 10)}`;
  const rows = words.map((w) => ({
    word: w.word.trim(),
    meaning: w.meaning?.trim() || null,
    sentence: w.sentence?.trim() || null,
    part_of_speech: w.pos?.trim() || null,
    accepted_variants: w.acceptedVariants?.length ? w.acceptedVariants : [],
    grade_level: gradeLevel,
    list_version: listVersion,
    active: true,
  }));
  const { data, error } = await supabase
    .from("words")
    .upsert(rows, { onConflict: "word,grade_level", ignoreDuplicates: true })
    .select();
  if (error) throw error;
  return { added: data.length, skipped: rows.length - data.length };
}

export async function setWordActive(id, active) {
  const { error } = await supabase.from("words").update({ active }).eq("id", id);
  if (error) throw error;
}

// ---- Children (parent-managed accounts) --------------------------------

export async function fetchChildren({ includeInactive = false } = {}) {
  let query = supabase.from("children").select("*").order("name", { ascending: true });
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createChild(name, gradeLevel) {
  const id = "child_" + crypto.randomUUID();
  const { data, error } = await supabase
    .from("children")
    .insert({ id, name, grade_level: gradeLevel, active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChild(id, { name, gradeLevel }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (gradeLevel !== undefined) patch.grade_level = gradeLevel;
  const { error } = await supabase.from("children").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setChildActive(id, active) {
  const { error } = await supabase.from("children").update({ active }).eq("id", id);
  if (error) throw error;
}

// ---- Sessions ----------------------------------------------------------

/**
 * wordIds is the ordered list of word ids for this set, stored so an
 * interrupted session can be resumed with the exact same words in the
 * exact same order (continuous-learning feature, staging).
 */
export async function startSession(childId, mode, size, wordIds = []) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ child_id: childId, mode, size, status: "in_progress", word_ids: wordIds, current_index: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Persists how far into the set the child has gotten, for resuming later. */
export async function updateSessionIndex(sessionId, currentIndex) {
  const { error } = await supabase.from("sessions").update({ current_index: currentIndex }).eq("id", sessionId);
  if (error) console.warn("updateSessionIndex failed (non-fatal):", error.message);
}

export async function completeSession(sessionId, score, total) {
  const { error } = await supabase
    .from("sessions")
    .update({ completed_at: new Date().toISOString(), status: "completed", score, total })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function abandonSession(sessionId) {
  // Best-effort; F13 — unfinished sets just receive no final score.
  const { error } = await supabase
    .from("sessions")
    .update({ status: "abandoned" })
    .eq("id", sessionId)
    .eq("status", "in_progress");
  if (error) console.warn("abandonSession failed (non-fatal):", error.message);
}

/**
 * The most recent in-progress Practice or Quiz session for a child, if any
 * — used to offer "Continue where you left off" on the home screen. Review
 * sessions are deliberately excluded; they're re-curated from flagged words
 * each time rather than resumed.
 */
export async function findResumableSession(childId) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("child_id", childId)
    .eq("status", "in_progress")
    .in("mode", ["practice", "quiz"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("findResumableSession failed (non-fatal):", error.message);
    return null;
  }
  // A session with no words recorded predates this feature — nothing to resume.
  if (!data || !data.word_ids?.length) return null;
  return data;
}

/** All recorded attempts for a session, oldest first — used to reconstruct
 * scoring/results when resuming an interrupted session. */
export async function getSessionAttempts(sessionId) {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getRecentSessions(childId, limit = 5) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("child_id", childId)
    .eq("mode", "quiz")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---- Attempts + review-flag state machine (F10) -------------------------

async function getProgress(childId, wordId) {
  const { data, error } = await supabase
    .from("word_progress")
    .select("*")
    .eq("child_id", childId)
    .eq("word_id", wordId)
    .maybeSingle();
  if (error) throw error;
  return (
    data || {
      child_id: childId,
      word_id: wordId,
      miss_streak: 0,
      correct_streak: 0,
      last_session_id: null,
      flagged: false,
    }
  );
}

async function saveProgress(p) {
  const { error } = await supabase
    .from("word_progress")
    .upsert(
      {
        child_id: p.child_id,
        word_id: p.word_id,
        miss_streak: p.miss_streak,
        correct_streak: p.correct_streak,
        last_session_id: p.last_session_id,
        flagged: p.flagged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "child_id,word_id" }
    );
  if (error) throw error;
}

/**
 * Records one submitted answer and, if it is the eligible first attempt
 * (not a retry, not a timeout), advances the review flag/clear state
 * machine per requirement F10.
 */
export async function recordAttempt({ sessionId, childId, wordId, submittedAnswer, isCorrect, isTimeout, isFirstAttempt }) {
  const { error } = await supabase.from("attempts").insert({
    session_id: sessionId,
    child_id: childId,
    word_id: wordId,
    submitted_answer: submittedAnswer,
    is_correct: isCorrect,
    is_timeout: isTimeout,
    is_first_attempt: isFirstAttempt,
  });
  if (error) throw error;

  // Only a first-attempt, non-timeout answer is "eligible" for mastery tracking.
  if (!isFirstAttempt || isTimeout) return;

  const p = await getProgress(childId, wordId);

  if (!p.flagged) {
    if (isCorrect) {
      p.miss_streak = 0;
    } else {
      p.miss_streak += 1;
      if (p.miss_streak >= CONFIG.flagAfterConsecutiveMisses) {
        p.flagged = true;
        p.miss_streak = 0;
        p.correct_streak = 0;
        p.last_session_id = null;
      }
    }
  } else {
    if (isCorrect) {
      if (p.last_session_id !== sessionId) {
        p.correct_streak += 1;
        p.last_session_id = sessionId;
      }
      if (p.correct_streak >= CONFIG.clearAfterConsecutiveCorrectSessions) {
        p.flagged = false;
        p.correct_streak = 0;
        p.last_session_id = null;
      }
    } else {
      p.correct_streak = 0;
      p.last_session_id = null;
    }
  }

  await saveProgress(p);
}

/**
 * Map of word_id -> last_shown_at (ISO string) for every word this child has
 * ever been shown, regardless of whether they got it right. A word absent
 * from the map has never been shown. Used by pickCoverageSet() (util.js) so
 * Practice/Quiz draw unseen words first, then least-recently-seen ones,
 * instead of picking randomly — the continuous-learning feature (staging).
 */
export async function fetchLastShownMap(childId) {
  const { data, error } = await supabase
    .from("word_progress")
    .select("word_id, last_shown_at")
    .eq("child_id", childId)
    .not("last_shown_at", "is", null);
  if (error) throw error;
  const map = {};
  data.forEach((row) => {
    map[row.word_id] = row.last_shown_at;
  });
  return map;
}

/**
 * Marks a batch of words as "shown now" to this child, for coverage
 * tracking. Only ever touches last_shown_at — never the mastery columns
 * (miss_streak/correct_streak/flagged), which recordAttempt's state machine
 * owns exclusively.
 */
export async function touchWordsShown(childId, wordIds) {
  if (!wordIds.length) return;
  const now = new Date().toISOString();
  const rows = wordIds.map((wordId) => ({ child_id: childId, word_id: wordId, last_shown_at: now }));
  const { error } = await supabase.from("word_progress").upsert(rows, { onConflict: "child_id,word_id" });
  if (error) console.warn("touchWordsShown failed (non-fatal):", error.message);
}

export async function getFlaggedWords(childId) {
  const { data, error } = await supabase
    .from("word_progress")
    .select("word_id, words(*)")
    .eq("child_id", childId)
    .eq("flagged", true);
  if (error) throw error;
  return data.map((row) => row.words);
}
