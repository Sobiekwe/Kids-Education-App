import { CONFIG } from "./config.js";
import {
  startSession,
  completeSession,
  recordAttempt,
  updateSessionIndex,
  fetchLastShownMap,
  touchWordsShown,
  getSessionAttempts,
  fetchPatterns,
  awardPoints,
} from "./db.js";

// Points for a first-attempt-correct answer in Practice or Review. Flat and
// small -- Practice/Review are untimed and retry-friendly by design, so
// points here reward steady effort rather than speed (that's Quiz's job).
const PRACTICE_CORRECT_POINTS = 2;
import { playWord as playWordAudio, playSentence as playSentenceAudio, stopSpeaking } from "./tts.js";
import { isCorrectSpelling } from "./grading.js";
import { sampleUnique, pickCoverageSet, pronHtml, softCgNote, highlightHtml } from "./util.js";

/**
 * Practice mode (F04) and Review-missed-words mode (F11) share this screen:
 * untimed, speaks the word, typed spelling, unlimited retries, immediate
 * feedback with meaning + sentence, Next button.
 *
 * `resume`, when passed, continues an interrupted session instead of
 * starting a new one: { session, words } — words already in the session's
 * stored order, session.current_index says where to pick back up.
 *
 * `lab`, when passed, runs a Pattern Lab sitting or pattern check on this
 * same screen with a caller-chosen word set: { words, sessionMode ("lab" |
 * "lab_check"), patternId, title, noRetry, awardPoints, onFinish({score,total}) }.
 */
