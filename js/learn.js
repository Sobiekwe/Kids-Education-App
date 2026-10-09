import { fetchPatterns, fetchWordStatusMap, setWordStatus, awardPoints } from "./db.js";
import { playWord, playSentence, stopSpeaking } from "./tts.js";
import { sampleUnique, pronHtml } from "./util.js";

// Points for a word that goes from not-known to known: self-marked "I know
// it" AND surviving both mini-quizzes. Only paid out on that transition (see
// cardWasKnownBefore below) so revisiting already-known words in free-roam
// Learn's "All words" view can't be farmed for repeat points.
const LEARN_CLEAR_POINTS = 3;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Blanks the word's own form in its sentence, case-insensitively, whole
 * word only. Returns null if the word doesn't appear verbatim (e.g. a
 * sentence using a different inflected form) -- never invents one.
 * Exported so Parent view can flag words whose sentence can't be blanked. */
export function blankSentence(word) {
  if (!word.sentence) return null;
  const re = new RegExp(`\\b${escapeRegExp(word.word)}\\b`, "i");
  if (!re.test(word.sentence)) return null;
  return word.sentence.replace(re, "_____");
}

/** How many other words' meanings are usable as wrong options for this
 * word's meaning-check (same part of speech, falling back to any word).
 * Exported so Parent view can flag words with too few (< 3) to quiz well. */
export function countMeaningDistractors(word, allWords) {
  if (!word.meaning) return 0;
  const pool = allWords.filter((o) => o.id !== word.id && o.meaning && o.meaning !== word.meaning);
  const sameP = pool.filter((o) => o.part_of_speech && o.part_of_speech === word.part_of_speech);
  return (sameP.length >= 3 ? sameP : pool).length;
}

/** Same idea for the use-it-in-a-sentence check's word-choice options. */
export function countWordDistractors(word, allWords) {
  const pool = allWords.filter((o) => o.id !== word.id && o.word.toLowerCase() !== word.word.toLowerCase());
  const sameP = pool.filter((o) => o.part_of_speech && o.part_of_speech === word.part_of_speech);
  return (sameP.length >= 3 ? sameP : pool).length;
}

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
 *
 * `gated: true` turns this into a required "sitting" (the Learn-gate
 * feature): `filterWordIds` is required, the All/Unmastered toggle and the
 * mini-quiz Skip buttons are hidden, and a word that isn't both marked
 * "I know it" AND answered correctly on both mini-quizzes is requeued
 * (a few cards later, not immediately) instead of being left behind — so
 * the sitting only ends once every word in it is genuinely known. The
 * caller (app.js) decides when a sitting is required and which words are in
 * it; this just runs it.
 */
