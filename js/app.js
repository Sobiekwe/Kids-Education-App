import { CONFIG } from "./config.js";
import { fetchWords, getFlaggedWords, getRecentSessions } from "./db.js";
import { renderPractice } from "./practice.js";
import { renderQuiz } from "./quiz.js";
import { renderParentView } from "./parent.js";

const root = document.getElementById("app");

const state = {
  activeChildId: CONFIG.children[0].id,
  words: null,
  wordsError: null,
};

function activeChild() {
  return CONFIG.children.find((c) => c.id === state.activeChildId);
}

async function ensureWords() {
  if (state.words || state.wordsError) return;
  try {
    state.words = await fetchWords();
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

function childPicker() {
  return `
    <div class="child-picker">
      ${CONFIG.children
        .map(
          (c) => `
        <button data-child="${c.id}" class="${c.id === state.activeChildId ? "active" : ""}">${c.name}</button>
      `
        )
        .join("")}
    </div>
  `;
}

async function renderHome() {
  root.innerHTML = `<p class="muted">Loading words…</p>`;
  await ensureWords();

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

  let flagged = [];
  try {
    flagged = await getFlaggedWords(state.activeChildId);
  } catch (err) {
    console.warn("Could not load flagged words:", err.message);
  }

  root.innerHTML = `
    <h1>Spelling Practice</h1>
    <p class="muted">Two Bee Grade 4 word list</p>
    ${childPicker()}
    <div class="card stack">
      <button class="btn-primary" id="go-practice">Practice (${CONFIG.practiceSetSize} words, untimed)</button>
      <button class="btn-primary" id="go-quiz">Quiz (${CONFIG.quizSetSize} words, timed)</button>
      <button class="btn-secondary" id="go-review">
        Review missed words ${flagged.length ? `<span class="flag-pill">${flagged.length}</span>` : ""}
      </button>
    </div>
    <button class="btn-link" id="go-parent">Parent view</button>
  `;

  root.querySelectorAll("[data-child]").forEach((btn) => {
    btn.onclick = () => {
      state.activeChildId = btn.dataset.child;
      renderHome();
    };
  });

  document.getElementById("go-practice").onclick = () =>
    renderPractice(root, {
      child: activeChild(),
      allWords: state.words,
      mode: "practice",
      onExit: renderHome,
    });

  document.getElementById("go-quiz").onclick = () =>
    renderQuiz(root, {
      child: activeChild(),
      allWords: state.words,
      onExit: renderHome,
    });

  document.getElementById("go-review").onclick = async () => {
    if (!flagged.length) {
      // F11: if none flagged, offer ordinary Practice instead.
      renderPractice(root, {
        child: activeChild(),
        allWords: state.words,
        mode: "practice",
        onExit: renderHome,
        noticeIfEmpty: "No words are flagged for review right now — here's a regular practice set instead.",
      });
      return;
    }
    renderPractice(root, {
      child: activeChild(),
      allWords: flagged,
      mode: "review",
      onExit: renderHome,
    });
  };

  document.getElementById("go-parent").onclick = () =>
    renderParentView(root, { onExit: renderHome });
}

renderHome();
