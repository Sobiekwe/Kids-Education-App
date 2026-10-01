import { CONFIG } from "./config.js";
import { fetchWords, fetchChildren, getFlaggedWords, getRecentSessions, findResumableSession, abandonSession } from "./db.js";
import { renderStudy } from "./study.js";
import { renderPractice } from "./practice.js";
import { renderQuiz } from "./quiz.js";
import { renderParentView } from "./parent.js";

const root = document.getElementById("app");

const state = {
  children: null,
  childrenError: null,
  activeChildId: null,
  wordsByGrade: {}, // cache: gradeLevel -> words[]
  wordsError: null,
};

function activeChild() {
  return state.children?.find((c) => c.id === state.activeChildId) || null;
}

async function ensureChildren() {
  if (state.children || state.childrenError) return;
  try {
    state.children = await fetchChildren();
    if (state.children.length && !state.activeChildId) {
      state.activeChildId = state.children[0].id;
    }
  } catch (err) {
    state.childrenError = err;
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

const CHILD_AVATARS = ["🦊", "🐼", "🦁", "🐸", "🐯", "🐨"];

function childPicker() {
  return `
    <div class="child-picker">
      ${state.children
        .map(
          (c, i) => `
        <button data-child="${c.id}" class="${c.id === state.activeChildId ? "active" : ""}">
          <span class="avatar">${CHILD_AVATARS[i % CHILD_AVATARS.length]}</span>
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

  let flagged = [];
  try {
    flagged = await getFlaggedWords(state.activeChildId);
  } catch (err) {
    console.warn("Could not load flagged words:", err.message);
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

  root.innerHTML = `
    <h1>Spelling Practice</h1>
    <p class="muted">Grade ${child.grade_level} word list${words.length ? ` (${words.length} words)` : ""}</p>
    ${childPicker()}
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
      !words.length
        ? `<div class="card"><p><strong>No words yet for Grade ${child.grade_level}.</strong></p><p class="muted">Add words for this grade in the database, then come back.</p></div>`
        : `
    <div class="card stack">
      <button class="btn-study" id="go-study">📖 Study (learn all ${words.length} words)</button>
      <button class="btn-primary" id="go-practice">✏️ ${resumable && resumable.mode === "practice" ? "Start a new Practice set" : "Practice"} (${Math.min(CONFIG.practiceSetSize, words.length)} words, untimed)</button>
      <button class="btn-quiz" id="go-quiz">⏱️ ${resumable && resumable.mode === "quiz" ? "Start a new Quiz" : "Quiz"} (${Math.min(CONFIG.quizSetSize, words.length)} words, timed)</button>
      <button class="btn-review" id="go-review">
        🚩 Review missed words ${flagged.length ? `<span class="flag-pill">${flagged.length}</span>` : ""}
      </button>
    </div>`
    }
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

  root.querySelectorAll("[data-child]").forEach((btn) => {
    btn.onclick = () => {
      state.activeChildId = btn.dataset.child;
      renderHome();
    };
  });

  if (words.length) {
    document.getElementById("go-study").onclick = () =>
      renderStudy(root, {
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

  document.getElementById("go-parent").onclick = () =>
    renderParentView(root, { onExit: renderHome });
}

renderHome();
