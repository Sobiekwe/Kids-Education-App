import { CONFIG } from "./config.js";
import {
  fetchPatterns,
  fetchWords,
  fetchLabWords,
  fetchLabSessions,
  fetchLabShownMap,
  fetchWeakWordIds,
  fetchWordStatusMap,
  touchLabShown,
} from "./db.js";
import { renderPractice } from "./practice.js";
import { splitReserved, buildSitting, pickCheckWords } from "./labselect.js";
import { sampleUnique } from "./util.js";
import { playWord, stopSpeaking } from "./tts.js";

/**
 * Pattern Lab (Stage 2). One lesson per spelling pattern:
 *   rule + anchor words -> "spot the pattern" -> a 15-word sitting
 *   (10 new pattern words + 5 review words from the original list) -> after
 *   enough sittings, a held-out pattern check that unlocks the next pattern.
 * Stage 1 (Study / Practice / Quiz / Review) is untouched; the Lab reads its
 * own word pool (words.stage = 2) and its own rotation clock
 * (word_progress.lab_last_shown_at). Progress is derived from completed
 * sessions rows (mode "lab" / "lab_check"), so there is nothing else to sync.
 */

export async function renderPatternLab(root, { child, onExit }) {
  document.body.classList.add("kid-theme");
  root.innerHTML = `<p class="muted">Loading…</p>`;

  let data;
  try {
    data = await loadLabData(child);
  } catch (err) {
    root.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="back">← Home</button>
        <div class="topbar-title"><h1>🧪 Pattern Lab</h1></div>
      </div>
      <div class="card"><p><strong>Couldn't open the Pattern Lab.</strong></p><p class="muted">${escapeHtml(err.message || String(err))}</p></div>`;
    document.getElementById("back").onclick = onExit;
    return;
  }

  const { patterns, labWords, labSessions } = data;
  const patternList = Object.values(patterns).sort((a, b) => a.sort_order - b.sort_order);
  const cards = [];
  let earlierPassed = true; // every earlier pattern that has words has been passed

  for (const p of patternList) {
    const words = labWords.filter((w) => w.pattern_primary === p.id);
    if (!words.length) {
      cards.push({ p, kind: "soon" });
      continue;
    }
    const st = patternState(p.id, labSessions);
    const unlocked = earlierPassed;
    cards.push({ p, kind: unlocked ? "open" : "locked", st, words });
    if (!st.passed) earlierPassed = false;
  }

  root.innerHTML = `
    <div class="topbar">
      <button class="btn-back" id="back">← Home</button>
      <div class="topbar-title"><h1>🧪 Pattern Lab</h1></div>
    </div>
    <p class="muted">Stage 2 — learn the spelling patterns, then spell new words that follow them. Each sitting is ${CONFIG.labNewWords + CONFIG.labReviewWords} words: ${CONFIG.labNewWords} new ones plus ${CONFIG.labReviewWords} from your first 50 so you never forget them.</p>
    ${cards.map((c, i) => cardHtml(c, i)).join("")}
  `;
  document.getElementById("back").onclick = onExit;

  cards.forEach((c, i) => {
    if (c.kind !== "open") return;
    const sit = document.getElementById(`sit-${i}`);
    if (sit) sit.onclick = () => startSitting(root, { child, onExit, data, pattern: c.p, words: c.words, st: c.st });
    const chk = document.getElementById(`check-${i}`);
    if (chk) chk.onclick = () => startCheck(root, { child, onExit, data, pattern: c.p, words: c.words, st: c.st });
  });
}

function cardHtml(c, i) {
  if (c.kind === "soon") {
    return `<div class="card" style="opacity:0.6"><p><strong>${escapeHtml(c.p.name)}</strong></p><p class="muted">Coming soon</p></div>`;
  }
  if (c.kind === "locked") {
    return `<div class="card" style="opacity:0.6"><p><strong>🔒 ${escapeHtml(c.p.name)}</strong></p><p class="muted">Pass the earlier pattern's check to unlock this one.</p></div>`;
  }
  const { st } = c;
  const need = CONFIG.labMinSittingsBeforeCheck;
  const checkReady = canTakeCheck(st);
  const status = st.passed
    ? `✅ Passed`
    : checkReady
    ? `Check ready`
    : st.checks > 0
    ? `Do another sitting, then retry the check`
    : `${Math.min(st.sittings, need)} of ${need} sittings before the check`;
  return `
    <div class="card" style="border:2px solid var(--primary)">
      <p><strong>${escapeHtml(c.p.name)}</strong> <span class="flag-pill">${status}</span></p>
      <p class="muted">${escapeHtml(c.p.tip)}</p>
      <p class="muted">${st.sittings} sitting${st.sittings === 1 ? "" : "s"} done${st.checks ? ` · ${st.checks} check${st.checks === 1 ? "" : "s"} taken` : ""}</p>
      <div class="stack">
        <button class="btn-study" id="sit-${i}">${st.passed ? "Keep practicing" : "Start a sitting"}</button>
        ${checkReady ? `<button class="btn-quiz" id="check-${i}">Take the pattern check (${CONFIG.labCheckSize} new words)</button>` : ""}
      </div>
    </div>`;
}

