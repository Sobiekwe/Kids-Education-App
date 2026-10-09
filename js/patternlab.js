import { CONFIG } from "./config.js";
import {
  fetchPatterns,
  fetchWords,
  fetchLabWords,
  fetchLabSessions,
  fetchLabInProgress,
  abandonSession,
  fetchLabShownMap,
  fetchWeakWordIds,
  fetchWordStatusMap,
  touchLabShown,
} from "./db.js";
import { renderPractice } from "./practice.js";
import { splitReserved, buildSitting, pickCheckWords } from "./labselect.js";
import { sampleUnique, highlightHtml } from "./util.js";
import { playWord, stopSpeaking } from "./tts.js";
import { LAB_CONTENT } from "./labcontent.js";

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

/** One short line for the Home screen's Stage 2 panel, e.g. "Long vowels · 1 of 3 sittings". */
export async function labSummary(child) {
  try {
    const [patterns, sessions] = await Promise.all([fetchPatterns(), fetchLabSessions(child.id)]);
    const list = Object.values(patterns)
      .filter((p) => LAB_CONTENT[p.id])
      .sort((a, b) => a.sort_order - b.sort_order);
    if (!list.length) return "Learn spelling patterns";
    for (const p of list) {
      const st = patternState(p.id, sessions);
      if (st.passed) continue;
      const need = CONFIG.labMinSittingsBeforeCheck;
      const status = canTakeCheck(st)
        ? "check ready"
        : st.checks > 0
        ? "do a sitting, then retry the check"
        : `${Math.min(st.sittings, need)} of ${need} sittings`;
      return `${p.name} · ${status}`;
    }
    return "All current patterns passed ✅";
  } catch {
    return "Learn spelling patterns";
  }
}

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
    const resumeInfo = unlocked ? resumableFor(data, p.id) : null;
    cards.push({ p, kind: unlocked ? "open" : "locked", st, words, resumeInfo });
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
    const gd = document.getElementById(`guide-${i}`);
    if (gd) {
      const back = () => renderPatternLab(root, { child, onExit });
      gd.onclick = () =>
        showGuide(root, { child, data, pattern: c.p, content: LAB_CONTENT[c.p.id], back, finishLabel: "Back to the Pattern Lab" }, back);
    }
    const cont = document.getElementById(`cont-${i}`);
    if (cont) cont.onclick = () => resumeLabSession(root, { child, onExit, data, session: c.resumeInfo.session });
    const restart = document.getElementById(`restart-${i}`);
    if (restart)
      restart.onclick = async () => {
        restart.disabled = true;
        await abandonSession(c.resumeInfo.session.id);
        renderPatternLab(root, { child, onExit });
      };
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
        ${LAB_CONTENT[c.p.id] ? `<button class="btn-secondary" id="guide-${i}">📖 Pattern guide</button>` : ""}
        ${
          c.resumeInfo
            ? `<button class="btn-study" id="cont-${i}">▶ Continue your ${c.resumeInfo.session.mode === "lab_check" ? "check" : "sitting"}</button>
        <p class="muted" style="margin:0">Picks up at the next word you haven't answered (${c.resumeInfo.words.length} words in this ${c.resumeInfo.session.mode === "lab_check" ? "check" : "sitting"}).</p>
        <button class="btn-link" id="restart-${i}">Start over with new words</button>`
            : `<button class="btn-study" id="sit-${i}">${st.passed ? "Keep practicing" : "Start a sitting"}</button>
        ${checkReady ? `<button class="btn-quiz" id="check-${i}">Take the pattern check (${CONFIG.labCheckSize} new words)</button>` : ""}`
        }
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
  const [patterns, labWords, stage1Words, labSessions, labShown, weakIds, statusMap, inProgressAll] = await Promise.all([
    fetchPatterns(),
    fetchLabWords(child.grade_level),
    fetchWords(child.grade_level),
    fetchLabSessions(child.id),
    fetchLabShownMap(child.id),
    fetchWeakWordIds(child.id).catch(() => []),
    fetchWordStatusMap(child.id).catch(() => ({})),
    fetchLabInProgress(child.id).catch(() => []),
  ]);
  // One unfinished set per pattern: keep the newest, quietly retire older
  // leftovers so they can't reappear as "Continue" after the newest finishes.
  const inProgress = {};
  for (const sess of inProgressAll) {
    if (inProgress[sess.pattern_id]) abandonSession(sess.id);
    else inProgress[sess.pattern_id] = sess;
  }
  return { patterns, labWords, stage1Words, labSessions, labShown, weakIds, statusMap, inProgress };
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

  // The 15-word spelling round (after the lesson).
  const begin = async () => {
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
  };

  const content = LAB_CONTENT[pattern.id];
  if (!content) return begin();
  // Full lesson the first time this child (on this device) opens the pattern,
  // and on a first sitting; otherwise a one-minute recap with a link to the guide.
  if (st.sittings === 0 || !guideSeen(child.id, pattern.id)) showGuide(root, { child, data, pattern, content, back }, begin);
  else showRecap(root, { child, data, pattern, content, back }, begin);
}

