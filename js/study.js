import { playWord, playSentence } from "./tts.js";

/**
 * Study mode: browse the full word list with spelling, meaning, sentence,
 * and audio, all visible at once. No typing, no grading, no timer — this is
 * the "learn it" step before Practice (recall-with-feedback) and Quiz
 * (timed test).
 */
export function renderStudy(root, { child, allWords, onExit }) {
  document.body.classList.add("kid-theme");
  root.innerHTML = `
    <div class="topbar">
      <button class="btn-back" id="exit">← Home</button>
      <div class="topbar-title"><h1>Study — ${child.name}</h1></div>
    </div>
    <p class="muted">Look, listen, and learn all ${allWords.length} words before practicing. No scoring here.</p>
    <div class="stack" id="word-list"></div>
  `;

  document.getElementById("exit").onclick = onExit;

  const list = document.getElementById("word-list");
  list.innerHTML = allWords
    .map(
      (w, i) => `
    <div class="card">
      <div class="row" style="align-items:center; justify-content:space-between;">
        <div>
          <strong style="font-size:1.15rem">${w.word}</strong>
          ${w.pos ? `<span class="muted"> (${w.pos})</span>` : ""}
        </div>
        <button class="icon-btn" data-play="${i}">🔊 Play</button>
      </div>
      ${w.meaning ? `<p style="margin-top:8px">${w.meaning}</p>` : ""}
      ${w.sentence ? `<p class="muted">"${w.sentence}"</p>` : ""}
    </div>
  `
    )
    .join("");

  list.querySelectorAll("button[data-play]").forEach((btn) => {
    btn.onclick = async () => {
      const w = allWords[btn.dataset.play];
      try {
        await playWord(w);
        await playSentence(w);
      } catch (err) {
        console.warn("Audio failed:", err.message);
      }
    };
  });
}