// ---- Progress (derived from completed sessions) ---------------------------

export function patternState(patternId, labSessions) {
  const mine = labSessions.filter((s) => s.pattern_id === patternId);
  const sittingsAll = mine.filter((s) => s.mode === "lab");
  const checks = mine.filter((s) => s.mode === "lab_check");
  const lastCheckAt = checks.length ? new Date(checks[checks.length - 1].completed_at) : null;
  return {
    sittings: sittingsAll.length,
    checks: checks.length,
    passed: checks.some((c) => (c.score || 0) >= CONFIG.labCheckPassScore),
    sittingsSinceLastCheck: lastCheckAt ? sittingsAll.filter((s) => new Date(s.completed_at) > lastCheckAt).length : sittingsAll.length,
  };
}

function canTakeCheck(st) {
  if (st.passed) return false;
  if (st.sittings < CONFIG.labMinSittingsBeforeCheck) return false;
  // After a miss, at least one fresh sitting before trying again.
  return st.checks === 0 || st.sittingsSinceLastCheck >= 1;
}

async function loadLabData(child) {
  const [patterns, labWords, stage1Words, labSessions, labShown, weakIds, statusMap] = await Promise.all([
    fetchPatterns(),
    fetchLabWords(child.grade_level),
    fetchWords(child.grade_level),
    fetchLabSessions(child.id),
    fetchLabShownMap(child.id),
    fetchWeakWordIds(child.id).catch(() => []),
    fetchWordStatusMap(child.id).catch(() => ({})),
  ]);
  return { patterns, labWords, stage1Words, labSessions, labShown, weakIds, statusMap };
}

// ---- A sitting -------------------------------------------------------------

function startSitting(root, ctx) {
  const { child, onExit, data, pattern, words, st } = ctx;
  const { pool } = splitReserved(words);
  const sitting = buildSitting({
    pool,
    stage1Words: data.stage1Words,
    labShown: data.labShown,
    weakIds: data.weakIds,
    sittingsDone: st.sittings,
    newCount: CONFIG.labNewWords,
    reviewCount: CONFIG.labReviewWords,
  });

  const back = () => renderPatternLab(root, { child, onExit });
  const anchors = pickAnchors(data, pattern.id);

  // 1) The rule, with words they already know.
  root.innerHTML = `
    <div class="topbar">
      <button class="btn-back" id="back">← Pattern Lab</button>
      <div class="topbar-title"><h2>${escapeHtml(pattern.name)}</h2></div>
    </div>
    <div class="card">
      <p><strong>The rule</strong></p>
      <p>${escapeHtml(pattern.tip)}</p>
      ${
        anchors.length
          ? `<p class="muted" style="margin-top:12px">You already know words like these:</p>
        <div class="stack">${anchors
          .map((w) => `<div class="pattern-chip"><strong>${escapeHtml(w.word)}</strong> — ${escapeHtml(w.meaning || "")}</div>`)
          .join("")}</div>`
          : ""
      }
      <div class="row" style="margin-top:16px"><button class="btn-primary" id="go">Spot the pattern</button></div>
    </div>`;
  document.getElementById("back").onclick = back;
  document.getElementById("go").onclick = () => {
    const spotWords = sampleUnique(sitting.fresh, Math.min(4, sitting.fresh.length));
    runSpot(root, { patterns: data.patterns, words: spotWords, pattern, back }, async () => {
      // 2) The 15-word spelling round.
      await touchLabShown(child.id, sitting.words.map((w) => w.id));
      renderPractice(root, {
        child,
        allWords: sitting.words,
        mode: "practice",
        onExit: back,
        lab: {
          words: sitting.words,
          sessionMode: "lab",
          patternId: pattern.id,
          title: `Pattern Lab — ${pattern.name}`,
          awardPoints: true,
          onFinish: ({ score, total }) => showSittingResult(root, { child, onExit, pattern, score, total }),
        },
      });
    });
  };
}

/** Up to 4 original-list words that follow this pattern, preferring ones the child already knows. */
function pickAnchors(data, patternId) {
  const tagged = data.stage1Words.filter((w) => w.pattern_primary === patternId);
  const known = tagged.filter((w) => data.statusMap[w.id] === "known");
  const rest = tagged.filter((w) => data.statusMap[w.id] !== "known");
  return [...sampleUnique(known, 4), ...sampleUnique(rest, 4)].slice(0, 4);
}

