import { CONFIG } from "./config.js";
import {
  startSession,
  recordAttempt,
  updateSessionIndex,
  fetchLastShownMap,
  touchWordsShown,
  getSessionAttempts,
  fetchPatterns,
} from "./db.js";
import { playWord as playWordAudio, playSentence as playSentenceAudio, stopSpeaking } from "./tts.js";
import { isCorrectSpelling } from "./grading.js";
import { sampleUnique, pickCoverageSet } from "./util.js";

/**
 * Practice mode (F04) and Review-missed-words mode (F11) share this screen:
 * untimed, speaks the word, typed spelling, unlimited retries, immediate
 * feedback with meaning + sentence, Next button.
 *
 * `resume`, when passed, continues an interrupted session instead of
 * starting a new one: { session, words } — words already in the session's
 * stored order, session.current_index says where to pick back up.
 */
export async function renderPractice(root, { child, allWords, mode, onExit, noticeIfEmpty, resume }) {
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
    const size = mode === "review" ? Math.min(CONFIG.reviewSetSize, allWords.length) : Math.min(CONFIG.practiceSetSize, allWords.length);
    if (mode === "review") {
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
      session = await startSession(child.id, mode, words.length, words.map((w) => w.id));
    } catch (err) {
      root.innerHTML = `<div class="card"><p><strong>Couldn't start this set.</strong></p><p class="muted">${err.message}</p><button class="btn-primary" id="back">Back</button></div>`;
      document.getElementById("back").onclick = onExit;
      return;
    }
    if (mode !== "review") touchWordsShown(child.id, words.map((w) => w.id));
  }

  let index = resume ? session.current_index : 0;
  let firstAttemptCorrectCount = 0;
  let attemptedFirstCount = 0;
  let currentAttemptCount = 0; // attempts on the CURRENT word
  let submitting = false; // guards against a double-click/double-Enter recording two attempts

  if (resume) {
    try {
      const pastAttempts = await getSessionAttempts(session.id);
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
    return `<div class="pattern-chip"><strong>${p.name}</strong> — ${p.tip}</div>`;
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
    const noticeHtml = noticeIfEmpty && index === 0 ? `<p class="muted">${noticeIfEmpty}</p>` : "";
    root.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="exit">← Home</button>
        <div class="topbar-title"><h2>${mode === "review" ? "Review missed words" : "Practice"} — ${child.name}</h2></div>
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

    if (isFirstAttempt) {
      attemptedFirstCount += 1;
      if (correct) firstAttemptCorrectCount += 1;
    }

    try {
      await recordAttempt({
        sessionId: session.id,
        childId: child.id,
        wordId: w.id,
        submittedAnswer: value,
        isCorrect: correct,
        isTimeout: false,
        isFirstAttempt,
      });
    } catch (err) {
      console.warn("Could not save attempt (continuing anyway):", err.message);
    }

    stopSpeaking();
    const fb = document.getElementById("feedback");
    fb.innerHTML = `
      <div class="feedback ${correct ? "correct" : "incorrect"}">
        <div class="verdict">${correct ? "✅ Correct!" : "❌ Not quite"}</div>
        ${!correct ? `<p>You wrote: <em>${escapeHtml(value)}</em></p>` : ""}
        <p><strong>${w.word}</strong>${w.part_of_speech ? ` <span class="muted">(${w.part_of_speech})</span>` : ""}</p>
        ${w.meaning ? `<p>${w.meaning}</p>` : ""}
        ${w.sentence ? `<p class="muted">"${w.sentence}"</p>` : ""}
        ${patternChipHtml(w)}
        <div class="row" style="margin-top:12px">
          ${!correct ? `<button class="btn-secondary" id="try-again">Try again</button>` : ""}
          <button class="btn-primary" id="next">${index + 1 < words.length ? "Next word" : "Finish"}</button>
        </div>
      </div>
    `;
    input.disabled = true;
    submitBtn.style.display = "none";

    if (!correct) {
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

  function finishSet() {
    stopSpeaking();
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

  renderQuestion();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
