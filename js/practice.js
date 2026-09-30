import { CONFIG } from "./config.js";
import { startSession, recordAttempt } from "./db.js";
import { speak, stopSpeaking } from "./tts.js";
import { isCorrectSpelling } from "./grading.js";
import { sampleUnique } from "./util.js";

/**
 * Practice mode (F04) and Review-missed-words mode (F11) share this screen:
 * untimed, speaks the word, typed spelling, unlimited retries, immediate
 * feedback with meaning + sentence, Next button.
 */
export async function renderPractice(root, { child, allWords, mode, onExit, noticeIfEmpty }) {
  const size = mode === "review" ? Math.min(CONFIG.reviewSetSize, allWords.length) : Math.min(CONFIG.practiceSetSize, allWords.length);
  const words = sampleUnique(allWords, size);

  let session;
  try {
    session = await startSession(child.id, mode, words.length);
  } catch (err) {
    root.innerHTML = `<div class="card"><p><strong>Couldn't start this set.</strong></p><p class="muted">${err.message}</p><button class="btn-primary" id="back">Back</button></div>`;
    document.getElementById("back").onclick = onExit;
    return;
  }

  let index = 0;
  let firstAttemptCorrectCount = 0;
  let attemptedFirstCount = 0;
  let currentAttemptCount = 0; // attempts on the CURRENT word

  function currentWord() {
    return words[index];
  }

  async function playWord() {
    const area = document.getElementById("audio-status");
    if (area) area.textContent = "🔊 Playing…";
    try {
      await speak(currentWord().word);
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
      await speak(w.sentence.replace(new RegExp(w.word, "gi"), "blank"));
    } catch {
      // Non-fatal for a bonus feature; ignore.
    }
  }

  function renderQuestion() {
    currentAttemptCount = 0;
    const noticeHtml = noticeIfEmpty && index === 0 ? `<p class="muted">${noticeIfEmpty}</p>` : "";
    root.innerHTML = `
      <h2>${mode === "review" ? "Review missed words" : "Practice"} — ${child.name}</h2>
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
      <button class="btn-link" id="exit">Exit to home</button>
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
    const input = document.getElementById("answer");
    const submitBtn = document.getElementById("submit-btn");
    const value = input.value;
    if (!value.trim()) return; // F07: an empty submit does not advance

    submitBtn.disabled = true; // prevent double submit (F08)
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
        <p><strong>${w.word}</strong>${w.pos ? ` <span class="muted">(${w.pos})</span>` : ""}</p>
        ${w.meaning ? `<p>${w.meaning}</p>` : ""}
        ${w.sentence ? `<p class="muted">"${w.sentence}"</p>` : ""}
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