export async function renderPractice(root, { child, allWords, mode, onExit, noticeIfEmpty, resume, lab }) {
  document.body.classList.add("kid-theme");
  let session, words;

  let patterns = {};
  try {
    patterns = await fetchPatterns();
  } catch (err) {
    console.warn("Could not load spelling patterns (non-fatal):", err.message);
  }

  if (resume) {
    session = resume.session;
    words = resume.words;
  } else {
    const size = lab
      ? lab.words.length
      : mode === "review"
      ? Math.min(CONFIG.reviewSetSize, allWords.length)
      : Math.min(CONFIG.practiceSetSize, allWords.length);
    if (lab) {
      words = lab.words;
    } else if (mode === "review") {
      // Flagged words are already a curated, usually-small set — no need for
      // coverage logic on top of that.
      words = sampleUnique(allWords, size);
    } else {
      let lastShownMap = {};
      try {
        lastShownMap = await fetchLastShownMap(child.id);
      } catch (err) {
        console.warn("Could not load word-coverage data, falling back to random:", err.message);
      }
      words = pickCoverageSet(allWords, lastShownMap, size);
    }

    try {
      session = await startSession(
        child.id,
        lab ? lab.sessionMode : mode,
        words.length,
        words.map((w) => w.id),
        lab ? lab.patternId : null
      );
    } catch (err) {
      root.innerHTML = `<div class="card"><p><strong>Couldn't start this set.</strong></p><p class="muted">${err.message}</p><button class="btn-primary" id="back">Back</button></div>`;
      document.getElementById("back").onclick = onExit;
      return;
    }
    // The Lab tracks its own rotation (lab_last_shown_at) and must not
    // disturb Stage 1's last_shown_at coverage.
    if (!lab && mode !== "review") touchWordsShown(child.id, words.map((w) => w.id));
  }

  let index = resume ? session.current_index : 0;
  let firstAttemptCorrectCount = 0;
  let attemptedFirstCount = 0;
  let currentAttemptCount = 0; // attempts on the CURRENT word
  let submitting = false; // guards against a double-click/double-Enter recording two attempts
  let questionShownAt = Date.now(); // for response_ms -- reset each renderQuestion()

  if (resume) {
    try {
      const pastAttempts = await getSessionAttempts(session.id);
      if (lab) {
        // A Lab sitting/check resumes AFTER any word already answered, so a
        // child can't see a word's answer, leave, and get another first try
        // (which would also double-count it).
        const answered = new Set(pastAttempts.map((a) => a.word_id));
        while (index < words.length && answered.has(words[index].id)) index += 1;
      }
      pastAttempts.forEach((a) => {
        if (a.is_first_attempt) {
          attemptedFirstCount += 1;
          if (a.is_correct) firstAttemptCorrectCount += 1;
        }
      });
    } catch (err) {
      console.warn("Could not reload past attempts for resumed session:", err.message);
    }
  }

  function currentWord() {
    return words[index];
  }

  function patternChipHtml(w) {
    const p = w.pattern_primary && patterns[w.pattern_primary];
    if (!p) return "";
    const note = w.pattern_primary === "soft_c_g" ? softCgNote(w.word) : "";
    return `<div class="pattern-chip"><strong>${p.name}</strong> — ${p.tip}${note ? `<br>${note}` : ""}</div>`;
  }

  async function playWord() {
    const area = document.getElementById("audio-status");
    if (area) area.textContent = "🔊 Playing…";
    try {
      await playWordAudio(currentWord());
      if (area) area.textContent = "";
    } catch (err) {
      if (area) {
        area.innerHTML = `Audio didn't play (${err.message || "unknown error"}). <button class="btn-link" id="retry-audio">Retry</button>`;
        document.getElementById("retry-audio").onclick = playWord;
      }
    }
  }

  async function playSentence() {
    const w = currentWord();
    if (!w.sentence) return;
    try {
      // Spoken aloud with the real word in it, same as a real bee's
      // "use it in a sentence" — masking only matters for visible text.
      await playSentenceAudio(w);
    } catch {
      // Non-fatal for a bonus feature; ignore.
    }
  }

  function renderQuestion() {
    currentAttemptCount = 0;
    submitting = false;
    questionShownAt = Date.now();
    const noticeHtml = noticeIfEmpty && index === 0 ? `<p class="muted">${noticeIfEmpty}</p>` : "";
    root.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="exit">← Home</button>
        <div class="topbar-title"><h2>${lab ? lab.title : mode === "review" ? "Review missed words" : "Practice"} — ${child.name}</h2></div>
      </div>
      ${noticeHtml}
      <div class="progress-dots">
        ${words.map((_, i) => `<span class="dot ${i < index ? "done" : ""}"></span>`).join("")}
      </div>
      <div class="card">
        <p class="muted">Word ${index + 1} of ${words.length}</p>
        <div id="audio-status" class="muted" style="min-height:1.2em"></div>
        <div class="row" style="margin-bottom:16px">
          <button class="icon-btn" id="repeat">🔁 Repeat</button>
          <button class="icon-btn" id="sentence">💬 Use in a sentence</button>
        </div>
        <form id="answer-form" autocomplete="off">
          <input
            type="text"
            id="answer"
            name="ans-${index}-${Date.now()}"
            placeholder="Type the spelling…"
            autocomplete="new-password"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
          />
          <div class="row" style="margin-top:12px">
            <button type="submit" class="btn-primary" id="submit-btn">Submit</button>
          </div>
        </form>
        <div id="feedback"></div>
      </div>
    `;

    document.getElementById("repeat").onclick = playWord;
    document.getElementById("sentence").onclick = playSentence;
    document.getElementById("exit").onclick = onExit;

    const form = document.getElementById("answer-form");
    form.onsubmit = (e) => {
      e.preventDefault();
      handleSubmit();
    };

    const answerInput = document.getElementById("answer");
    answerInput.value = ""; // guard against stray browser autofill on a reused field id
    answerInput.focus();
    playWord();
  }

  async function handleSubmit() {
    if (submitting) return;
    submitting = true; // lock immediately, before reading input, so a second
    // near-simultaneous submit (double-click, double Enter) can't both pass
    // the empty-check below and record two attempts for the same word.
    const input = document.getElementById("answer");
    const submitBtn = document.getElementById("submit-btn");
    const value = input.value;
    if (!value.trim()) {
      submitting = false; // nothing submitted — let them keep typing
      return;
    }

    submitBtn.disabled = true; // prevent double submit (F08)
    input.disabled = true;
    currentAttemptCount += 1;
    const isFirstAttempt = currentAttemptCount === 1;
    const w = currentWord();
    const correct = isCorrectSpelling(value, w.word, w.accepted_variants);
    const responseMs = Date.now() - questionShownAt;

    if (isFirstAttempt) {
      attemptedFirstCount += 1;
      if (correct) firstAttemptCorrectCount += 1;
    }

    const earnedPoints = isFirstAttempt && correct && !(lab && lab.awardPoints === false);
    if (earnedPoints) awardPoints(child.id, PRACTICE_CORRECT_POINTS).catch(() => {});

    try {
      await recordAttempt({
        sessionId: session.id,
        childId: child.id,
        wordId: w.id,
        submittedAnswer: value,
        isCorrect: correct,
        isTimeout: false,
        isFirstAttempt,
        responseMs,
      });
    } catch (err) {
      console.warn("Could not save attempt (continuing anyway):", err.message);
    }

    stopSpeaking();
    const fb = document.getElementById("feedback");
    fb.innerHTML = `
      <div class="feedback ${correct ? "correct" : "incorrect"}">
        <div class="verdict">${correct ? "✅ Correct!" : "❌ Not quite"}</div>
        ${earnedPoints ? `<p class="points-earned">⭐ +${PRACTICE_CORRECT_POINTS} points</p>` : ""}
        ${!correct ? `<p>You wrote: <em>${escapeHtml(value)}</em></p>` : ""}
        <p><strong>${w.highlight ? highlightHtml(w.highlight) : w.word}</strong>${w.part_of_speech ? ` <span class="muted">(${w.part_of_speech})</span>` : ""}${pronHtml(w)}</p>
        ${w.meaning ? `<p>${w.meaning}</p>` : ""}
        ${w.sentence ? `<p class="muted">"${w.sentence}"</p>` : ""}
        ${patternChipHtml(w)}
        <div class="row" style="margin-top:12px">
          ${!correct && !(lab && lab.noRetry) ? `<button class="btn-secondary" id="try-again">Try again</button>` : ""}
          <button class="btn-primary" id="next">${index + 1 < words.length ? "Next word" : "Finish"}</button>
        </div>
      </div>
    `;
    input.disabled = true;
    submitBtn.style.display = "none";

    if (!correct && !(lab && lab.noRetry)) {
      document.getElementById("try-again").onclick = () => {
        submitting = false;
        input.disabled = false;
        input.value = "";
        submitBtn.style.display = "";
        submitBtn.disabled = false;
        fb.innerHTML = "";
        input.focus();
      };
    }
    document.getElementById("next").onclick = nextWord;
  }

  function nextWord() {
    index += 1;
    updateSessionIndex(session.id, index); // fire-and-forget; non-fatal if it fails
    if (index >= words.length) {
      finishSet();
    } else {
      renderQuestion();
    }
  }

  async function finishSet() {
    stopSpeaking();
    if (lab && lab.onFinish) {
      // Pattern Lab: save the score first so the Lab's progress screen (which
      // reads completed sessions) sees this sitting, then hand control back.
      try {
        await completeSession(session.id, firstAttemptCorrectCount, attemptedFirstCount);
      } catch (err) {
        console.warn("Could not save Pattern Lab score:", err.message);
      }
      lab.onFinish({ score: firstAttemptCorrectCount, total: attemptedFirstCount });
      return;
    }
    // Was missing entirely -- without this, every completed Practice/Review
    // set stayed "in_progress" forever, so Home's resumable-session banner
    // kept reappearing after every finished set, and clicking "Continue
    // where you left off" on one resumed at an out-of-bounds index and broke
    // (audio/undefined-word errors).
    completeSession(session.id, firstAttemptCorrectCount, attemptedFirstCount).catch((err) => {
      console.warn("Could not save final practice score:", err.message);
    });
    root.innerHTML = `
      <h2>Set complete — ${child.name}</h2>
      <div class="card score-hero">
        <div class="big">${firstAttemptCorrectCount}/${attemptedFirstCount}</div>
        <p class="muted">correct on the first try</p>
      </div>
      <div class="card stack">
        <button class="btn-primary" id="again">Do another set</button>
        <button class="btn-secondary" id="home">Back to home</button>
      </div>
    `;
    document.getElementById("again").onclick = () =>
      renderPractice(root, { child, allWords, mode, onExit });
    document.getElementById("home").onclick = onExit;
  }

  if (index >= words.length) finishSet();
  else renderQuestion();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
