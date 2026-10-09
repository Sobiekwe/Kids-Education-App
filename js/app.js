import { CONFIG } from "./config.js";
import {
  fetchWords,
  fetchChildren,
  getFlaggedWords,
  getRecentSessions,
  findResumableSession,
  abandonSession,
  fetchWordStatusMap,
  findActiveLearnGate,
  findLastCompletedLearnGate,
  fetchLastShownMap,
  startSession,
  completeSession,
  fetchAvatars,
  fetchLabInProgress,
} from "./db.js";
import { renderLearn } from "./learn.js";
import { renderPractice } from "./practice.js";
import { renderQuiz } from "./quiz.js";
import { renderParentView } from "./parent.js";
import { renderShop } from "./shop.js";
import { renderPatternLab, resumeLabSession } from "./patternlab.js";
import { pickCoverageSet } from "./util.js";

const root = document.getElementById("app");

const state = {
  children: null,
  childrenError: null,
  activeChildId: null,
  wordsByGrade: {}, // cache: gradeLevel -> words[]
  wordsError: null,
};

/** Same calendar day in the browser's local time zone — used by the Learn
 * gate's "one sitting per day" rule (don't start a second sitting today
 * just because more words remain; tomorrow's visit will). */
function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function activeChild() {
  return state.children?.find((c) => c.id === state.activeChildId) || null;
}

/**
 * Always re-fetches (no "only once" cache, unlike ensureWordsForGrade below)
 * -- children now carry points_balance and avatar_id, which change on
 * essentially every Learn/Practice/Quiz set, so a stale cache here would
 * leave Home showing yesterday's points balance after every session. A
 * fresh fetch of two small rows is cheap; falls back to whatever's already
 * cached (rather than surfacing an error screen) if this particular fetch fails.
 */
async function ensureChildren() {
  try {
    const fresh = await fetchChildren();
    state.children = fresh;
    state.childrenError = null;
    if (state.children.length && !state.activeChildId) {
      state.activeChildId = state.children[0].id;
    }
  } catch (err) {
    if (!state.children) state.childrenError = err;
  }
}

async function ensureWordsForGrade(gradeLevel) {
  if (state.wordsByGrade[gradeLevel] || state.wordsError) return;
  try {
    state.wordsByGrade[gradeLevel] = await fetchWords(gradeLevel);
  } catch (err) {
    state.wordsError = err;
  }
}

function childBanner() {
  return `
    <div class="child-banner">
      <div class="name">👋 ${activeChild().name}</div>
      <button class="btn-link" id="switch-child">Switch child</button>
    </div>
  `;
}

function childPicker(avatarMap) {
  return `
    <div class="child-picker">
      ${state.children
        .map(
          (c) => `
        <button data-child="${c.id}" class="${c.id === state.activeChildId ? "active" : ""}">
          <span class="avatar">${avatarMap[c.avatar_id]?.emoji || "🙂"}</span>
          ${c.name} <span class="muted">(Gr ${c.grade_level})</span>
        </button>
      `
        )
        .join("")}
    </div>
  `;
}