const guideKey = (childId, patternId) => `lab_guide_seen:${childId}:${patternId}`;
function guideSeen(childId, patternId) {
  try {
    return localStorage.getItem(guideKey(childId, patternId)) === "1";
  } catch {
    return false;
  }
}
function markGuideSeen(childId, patternId) {
  try {
    localStorage.setItem(guideKey(childId, patternId), "1");
  } catch {
    /* storage unavailable: the guide just shows again next time */
  }
}

/** Plays a word: the stored audio if we have the word, else the browser voice. */
function hear(data, text) {
  const all = [...data.labWords, ...data.stage1Words];
  const w = all.find((x) => x.word === text) || { word: text };
  return playWord(w).catch(() => {});
}

function lessonShell(title, body, backLabel = "← Pattern Lab") {
  return `
    <div class="topbar">
      <button class="btn-back" id="back">${backLabel}</button>
      <div class="topbar-title"><h2>${escapeHtml(title)}</h2></div>
    </div>
    ${body}`;
}

/** 1) The Pattern Guide: the rule, then examples from the original 50 words. */
function showGuide(root, { child, data, pattern, content, back, finishLabel }, done) {
  if (child) markGuideSeen(child.id, pattern.id);
  const group = (g) =>
    content.examples
      .filter((e) => e.group === g)
      .map(
        (e) => `<div class="pattern-chip" style="display:block">
          <span class="lesson-word">${highlightHtml(e.hl)}</span>
          <button class="btn-link" data-hear="${escapeHtml(e.word)}">🔊 Hear it</button><br>
          <span>${escapeHtml(e.note)}</span></div>`
      )
      .join("");
  root.innerHTML = lessonShell(
    `${pattern.name}: the guide`,
    `<div class="card">
      <p><strong>The rule</strong></p>
      <p>${escapeHtml(content.rule)}</p>
      <p class="muted" style="margin-top:12px">With a silent e — from the words you already know:</p>
      <div class="stack">${group("silent")}</div>
      <p class="muted" style="margin-top:12px">Other ways to spell a long vowel:</p>
      <div class="stack">${group("other")}</div>
      <p class="muted" style="margin-top:12px"><span class="hl-v">Colored letters</span> say the long vowel. The <span class="hl-e">lighter letter</span> is the silent e.</p>
      <div class="row" style="margin-top:16px"><button class="btn-primary" id="go">Next: what is not a long vowel</button></div>
    </div>`
  );
  document.getElementById("back").onclick = () => {
    stopSpeaking();
    back();
  };
  root.querySelectorAll("[data-hear]").forEach((b) => (b.onclick = () => hear(data, b.dataset.hear)));
  document.getElementById("go").onclick = () => showContrast(root, { data, pattern, content, back, finishLabel }, done);
}

/** 2) Words that look similar but do not follow the pattern. */
function showContrast(root, { data, pattern, content, back, finishLabel }, done) {
  root.innerHTML = lessonShell(
    `${pattern.name}: not this pattern`,
    `<div class="card">
      <p><strong>These words do NOT have a long vowel</strong></p>
      <div class="stack">${content.contrast
        .map(
          (c) => `<div class="pattern-chip" style="display:block"><strong class="lesson-word">${escapeHtml(c.word)}</strong>
          <button class="btn-link" data-hear="${escapeHtml(c.word)}">🔊 Hear it</button><br>${escapeHtml(c.why)}</div>`
        )
        .join("")}</div>
      <div class="row" style="margin-top:16px"><button class="btn-primary" id="go">Try some yes/no questions</button></div>
    </div>`
  );
  document.getElementById("back").onclick = () => {
    stopSpeaking();
    back();
  };
  root.querySelectorAll("[data-hear]").forEach((b) => (b.onclick = () => hear(data, b.dataset.hear)));
  document.getElementById("go").onclick = () =>
    runYesNo(root, { data, pattern, content, back, finishLabel, count: content.fullQuestions }, done);
}

/** Recap for later sittings: a few lines and a few quick questions. */
function showRecap(root, { child, data, pattern, content, back }, done) {
  root.innerHTML = lessonShell(
    `${pattern.name}: quick recap`,
    `<div class="card">
      <p>${highlightHtmlText(content.recap)}</p>
      <div class="row" style="margin-top:16px"><button class="btn-primary" id="go">Start the quick questions</button></div>
      <div class="row" style="margin-top:8px"><button class="btn-link" id="full">📖 See the full guide</button></div>
    </div>`
  );
  document.getElementById("back").onclick = back;
  document.getElementById("full").onclick = () => showGuide(root, { child, data, pattern, content, back }, done);
  document.getElementById("go").onclick = () =>
    runYesNo(root, { data, pattern, content, back, count: content.recapQuestions }, done);
}

