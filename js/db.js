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

export async function startSession(childId, mode, size) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ child_id: childId, mode, size, status: "in_progress" })
    .select()
    .single();
  if (error) throw error;
  return data;
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

export async function getFlaggedWords(childId) {
  const { data, error } = await supabase
    .from("word_progress")
    .select("word_id, words(*)")
    .eq("child_id", childId)
    .eq("flagged", true);
  if (error) throw error;
  return data.map((row) => row.words);
}