export async function renderLearn(root, { child, allWords, onExit, filterWordIds, gated = false }) {
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
  let queue = []; // gated mode only: mutable work queue, re-entrant on a miss
  let index = 0;
  let knownThisSession = 0;
  let learningThisSession = 0;
  let selfAssessedKnown = false; // gated mode only: did they tap "I know it" for the current card
  let cardWasKnownBefore = false; // was this word already "known" when the card was shown (points-farming guard)

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
    if (gated) queue = [...cards];
  }
  computeCards();

  /** Gated mode only: removes the current word from the front of the queue
   * and, unless it was fully cleared this round, reinserts it a few cards
   * later so it comes back around instead of being left for last. */
  function advanceGated(word, cleared) {
    queue.shift();
    if (!cleared) {
      const pos = Math.min(3, queue.length);
      queue.splice(pos, 0, word);
    }
    renderCard();
  }

  /** Called once both mini-quizzes for a card have run (or been skipped
   * structurally, e.g. no sentence to blank). In gated mode, decides whether
   * the word is done (self-assessed "I know it" AND status is still
   * "known" -- i.e. it survived both checks without being demoted) or needs
   * another lap; otherwise just advances the free-roam list. */
  function proceedAfterChecks(w) {
    const cleared = selfAssessedKnown && statusMap[w.id] === "known";
    if (cleared && !cardWasKnownBefore) {
      awardPoints(child.id, LEARN_CLEAR_POINTS).catch(() => {});
    }
    if (gated) {
      advanceGated(w, cleared);
    } else {
      nextCard();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
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
    if (fixedList || gated) return "";
    return `
      <div class="filter-toggle">
        <button class="${filterMode === "unmastered" ? "active" : ""}" data-filter="unmastered">Still learning</button>
        <button class="${filterMode === "all" ? "active" : ""}" data-filter="all">All ${allWords.length} words</button>
      </div>
    `;
  }

  /** "Word 2 of 5" for free-roam Learn; "4 words left today" for a gated
   * sitting, since the queue reorders and reinserts words as it goes. */
  function progressLabel() {
    if (gated) return `${queue.length} word${queue.length === 1 ? "" : "s"} left today`;
    return `Word ${index + 1} of ${cards.length}`;
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
    if (gated) {
      if (!queue.length) {
        renderGatedComplete();
        return;
      }
    } else {
      if (!cards.length) {
        renderAllCaughtUp();
        return;
      }
      if (index >= cards.length) {
        renderComplete();
        return;
      }
    }
    const w = gated ? queue[0] : cards[index];
    cardWasKnownBefore = statusOf(w) === "known";
    root.innerHTML = `
      ${topbarHtml(gated ? "Today's words" : "Learn")}
      ${filterToggleHtml()}
      <div class="card">
        <p class="muted">${progressLabel()}</p>
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
      ${topbarHtml(gated ? "Today's words" : "Learn")}
      ${filterToggleHtml()}
      <div class="card">
        <p class="muted">${progressLabel()}</p>
        <div style="text-align:center; margin:12px 0">
          <div style="font-size:1.8rem; font-weight:800">${w.word}</div>
          ${w.part_of_speech ? `<span class="muted">(${w.part_of_speech})</span>` : ""}${pronHtml(w)}
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
    selfAssessedKnown = status === "known";
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
    document.getElementById("mcq-skip")?.addEventListener("click", onContinue);
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
      ${topbarHtml(gated ? "Today's words" : "Learn")}
      <div class="card">
        <p><strong>What does "${w.word}" mean?</strong></p>
        <div class="stack" style="margin-top:12px">
          ${options.map((o) => `<button class="btn-secondary mcq-option" data-opt="${o.id}">${escapeHtml(o.text)}</button>`).join("")}
        </div>
        <div class="row" style="margin-top:14px">
          ${gated ? "" : `<button class="btn-link" id="mcq-skip">Skip</button>`}
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
      proceedAfterChecks(w);
      return;
    }
    const distractors = pickWordDistractors(w);
    if (!distractors.length) {
      proceedAfterChecks(w);
      return;
    }
    const options = shuffle([{ id: "correct", text: w.word }, ...distractors.map((d, i) => ({ id: `d${i}`, text: d.word }))]);
    root.innerHTML = `
      ${topbarHtml(gated ? "Today's words" : "Learn")}
      <div class="card">
        <p><strong>Which word fits?</strong></p>
        <p class="muted">"${escapeHtml(blanked)}"</p>
        <div class="stack" style="margin-top:12px">
          ${options.map((o) => `<button class="btn-secondary mcq-option" data-opt="${o.id}">${escapeHtml(o.text)}</button>`).join("")}
        </div>
        <div id="full-sentence" class="muted" style="margin-top:10px"></div>
        <div class="row" style="margin-top:14px">
          ${gated ? "" : `<button class="btn-link" id="mcq-skip">Skip</button>`}
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
      () => proceedAfterChecks(w)
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

  /** Gated mode only: shown once every word in the sitting has been both
   * self-marked "I know it" and answered correctly on both mini-quizzes. */
  function renderGatedComplete() {
    root.innerHTML = `
      <h2>Awesome work, ${child.name}! 🎉</h2>
      <div class="card score-hero">
        <div class="big">✅</div>
        <p class="muted">Today's words are done — Practice and Quiz are unlocked!</p>
      </div>
      <div class="card stack">
        <button class="btn-primary" id="home">Back to home</button>
      </div>
    `;
    document.getElementById("home").onclick = onExit;
  }

  renderCard();
}