async function renderHome() {
  document.body.classList.remove("parent-theme", "has-sidebar");
  document.body.classList.add("kid-theme");
  root.innerHTML = `<p class="muted">Loading…</p>`;
  await ensureChildren();

  if (state.childrenError) {
    root.innerHTML = `
      <h1>Spelling Practice</h1>
      <div class="card">
        <p><strong>Couldn't load children.</strong></p>
        <p class="muted">${state.childrenError.message}</p>
        <button class="btn-primary" id="retry">Try again</button>
      </div>
    `;
    document.getElementById("retry").onclick = () => {
      state.childrenError = null;
      renderHome();
    };
    return;
  }

  if (!state.children.length) {
    root.innerHTML = `
      <h1>Spelling Practice</h1>
      <div class="card">
        <p><strong>No children set up yet.</strong></p>
        <p class="muted">Go to Parent view to add a child and assign a grade (1–6).</p>
        <button class="btn-primary" id="go-parent">Parent view</button>
      </div>
    `;
    document.getElementById("go-parent").onclick = () =>
      renderParentView(root, { onExit: renderHome });
    return;
  }

  const child = activeChild();
  await ensureWordsForGrade(child.grade_level);

  if (state.wordsError) {
    root.innerHTML = `
      <h1>Spelling Practice</h1>
      <div class="card">
        <p><strong>Couldn't load the word list.</strong></p>
        <p class="muted">${state.wordsError.message}</p>
        <button class="btn-primary" id="retry">Try again</button>
      </div>
    `;
    document.getElementById("retry").onclick = () => {
      state.wordsError = null;
      renderHome();
    };
    return;
  }

  const words = state.wordsByGrade[child.grade_level] || [];

  let avatars = [];
  try {
    avatars = await fetchAvatars();
  } catch (err) {
    console.warn("Could not load avatar catalog:", err.message);
  }
  const avatarMap = Object.fromEntries(avatars.map((a) => [a.id, a]));

  let flagged = [];
  try {
    flagged = await getFlaggedWords(state.activeChildId);
  } catch (err) {
    console.warn("Could not load flagged words:", err.message);
  }

  let statusMap = {};
  let knownCount = null;
  try {
    statusMap = await fetchWordStatusMap(state.activeChildId);
    knownCount = words.filter((w) => statusMap[w.id] === "known").length;
  } catch (err) {
    console.warn("Could not load word-status counts:", err.message);
  }

  // Learn-gate (F-new): a required "sitting" of up to CONFIG.learnBatchSize
  // not-yet-known words that must all reach "known" before Practice/Quiz
  // unlock. The batch is a `sessions` row (mode "learn_gate") so the same
  // words keep coming up across repeated Home visits until cleared, rather
  // than being re-picked (possibly differently) every time. Review stays
  // open regardless -- it's not gated.
  let gateDueWords = [];
  let gateLocked = false;
  if (words.length) {
    try {
      let gateSession = await findActiveLearnGate(state.activeChildId);
      if (gateSession) {
        const batchWords = gateSession.word_ids.map((id) => words.find((w) => w.id === id)).filter(Boolean);
        const stillDue = batchWords.filter((w) => (statusMap[w.id] || "new") !== "known");
        if (stillDue.length === 0) {
          // This sitting's words are all known now -- close it out.
          await completeSession(gateSession.id, batchWords.length, batchWords.length).catch(() => {});
          gateSession = null;
        } else {
          gateDueWords = stillDue;
          gateLocked = true;
        }
      }
      if (!gateSession) {
        const outstanding = words.filter((w) => (statusMap[w.id] || "new") !== "known");
        if (outstanding.length > 0) {
          // "One sitting per day": if a sitting was already completed today,
          // Practice/Quiz stay open for the rest of today even though more
          // words remain -- the next sitting starts tomorrow, not back-to-back.
          let completedToday = false;
          try {
            const lastCompleted = await findLastCompletedLearnGate(state.activeChildId);
            if (lastCompleted?.completed_at) {
              completedToday = isSameLocalDay(new Date(lastCompleted.completed_at), new Date());
            }
          } catch (err) {
            console.warn("Could not check for today's completed sitting:", err.message);
          }
          if (!completedToday) {
            let lastShownMap = {};
            try {
              lastShownMap = await fetchLastShownMap(state.activeChildId);
            } catch (err) {
              console.warn("Could not load last-shown data for the Learn gate:", err.message);
            }
            gateDueWords = pickCoverageSet(outstanding, lastShownMap, CONFIG.learnBatchSize);
            await startSession(state.activeChildId, "learn_gate", gateDueWords.length, gateDueWords.map((w) => w.id));
            gateLocked = true;
          }
        }
      }
    } catch (err) {
      // Best-effort: if the gate itself can't be computed, don't block the
      // kids from Practice/Quiz over it.
      console.warn("Could not compute the Learn gate (continuing unlocked):", err.message);
    }
  }

  let resumable = null;
  try {
    resumable = await findResumableSession(state.activeChildId);
  } catch (err) {
    console.warn("Could not check for a resumable session:", err.message);
  }
  // Words for a resumable session, in the exact stored order — skip the
  // banner if any are missing (e.g. a word was removed since).
  const resumeWords = resumable ? resumable.word_ids.map((id) => words.find((w) => w.id === id)) : null;
  if (resumable && resumeWords.some((w) => !w)) resumable = null;

  // An unfinished Pattern Lab sitting/check (newest one), offered on Home too.
  let labResume = null;
  try {
    const lab = await fetchLabInProgress(state.activeChildId);
    labResume = lab.find((x) => (x.current_index || 0) < x.word_ids.length) || null;
  } catch (err) {
    console.warn("Could not check for an unfinished Pattern Lab set:", err.message);
  }

  root.innerHTML = `
    <h1>Spelling Practice</h1>
    <p class="muted">Grade ${child.grade_level} word list${words.length ? ` (${words.length} words)` : ""}</p>
    ${childPicker(avatarMap)}
    <div class="points-badge">
      <span>⭐ <strong>${child.points_balance || 0}</strong> points</span>
      <button class="btn-link" id="go-shop">🛍️ Shop</button>
    </div>
    ${
      knownCount !== null && words.length
        ? `
    <div class="progress-bar-wrap">
      <div class="progress-bar-fill" style="width:${Math.round((knownCount / words.length) * 100)}%"></div>
    </div>
    <p class="muted" style="margin-top:4px">${knownCount} of ${words.length} words known</p>`
        : ""
    }
    ${
      resumable
        ? `
    <div class="card" style="border:2px solid var(--primary)">
      <p><strong>You have an unfinished ${resumable.mode === "quiz" ? "Quiz" : "Practice"} set</strong></p>
      <p class="muted">Word ${resumable.current_index + 1} of ${resumeWords.length}</p>
      <button class="btn-primary" id="go-resume">Continue where you left off</button>
    </div>`
        : ""
    }
    ${
      labResume
        ? `
    <div class="card" style="border:2px solid var(--primary)">
      <p><strong>You have an unfinished Pattern Lab ${labResume.mode === "lab_check" ? "check" : "sitting"}</strong></p>
      <p class="muted">Picks up at the next word you haven't answered.</p>
      <button class="btn-primary" id="go-lab-resume">Continue where you left off</button>
    </div>`
        : ""
    }
    ${
      !words.length
        ? `<div class="card"><p><strong>No words yet for Grade ${child.grade_level}.</strong></p><p class="muted">Add words for this grade in the database, then come back.</p></div>`
        : gateLocked
        ? `
    <div class="card" style="border:2px solid var(--study, var(--primary))">
      <p><strong>📚 Learn today's words first</strong></p>
      <p class="muted">${gateDueWords.length} word${gateDueWords.length === 1 ? "" : "s"} to learn — Practice and Quiz unlock once they're all known.</p>
      <button class="btn-study" id="go-gated-learn">Start today's words</button>
    </div>
    <div class="card stack">
      <button class="btn-review" id="go-review">
        🚩 Review missed words ${flagged.length ? `<span class="flag-pill">${flagged.length}</span>` : ""}
      </button>
    </div>`
        : `
    <div class="card stack">
      <button class="btn-study" id="go-learn">📖 Learn (meanings, patterns &amp; sentences)</button>
      <button class="btn-primary" id="go-practice">✏️ ${resumable && resumable.mode === "practice" ? "Start a new Practice set" : "Practice"} (${Math.min(CONFIG.practiceSetSize, words.length)} words, untimed)</button>
      <button class="btn-quiz" id="go-quiz">⏱️ ${resumable && resumable.mode === "quiz" ? "Start a new Quiz" : "Quiz"} (${Math.min(CONFIG.quizSetSize, words.length)} words, timed)</button>
      <button class="btn-review" id="go-review">
        🚩 Review missed words ${flagged.length ? `<span class="flag-pill">${flagged.length}</span>` : ""}
      </button>
    </div>`
    }
    <div class="card stack">
      <button class="btn-study" id="go-lab">🧪 Pattern Lab (Stage 2)</button>
      <p class="muted" style="margin:0">Learn the spelling patterns, then spell new words that follow them.</p>
    </div>
    <button class="btn-link" id="go-parent">Parent view</button>
  `;

  if (resumable) {
    document.getElementById("go-resume").onclick = () => {
      const renderFn = resumable.mode === "quiz" ? renderQuiz : renderPractice;
      renderFn(root, {
        child,
        allWords: words,
        mode: resumable.mode,
        onExit: renderHome,
        resume: { session: resumable, words: resumeWords },
      });
    };
  }

  if (labResume) {
    document.getElementById("go-lab-resume").onclick = () =>
      resumeLabSession(root, { child, onExit: renderHome, session: labResume });
  }

  root.querySelectorAll("[data-child]").forEach((btn) => {
    btn.onclick = () => {
      state.activeChildId = btn.dataset.child;
      renderHome();
    };
  });

  if (words.length && gateLocked) {
    document.getElementById("go-gated-learn").onclick = () =>
      renderLearn(root, {
        child,
        allWords: words,
        onExit: renderHome,
        filterWordIds: gateDueWords.map((w) => w.id),
        gated: true,
      });
  } else if (words.length) {
    document.getElementById("go-learn").onclick = () =>
      renderLearn(root, {
        child,
        allWords: words,
        onExit: renderHome,
      });

    document.getElementById("go-practice").onclick = async () => {
      if (resumable && resumable.mode === "practice") await abandonSession(resumable.id);
      renderPractice(root, {
        child,
        allWords: words,
        mode: "practice",
        onExit: renderHome,
      });
    };

    document.getElementById("go-quiz").onclick = async () => {
      if (resumable && resumable.mode === "quiz") await abandonSession(resumable.id);
      renderQuiz(root, {
        child,
        allWords: words,
        onExit: renderHome,
      });
    };
  }

  if (words.length) {
    document.getElementById("go-review").onclick = async () => {
      if (!flagged.length) {
        // F11: if none flagged, offer ordinary Practice instead.
        renderPractice(root, {
          child,
          allWords: words,
          mode: "practice",
          onExit: renderHome,
          noticeIfEmpty: "No words are flagged for review right now — here's a regular practice set instead.",
        });
        return;
      }
      renderPractice(root, {
        child,
        allWords: flagged,
        mode: "review",
        onExit: renderHome,
      });
    };
  }

  document.getElementById("go-shop").onclick = () =>
    renderShop(root, { child, onExit: renderHome });

  document.getElementById("go-lab").onclick = () =>
    renderPatternLab(root, { child, onExit: renderHome });

  document.getElementById("go-parent").onclick = () =>
    renderParentView(root, { onExit: renderHome });
}

renderHome();
