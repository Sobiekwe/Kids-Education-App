import { CONFIG } from "./config.js";
import {
  startSession,
  completeSession,
  abandonSession,
  recordAttempt,
  updateSessionIndex,
  fetchLastShownMap,
  touchWordsShown,
  getSessionAttempts,
} from "./db.js";
import { speak, stopSpeaking } from "./tts.js";
import { isCorrectSpelling } from "./grading.js";
import { pickCoverageSet } from "./util.js";

/**
 * Quiz mode (F05, F06, F07): one attempt per word, per-word countdown,
 * no correctness shown until the whole set is done.
 *
 * `resume`, when passed, continues an interrupted quiz instead of starting a
 * new one: { session, words } — session.current_index says where to pick
 * back up.
 */
export async function renderQuiz(root, { child, allWords, onExit, resume }) {
  let session, words;

  if (resume) {
    session = resume.session;
    words = resume.words;
  } else {
    const size = Math.min(CONFIG.quizSetSize, allWords.length);
    let lastShownMap = {};
    try {
      lastShownMap = await fetchLastShownMap(child.id);
    } catch (err) {
      console.warn("Could not load word-coverage data, falling back to random:", err.message);
    }
    words = pickCoverageSet(allWords, lastShownMap, size);

    try {
      session = await startSession(child.id, "quiz", words.length, words.map((w) => w.id));
    } catch (err) {
      root.innerHTML = `<div class="card"><p><strong>Couldn't start the quiz.</strong></p><p class="muted">${err.message}</p><button class="btn-primary" id="back">Back</button></div>`;
      document.getElementById("back").onclick = onExit;
      return;
    }
    touchWordsShown(child.id, words.map((w) => w.id));
  }

  let index = resume ? session.current_index : 0;
  let score = 0;
  const results = []; // { word, submitted, isCorrect, isTimeout }
  let timerInterval = null;
  let secondsLeft = CONFIG.quizSecondsPerWord;
  let timerRunning = false;
  let advancing = false;

  if (resume) {
    try {
      const pastAttempts = await getSessionAttempts(session.id);
      const wordById = Object.fromEntries(words.map((w) => [w.id, w]));
      pastAttempts.forEach((a) => {
        if (a.is_correct) score += 1;
        results.push({
          word: wordById[a.word_id],
          submitted: a.submitted_answer,
          isCorrect: a.is_correct,
          isTimeout: a.is_timeout,
        });
      });
    } catch (err) {
      console.warn("Could not reload past attempts for resumed quiz:", err.message);
    }
  }

  function currentWord() {
    return words[index];
  }

  function clearTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
  }

  function startCountdown() {
    secondsLeft = CONFIG.quizSecondsPerWord;
    timerRunning = true;
    updateTimerUI();
    timerInterval = setInterval(() => {
      secondsLeft -= 1;
      updateTimerUI();
      if (secondsLeft <= 0) {
        clearTimer();
        handleTimeout();
      }
    }, 1000);
  }

  function updateTimerUI() {
    const el = document.getElementById("timer");
    if (!el) return;
    el.textContent = secondsLeft;
    el.className = "timer" + (secondsLeft <= 5 ? " low" : "");
  }

  async function playWordThenStartTimer() {
    const area = document.getElementById("audio-status");
    if (area) area.textContent = "🔊 Playing…";
    document.getElementById("submit-btn")?.setAttribute("disabled", "true");
    try {
      await speak(currentWord().word);
      if (area) area.textContent = "";
      document.getElementById("submit-btn")?.removeAttribute("disabled");
      startCountdown();
    } catch (err) {
      // F09: audio failure stops the question — no timer, no scored miss.
      if (area) {
        area.innerHTML = `Audio didn't play (${err.message || "unknown error"}). <button class="btn-link" id="retry-audio">Retry</button> <button class="btn-link" id="exit-fail">Exit quiz</button>`;
        document.getElementById("retry-audio").onclick = playWordThenStartTimer;
        document.getElementById("exit-fail").onclick = async () => {
          await abandonSession(session.id);
          onExit();
        };
      }
    }
  }

  async function playRepeatOrSentence(text) {
    // Repeat / spoken sentence never reset the countdown (F05).
    try {
      await speak(text);
    } catch {
      // Non-fatal here since the timer is already running independent of audio.
    }
  }

  function renderQuestion() {
    advancing = false;
    root.innerHTML = `
      <h2>Timed spelling quiz — ${child.name}</h2>
      <p class="muted">Not an exact bee simulation — just a timed practice quiz.</p>
      <div class="progress-dots">
        ${words.map((_, i) => `<span class="dot ${i < index ? "done" : ""}"></span>`).join("")}
      </div>
      <div class="card">
        <p class="muted">Word ${index + 1} of ${words.length}</p>
        <div id="timer" class="timer">–</div>
        <div id="audio-status" class="muted" style="min-height:1.2em; text-align:center"></div>
        <div class="row" style="margin:16px 0">
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
            <button type="submit" class="btn-primary" id="submit-btn" disabled>Submit</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById("repeat").onclick = () => playRepeatOrSentence(currentWord().word);
    document.getElementById("sentence").onclick = () => {
      const w = currentWord();
      // Spoken aloud with the real word in it, same as a real bee's
      // "use it in a sentence" — masking only matters for visible text.
      if (w.sentence) playRepeatOrSentence(w.sentence);
    };

    const form = document.getElementById("answer-form");
    form.onsubmit = (e) => {
      e.preventDefault();
      handleSubmit();
    };
    const answerInput = document.getElementById("answer");
    answerInput.value = ""; // guard against stray browser autofill on a reused field id
    answerInput.focus();

    playWordThenStartTimer();
  }

  async function handleTimeout() {
    if (advancing) return;
    advancing = true;
    const w = currentWord();
    results.push({ word: w, submitted: null, isCorrect: false, isTimeout: true });
    try {
      await recordAttempt({
        sessionId: session.id,
        childId: child.id,
        wordId: w.id,
        submittedAnswer: null,
        isCorrect: false,
        isTimeout: true,
        isFirstAttempt: true,
      });
    } catch (err) {
      console.warn("Could not save timeout attempt:", err.message);
    }
    advanceToNext();
  }

  async function handleSubmit() {
    if (advancing) return;
    advancing = true; // lock immediately, before reading input, so a second
    // near-simultaneous submit (double-click, double Enter) can't both pass
    // the empty-check below and record two attempts for the same word.
    const input = document.getElementById("answer");
    const value = input.value;
    if (!value.trim()) {
      advancing = false; // nothing submitted — let them keep typing
      return;
    }
    clearTimer();
    document.getElementById("submit-btn").disabled = true; // prevent double submit
    input.disabled = true; // belt-and-suspenders: also block the input itself

    const w = currentWord();
    const correct = isCorrectSpelling(value, w.word, w.accepted_variants);
    if (correct) score += 1;
    results.push({ word: w, submitted: value, isCorrect: correct, isTimeout: false });

    try {
      await recordAttempt({
        sessionId: session.id,
        childId: child.id,
        wordId: w.id,
        submittedAnswer: value,
        isCorrect: correct,
        isTimeout: false,
        isFirstAttempt: true,
      });
    } catch (err) {
      console.warn("Could not save attempt:", err.message);
    }

    advanceToNext();
  }

  function advanceToNext() {
    stopSpeaking();
    index += 1;
    updateSessionIndex(session.id, index); // fire-and-forget; non-fatal if it fails
    if (index >= words.length) {
      finishQuiz();
    } else {
      renderQuestion();
    }
  }

  async function finishQuiz() {
    try {
      await completeSession(session.id, score, words.length);
    } catch (err) {
      console.warn("Could not save final quiz score:", err.message);
    }

    const missed = results.filter((r) => !r.isCorrect);

    root.innerHTML = `
      <h2>Quiz complete — ${child.name}</h2>
      <div class="card score-hero">
        <div class="big">${score}/${words.length}</div>
        <p class="muted">correct</p>
      </div>
      ${
        missed.length
          ? `
        <div class="card">
          <h2>Words to review (${missed.length})</h2>
          <table class="results">
            <thead><tr><th>Word</th><th>You wrote</th><th>Meaning</th></tr></thead>
            <tbody>
              ${missed
                .map(
                  (r) => `
                <tr>
                  <td><strong>${r.word.word}</strong></td>
                  <td>${r.isTimeout ? "<em>time's up</em>" : escapeHtml(r.submitted)}</td>
                  <td>${r.word.meaning || ""}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
          : `<div class="card"><p>Perfect set — no missed words! 🎉</p></div>`
      }
      <div class="card stack">
        <button class="btn-primary" id="again">Do another quiz</button>
        <button class="btn-secondary" id="home">Back to home</button>
      </div>
    `;
    document.getElementById("again").onclick = () => renderQuiz(root, { child, allWords, onExit });
    document.getElementById("home").onclick = onExit;
  }

  renderQuestion();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