/** "Which pattern is this?" — a few quick questions, no points, always shows the tip afterward. */
function runSpot(root, { patterns, words, pattern, back }, done) {
  const others = Object.values(patterns).filter((p) => p.id !== pattern.id);
  let i = 0;

  function ask() {
    if (i >= words.length) return done();
    const w = words[i];
    const choices = sampleUnique([pattern, ...sampleUnique(others, 2)], 3);
    root.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="back">← Pattern Lab</button>
        <div class="topbar-title"><h2>Spot the pattern</h2></div>
      </div>
      <div class="card">
        <p class="muted">Question ${i + 1} of ${words.length}</p>
        <p style="font-size:1.8rem; margin:8px 0"><strong>${escapeHtml(w.word)}</strong></p>
        <div class="row" style="margin-bottom:12px"><button class="icon-btn" id="hear">🔊 Hear it</button></div>
        <p>Which pattern does this word follow?</p>
        <div class="stack" id="choices">
          ${choices.map((c) => `<button class="btn-secondary" data-id="${c.id}">${escapeHtml(c.name)}</button>`).join("")}
        </div>
        <div id="fb"></div>
      </div>`;
    document.getElementById("back").onclick = () => {
      stopSpeaking();
      back();
    };
    const hear = () => playWord(w).catch(() => {});
    document.getElementById("hear").onclick = hear;
    hear();
    root.querySelectorAll("#choices [data-id]").forEach((btn) => {
      btn.onclick = () => {
        const right = btn.dataset.id === pattern.id;
        root.querySelectorAll("#choices button").forEach((b) => (b.disabled = true));
        stopSpeaking();
        document.getElementById("fb").innerHTML = `
          <div class="feedback ${right ? "correct" : "incorrect"}" style="margin-top:12px">
            <div class="verdict">${right ? "✅ Yes!" : "❌ Not quite"}</div>
            <p><strong>${escapeHtml(w.word)}</strong> follows <strong>${escapeHtml(pattern.name)}</strong>.</p>
            <p class="muted">${escapeHtml(pattern.tip)}</p>
            <div class="row" style="margin-top:12px"><button class="btn-primary" id="next-q">${i + 1 < words.length ? "Next" : "Start spelling"}</button></div>
          </div>`;
        document.getElementById("next-q").onclick = () => {
          i += 1;
          ask();
        };
      };
    });
  }
  ask();
}

function showSittingResult(root, { child, onExit, pattern, score, total }) {
  root.innerHTML = `
    <h2>Sitting complete — ${escapeHtml(child.name)}</h2>
    <div class="card score-hero">
      <div class="big">${score}/${total}</div>
      <p class="muted">correct on the first try · ${escapeHtml(pattern.name)}</p>
    </div>
    <div class="card stack">
      <button class="btn-primary" id="lab">Back to the Pattern Lab</button>
      <button class="btn-secondary" id="home">Back to home</button>
    </div>`;
  document.getElementById("lab").onclick = () => renderPatternLab(root, { child, onExit });
  document.getElementById("home").onclick = onExit;
}

// ---- The held-out pattern check ---------------------------------------------

function startCheck(root, { child, onExit, data, pattern, words, st }) {
  const { reserved } = splitReserved(words);
  const checkWords = pickCheckWords(reserved, st.checks, CONFIG.labCheckSize);
  const back = () => renderPatternLab(root, { child, onExit });

  root.innerHTML = `
    <div class="topbar">
      <button class="btn-back" id="back">← Pattern Lab</button>
      <div class="topbar-title"><h2>Pattern check — ${escapeHtml(pattern.name)}</h2></div>
    </div>
    <div class="card">
      <p><strong>Ready?</strong></p>
      <p>${checkWords.length} brand-new words you haven't practiced. One try each, no retries. Get ${CONFIG.labCheckPassScore} right to pass this pattern.</p>
      <div class="row" style="margin-top:16px"><button class="btn-quiz" id="go">Start the check</button></div>
    </div>`;
  document.getElementById("back").onclick = back;
  document.getElementById("go").onclick = async () => {
    await touchLabShown(child.id, checkWords.map((w) => w.id));
    renderPractice(root, {
      child,
      allWords: checkWords,
      mode: "practice",
      onExit: back,
      lab: {
        words: checkWords,
        sessionMode: "lab_check",
        patternId: pattern.id,
        title: `Pattern check — ${pattern.name}`,
        noRetry: true,
        awardPoints: false,
        onFinish: ({ score, total }) => showCheckResult(root, { child, onExit, pattern, score, total }),
      },
    });
  };
}

function showCheckResult(root, { child, onExit, pattern, score, total }) {
  const passed = score >= CONFIG.labCheckPassScore;
  root.innerHTML = `
    <h2>${passed ? "🎉 Pattern passed!" : "Not yet — keep going"}</h2>
    <div class="card score-hero">
      <div class="big">${score}/${total}</div>
      <p class="muted">${escapeHtml(pattern.name)} · need ${CONFIG.labCheckPassScore} to pass</p>
    </div>
    <div class="card">
      <p>${
        passed
          ? "You showed you understand this pattern, even on words you hadn't practiced."
          : "Do another sitting with fresh words, then try the check again with a new set."
      }</p>
    </div>
    <div class="card stack">
      <button class="btn-primary" id="lab">Back to the Pattern Lab</button>
      <button class="btn-secondary" id="home">Back to home</button>
    </div>`;
  document.getElementById("lab").onclick = () => renderPatternLab(root, { child, onExit });
  document.getElementById("home").onclick = onExit;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
