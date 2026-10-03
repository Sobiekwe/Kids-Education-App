import { fetchPatterns, fetchWordStatusMap, setWordStatus } from "./db.js";
import { playWord, playSentence, stopSpeaking } from "./tts.js";
import { sampleUnique } from "./util.js";

/**
 * Learn mode (Phase 3): untimed, low-pressure word cards, replacing the old
 * "Study" screen. For each word: hear it, tap to reveal meaning + sentence +
 * pattern chip, then mark "I know it" or "Still learning" (sets the word's
 * per-kid status). That's followed by two quick, skippable checks (meaning
 * multiple-choice, then a fill-in-the-blank using the word's own sentence)
 * before moving to the next card.
 *
 * `filterWordIds`, when passed, locks the session to exactly those words
 * (e.g. "Study them first" from the Quiz nudge, or "Study my missed words"
 * from the Quiz review) and hides the All/Unmastered toggle.
 */
export async function renderLearn(root, { child, allWords, onExit, filterWordIds }) {
  document.body.classList.add("kid-theme");

  let patterns = {};
  let statusMap = {};
  try {
    [patterns, statusMap] = await Promise.all([fetchPatterns(), fetchWordStatusMap(child.id)]);
  } catch (err) {
    console.warn("Could not load Learn mode data (continuing anyway):", err.message);
  }

  const fixedList = Array.isArray(filterWordIds);
  let filterMode = fixedList ? "fixed" : "unmastered"; // 'all' | 'unmastered' | 'fixed'
  let cards = [];
  let index = 0;
  let knownThisSession = 0;
  let learningThisSession = 0;

  function statusOf(w) {
    return statusMap[w.id] || "new";
  }

  function computeCards() {
    if (fixedList) {
      cards = allWords.filter((w) => filterWordIds.includes(w.id));
    } else if (filterMode === "unmastered") {
      cards = allWords.filter((w) => statusOf(w) !== "known");
    } else {
      cards = allWords;
    }
    index = 0;
  }
  computeCards();

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** Blanks the word's own form in its sentence, case-insensitively, whole
   * word only. Returns null if the word doesn't appear verbatim (e.g. a
   * sentence using a different inflected form) -- never invents one. */
  function blankSentence(w) {
    if (!w.sentence) return null;
    const re = new RegExp(`\\b${escapeRegExp(w.word)}\\b`, "i");
    if (!re.test(w.sentence)) return null;
    return w.sentence.replace(re, "_____");
  }

  function topbarHtml(title) {
    return `
      <div class="topbar">
        <button class="btn-back" id="exit">← Home</button>
        <div class="topbar-title"><h2>${title} — ${child.name}</h2></div>
      </div>
    `;
  }

  function filterToggleHtml() {
    if (fixedList) return "";
    return `
      <div class="filter-toggle">
        <button class="${filterMode === "unmastered" ? "active" : ""}" data-filter="unmastered">Still learning</button>
        <button class="${filterMode === "all" ? "active" : ""}" data-filter="all">All ${allWords.length} words</button>
      </div>
    `;
  }

  function wireTopbar() {
    document.getElementById("exit").onclick = () => {
      stopSpeaking();
      onExit();
    };
    root.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.onclick = () => {
        filterMode = btn.dataset.filter;
        computeCards();
        renderCard();
      };
    });
  }

  function renderCard() {
    stopSpeaking();
    if (!cards.length) {
      renderAllCaughtUp();
      return;
    }
    if (index >= cards.length) {
      renderComplete();
      return;
    }
    const w = cards[index];
    root.innerHTML = `
      ${topbarHtml("Learn")}
      ${filterToggleHtml()}
      <div class="card">
        <p class="muted">Word ${index + 1} of ${cards.length}</p>
        <div style="text-align:center; margin:20px 0">
          <div style="font-size:1.8rem; font-weight:800">${w.word}</div>
        </div>
        <div class="row">
          <button class="icon-btn" id="repeat">🔁 Repeat</button>
          <button class="btn-primary" id="show-meaning">👀 Show meaning</button>
        </div>
      </div>
    `;
    wireTopbar();
    document.getElementById("repeat").onclick = () => playWord(w).catch(() => {});
    document.getElementById("show-meaning").onclick = () => renderRevealed(w);
    playWord(w).catch(() => {});
  }

  function patternChipHtml(w) {
    const p = w.pattern_primary && patterns[w.pattern_primary];
    if (!p) return "";
    return `<div class="pattern-chip"><strong>${p.name}</strong> — ${p.tip}</div>`;
  }

  function renderRevealed(w) {
    root.innerHTML = `
      ${topbarHtml("Learn")}
      ${filterToggleHtml()}
      <div class="card">
        <p class="muted">Word ${index + 1} of ${cards.length}</p>
        <div style="text-align:center; margin:12px 0">
          <div style="font-size:1.8rem; font-weight:800">${w.word}</div>
          ${w.part_of_speech ? `<span class="muted">(${w.part_of_speech})</span>` : ""}
        </div>
        <div class="row" style="margin-bottom:12px">
          <button class="icon-btn" id="repeat">🔁 Repeat word</button>
          ${w.sentence ? `<button class="icon-btn" id="hear-sentence">💬 Hear sentence</button>` : ""}
        </div>
        ${w.meaning ? `<p>${w.meaning}</p>` : ""}
        ${w.sentence ? `<p class="muted">"${w.sentence}"</p>` : ""}
        ${patternChipHtml(w)}
        <div class="row" style="margin-top:16px">
          <button class="btn-secondary" id="still-learning">🌱 Still learning</button>
          <button class="btn-primary" id="know-it">✅ I know it</button>
        </div>
      </div>
    `;
    wireTopbar();
    document.getElementById("repeat").onclick = () => playWord(w).catch(() => {});
    document.getElementById("hear-sentence")?.addEventListener("click", () => playSentence(w).catch(() => {}));
    document.getElementById("still-learning").onclick = () => markStatus(w, "learning");
    document.getElementById("know-it").onclick = () => markStatus(w, "known");
  }

  async function markStatus(w, status) {
    if (status === "known") knownThisSession += 1;
    else learningThisSession += 1;
    statusMap[w.id] = status;
    try {
      await setWordStatus(child.id, w.id, status);
    } catch (err) {
      console.warn("Could not save word status (continuing anyway):", err.message);
    }
    renderMeaningCheck(w);
  }

  function pickMeaningDistractors(w) {
    const pool = allWords.filter((o) => o.id !== w.id && o.meaning && o.meaning !== w.meaning);
    const sameP = pool.filter((o) => o.part_of_speech && o.part_of_speech === w.part_of_speech);
    const source = sameP.length >= 3 ? sameP : pool;
    return sampleUnique(source, 3);
  }

  function pickWordDistractors(w) {
    const pool = allWords.filter((o) => o.id !== w.id && o.word.toLowerCase() !== w.word.toLowerCase());
    const sameP = pool.filter((o) => o.part_of_speech && o.part_of_speech === w.part_of_speech);
    const source = sameP.length >= 3 ? sameP : pool;
    return sampleUnique(source, 3);
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** Shared renderer for both mini-quizzes' answer buttons: shows immediate
   * right/wrong styling, disables the rest, and reveals a Continue button. */
  function wireOptionButtons(w, options, correctId, onAnswered, continueLabel, onContinue) {
    let answered = false;
    root.querySelectorAll("[data-opt]").forEach((btn) => {
      btn.onclick = () => {
        if (answered) return;
        answered = true;
        const picked = btn.dataset.opt;
        const isCorrect = picked === correctId;
        root.querySelectorAll("[data-opt]").forEach((b) => {
          b.disabled = true;
          if (b.dataset.opt === correctId) b.classList.add("correct");
          else if (b.dataset.opt === picked) b.classList.add("incorrect");
        });
        onAnswered(isCorrect);
        const cont = document.getElementById("mcq-continue");
        cont.style.display = "";
        cont.textContent = continueLabel;
        cont.onclick = onContinue;
      };
    });
    document.getElementById("mcq-skip").onclick = onContinue;
  }

  function renderMeaningCheck(w) {
    if (!w.meaning) {
      renderUseItCheck(w);
      return;
    }
    const distractors = pickMeaningDistractors(w);
    if (!distractors.length) {
      renderUseItCheck(w);
      return;
    }
    const options = shuffle([{ id: "correct", text: w.meaning }, ...distractors.map((d, i) => ({ id: `d${i}`, text: d.meaning }))]);
    root.innerHTML = `
      ${topbarHtml("Learn")}
      <div class="card">
        <p><strong>What does "${w.word}" mean?</strong></p>
        <div class="stack" style="margin-top:12px">
          ${options.map((o) => `<button class="btn-secondary mcq-option" data-opt="${o.id}">${escapeHtml(o.text)}</button>`).join("")}
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn-link" id="mcq-skip">Skip</button>
          <button class="btn-primary" id="mcq-continue" style="display:none">Continue</button>
        </div>
      </div>
    `;
    document.getElementById("exit") && (document.getElementById("exit").onclick = () => { stopSpeaking(); onExit(); });
    wireOptionButtons(
      w,
      options,
      "correct",
      (isCorrect) => {
        if (!isCorrect) {
          statusMap[w.id] = "learning";
          setWordStatus(child.id, w.id, "learning").catch(() => {});
        }
      },
      "Continue",
      () => renderUseItCheck(w)
    );
  }

  function renderUseItCheck(w) {
    const blanked = blankSentence(w);
    if (!blanked) {
      nextCard();
      return;
    }
    const distractors = pickWordDistractors(w);
    if (!distractors.length) {
      nextCard();
      return;
    }
    const options = shuffle([{ id: "correct", text: w.word }, ...distractors.map((d, i) => ({ id: `d${i}`, text: d.word }))]);
    root.innerHTML = `
      ${topbarHtml("Learn")}
      <div class="card">
        <p><strong>Which word fits?</strong></p>
        <p class="muted">"${escapeHtml(blanked)}"</p>
        <div class="stack" style="margin-top:12px">
          ${options.map((o) => `<button class="btn-secondary mcq-option" data-opt="${o.id}">${escapeHtml(o.text)}</button>`).join("")}
        </div>
        <div id="full-sentence" class="muted" style="margin-top:10px"></div>
        <div class="row" style="margin-top:14px">
          <button class="btn-link" id="mcq-skip">Skip</button>
          <button class="btn-primary" id="mcq-continue" style="display:none">Next word</button>
        </div>
      </div>
    `;
    document.getElementById("exit") && (document.getElementById("exit").onclick = () => { stopSpeaking(); onExit(); });
    wireOptionButtons(
      w,
      options,
      "correct",
      (isCorrect) => {
        document.getElementById("full-sentence").textContent = `"${w.sentence}"`;
        if (!isCorrect) {
          statusMap[w.id] = "learning";
          setWordStatus(child.id, w.id, "learning").catch(() => {});
        }
      },
      "Next word",
      () => nextCard()
    );
  }

  function nextCard() {
    index += 1;
    renderCard();
  }

  function renderAllCaughtUp() {
    root.innerHTML = `
      ${topbarHtml("Learn")}
      ${filterToggleHtml()}
      <div class="card">
        <p><strong>Nothing left to study here — nice work! 🎉</strong></p>
        <p class="muted">Every word in this set is already marked Known.</p>
        <div class="row" style="margin-top:12px">
          ${!fixedList ? `<button class="btn-primary" id="see-all">See all ${allWords.length} words</button>` : ""}
          <button class="btn-secondary" id="home">Back to home</button>
        </div>
      </div>
    `;
    wireTopbar();
    document.getElementById("see-all")?.addEventListener("click", () => {
      filterMode = "all";
      computeCards();
      renderCard();
    });
    document.getElementById("home").onclick = onExit;
  }

  function renderComplete() {
    root.innerHTML = `
      <h2>Great studying, ${child.name}!</h2>
      <div class="card score-hero">
        <div class="big">${knownThisSession}</div>
        <p class="muted">marked "I know it" this session</p>
      </div>
      <div class="card stack">
        <button class="btn-primary" id="again">Study again</button>
        <button class="btn-secondary" id="home">Back to home</button>
      </div>
    `;
    document.getElementById("again").onclick = () => {
      computeCards();
      renderCard();
    };
    document.getElementById("home").onclick = onExit;
  }

  renderCard();
}