/** Highlights bracketed examples inside a sentence, escaping everything else. */
function highlightHtmlText(text) {
  return text
    .split(/(\w*[\[{][^\s,.]*)/)
    .map((part) => (/[\[{]/.test(part) ? highlightHtml(part) : escapeHtml(part)))
    .join("");
}

/** 3) Yes/no questions drawn from the bank: half "yes", half "no". Not scored, no points. */
function runYesNo(root, { data, pattern, content, back, count, finishLabel }, done) {
  const yes = content.questions.filter((q) => q.yes);
  const no = content.questions.filter((q) => !q.yes);
  const nYes = Math.ceil(count / 2);
  const questions = sampleUnique(
    [...sampleUnique(yes, nYes), ...sampleUnique(no, count - nYes)],
    count
  );
  let i = 0;

  function ask() {
    if (i >= questions.length) return done();
    const q = questions[i];
    root.innerHTML = lessonShell(
      `${pattern.name}: yes or no?`,
      `<div class="card">
        <p class="muted">Question ${i + 1} of ${questions.length}</p>
        <p style="font-size:1.8rem; margin:8px 0"><strong>${escapeHtml(q.word)}</strong></p>
        <div class="row" style="margin-bottom:12px"><button class="icon-btn" id="hear">🔊 Hear it</button></div>
        <p>Does this word have a long vowel, like the ones in the guide?</p>
        <div class="row" id="choices">
          <button class="btn-secondary" data-answer="yes">Yes</button>
          <button class="btn-secondary" data-answer="no">No</button>
        </div>
        <div id="fb"></div>
      </div>`
    );
    document.getElementById("back").onclick = () => {
      stopSpeaking();
      back();
    };
    const say = () => hear(data, q.word);
    document.getElementById("hear").onclick = say;
    say();
    root.querySelectorAll("#choices [data-answer]").forEach((btn) => {
      btn.onclick = () => {
        const saidYes = btn.dataset.answer === "yes";
        const right = saidYes === q.yes;
        root.querySelectorAll("#choices button").forEach((b) => (b.disabled = true));
        stopSpeaking();
        document.getElementById("fb").innerHTML = `
          <div class="feedback ${right ? "correct" : "incorrect"}" style="margin-top:12px">
            <div class="verdict">${right ? "✅ Yes, you got it!" : "❌ Not quite"}</div>
            <p class="lesson-word"><strong>${q.yes ? highlightHtml(q.hl) : escapeHtml(q.word)}</strong></p>
            <p>${q.yes ? "Yes, it has a long vowel." : "No, it does not have a long vowel."} ${escapeHtml(q.feedback)}</p>
            <div class="row" style="margin-top:12px"><button class="btn-primary" id="next-q">${i + 1 < questions.length ? "Next" : finishLabel || "Start spelling"}</button></div>
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

// ---- Resuming an unfinished sitting or check -------------------------------

/** The unfinished set for a pattern, with its word objects in stored order, or
 * null if there is none (or a word has since been removed). */
function resumableFor(data, patternId) {
  const session = data.inProgress?.[patternId];
  if (!session) return null;
  const byId = new Map([...data.labWords, ...data.stage1Words].map((w) => [w.id, w]));
  const words = session.word_ids.map((id) => byId.get(id));
  if (words.some((w) => !w)) return null;
  if ((session.current_index || 0) >= words.length) return null;
  return { session, words, next: (session.current_index || 0) + 1 };
}

/** Continue an unfinished Lab sitting or check exactly where it stopped. */
export async function resumeLabSession(root, { child, onExit, data, session }) {
  if (!data) {
    try {
      data = await loadLabData(child);
    } catch (err) {
      return renderPatternLab(root, { child, onExit });
    }
  }
  const pattern = data.patterns[session.pattern_id];
  const info = pattern && resumableFor(data, session.pattern_id);
  if (!info || info.session.id !== session.id) return renderPatternLab(root, { child, onExit });
  const back = () => renderPatternLab(root, { child, onExit });
  const isCheck = session.mode === "lab_check";
  renderPractice(root, {
    child,
    allWords: info.words,
    mode: "practice",
    onExit: back,
    resume: { session: info.session, words: info.words },
    lab: {
      words: info.words,
      sessionMode: session.mode,
      patternId: pattern.id,
      title: isCheck ? `Pattern check — ${pattern.name}` : `Pattern Lab — ${pattern.name}`,
      noRetry: isCheck,
      awardPoints: !isCheck,
      onFinish: ({ score, total }) =>
        (isCheck ? showCheckResult : showSittingResult)(root, { child, onExit, pattern, score, total }),
    },
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
