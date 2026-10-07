import { CONFIG } from "./config.js";
import {
  getRecentSessions,
  getFlaggedWords,
  fetchChildren,
  createChild,
  updateChild,
  setChildActive,
  fetchWordsForManagement,
  addWords,
  setWordActive,
  generateAndStoreWordAudio,
  fetchPatterns,
  updateWordTags,
  fetchWordStatusMap,
  getTimeStats,
  getAvgResponseMs,
} from "./db.js";
import { parseCsv, csvRowsToWords } from "./util.js";
import { blankSentence, countMeaningDistractors, countWordDistractors } from "./learn.js";

const PIN_SESSION_KEY = "parentUnlocked";
let selectedWordGrade = 4;
let activeSection = "children"; // "children" | "words" | "patterns" | "reports" — which sidebar panel is showing

const SECTIONS = [
  { id: "children", label: "👪 Children" },
  { id: "words", label: "📝 Word Lists" },
  { id: "patterns", label: "🧩 Patterns" },
  { id: "reports", label: "📊 Reports" },
];

/**
 * Parent view: gated by a shared PIN (soft deterrent, not real security —
 * there's no login system in this app). Lets the parent create/edit/
 * deactivate child accounts and assign each one a grade (1-6), manage each
 * grade's word list, and see read-only recent scores and flagged words.
 * Laid out as a sidebar + content panel so it isn't one long scrolling page.
 */
export async function renderParentView(root, { onExit }) {
  document.body.classList.add("parent-theme");
  if (sessionStorage.getItem(PIN_SESSION_KEY) === "yes") {
    return renderDashboard(root, { onExit });
  }
  renderPinGate(root, { onExit });
}

function renderPinGate(root, { onExit }) {
  document.body.classList.remove("has-sidebar");
  root.innerHTML = `
    <div class="topbar">
      <button class="btn-back" id="back">← Home</button>
      <div class="topbar-title"><h1>Parent view</h1></div>
    </div>
    <div class="card">
      <p>Enter the parent PIN to continue.</p>
      <form id="pin-form">
        <input type="password" id="pin-input" inputmode="numeric" placeholder="PIN" autocomplete="off" />
        <div class="row" style="margin-top:12px">
          <button type="submit" class="btn-primary">Unlock</button>
        </div>
      </form>
      <p id="pin-error" class="muted" style="display:none">Incorrect PIN.</p>
    </div>
  `;
  document.getElementById("back").onclick = onExit;
  document.getElementById("pin-form").onsubmit = (e) => {
    e.preventDefault();
    const value = document.getElementById("pin-input").value;
    if (value === CONFIG.parentPin) {
      sessionStorage.setItem(PIN_SESSION_KEY, "yes");
      renderDashboard(root, { onExit });
    } else {
      document.getElementById("pin-error").style.display = "";
    }
  };
}

async function renderDashboard(root, { onExit }) {
  document.body.classList.add("has-sidebar");
  root.innerHTML = `<p class="muted">Loading…</p>`;

  let children = [];
  try {
    children = await fetchChildren({ includeInactive: true });
  } catch (err) {
    root.innerHTML = `<div class="card"><p><strong>Couldn't load children.</strong></p><p class="muted">${err.message}</p></div>`;
    return;
  }

  let words = [];
  try {
    words = await fetchWordsForManagement(selectedWordGrade);
  } catch (err) {
    console.warn("Could not load words for management:", err.message);
  }

  let reportSections = [];
  if (activeSection === "reports") {
    const activeChildren = children.filter((c) => c.active);
    reportSections = await Promise.all(
      activeChildren.map(async (child) => {
        const [sessions, flagged, statusMap, gradeWords, timeStats, avgResponseMs] = await Promise.all([
          getRecentSessions(child.id, 5).catch(() => []),
          getFlaggedWords(child.id).catch(() => []),
          fetchWordStatusMap(child.id).catch(() => ({})),
          fetchWordsForManagement(child.grade_level).catch(() => []),
          getTimeStats(child.id, { days: 7 }).catch(() => null),
          getAvgResponseMs(child.id).catch(() => null),
        ]);
        const activeWords = gradeWords.filter((w) => w.active);
        const counts = { new: 0, learning: 0, known: 0 };
        activeWords.forEach((w) => {
          const s = statusMap[w.id] || "new";
          counts[s] = (counts[s] || 0) + 1;
        });
        return { child, sessions, flagged, counts, total: activeWords.length, timeStats, avgResponseMs };
      })
    );
  }

  let patterns = {};
  if (activeSection === "patterns") {
    try {
      patterns = await fetchPatterns();
    } catch (err) {
      console.warn("Could not load patterns:", err.message);
    }
  }

  root.innerHTML = `
    <div class="topbar">
      <button class="btn-back" id="back">← Home</button>
      <div class="topbar-title"><h1>Parent view</h1></div>
      <button class="btn-link btn-lock" id="lock">Lock</button>
    </div>
    <div class="parent-layout">
      <nav class="parent-sidebar">
        ${SECTIONS.map(
          (s) => `<button data-section="${s.id}" class="${activeSection === s.id ? "active" : ""}">${s.label}</button>`
        ).join("")}
      </nav>
      <div class="parent-content" id="parent-content">
        ${
          activeSection === "children"
            ? childrenSectionHtml(children)
            : activeSection === "words"
              ? wordListsSectionHtml(words)
              : activeSection === "patterns"
                ? patternsSectionHtml(words, patterns)
                : reportsSectionHtml(reportSections)
        }
      </div>
    </div>
  `;

  document.getElementById("back").onclick = onExit;
  document.getElementById("lock").onclick = () => {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    onExit();
  };

  root.querySelectorAll("[data-section]").forEach((btn) => {
    btn.onclick = () => {
      activeSection = btn.dataset.section;
      renderDashboard(root, { onExit });
    };
  });

  if (activeSection === "children") bindChildrenSection(root, { onExit });
  if (activeSection === "words") bindWordListsSection(root, { onExit });
  if (activeSection === "patterns") bindPatternsSection(root, { onExit }, words, patterns);
  // Reports is read-only — nothing to bind.
}

// ---- Children section ----------------------------------------------------

function childrenSectionHtml(children) {
  return `
    <div class="card">
      <h2>Children</h2>
      <p class="muted">Add a child and assign a grade (1–6). Their Study/Practice/Quiz word list comes from that grade.</p>
      <div class="stack" id="child-rows">
        ${children
          .map(
            (c) => `
          <div class="row child-row" data-row="${c.id}" style="align-items:center; gap:8px; ${c.active ? "" : "opacity:0.5"}">
            <input type="text" class="child-name" data-id="${c.id}" value="${escapeAttr(c.name)}" style="flex:1" />
            <select class="child-grade" data-id="${c.id}">
              ${[1, 2, 3, 4, 5, 6]
                .map((g) => `<option value="${g}" ${g === c.grade_level ? "selected" : ""}>Grade ${g}</option>`)
                .join("")}
            </select>
            <button class="btn-secondary child-save" data-id="${c.id}">Save</button>
            <button class="btn-secondary child-toggle" data-id="${c.id}" data-active="${c.active}">${c.active ? "Deactivate" : "Reactivate"}</button>
          </div>
        `
          )
          .join("") || `<p class="muted">No children yet.</p>`}
      </div>

      <h3 style="margin-top:20px">Add a child</h3>
      <form id="add-child-form" class="row" style="align-items:center; gap:8px">
        <input type="text" id="new-child-name" placeholder="Child's name" required style="flex:1" />
        <select id="new-child-grade">
          ${[1, 2, 3, 4, 5, 6].map((g) => `<option value="${g}">Grade ${g}</option>`).join("")}
        </select>
        <button type="submit" class="btn-primary">Add</button>
      </form>
      <p id="add-child-error" class="muted" style="display:none"></p>
    </div>
  `;
}

function bindChildrenSection(root, { onExit }) {
  document.getElementById("add-child-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("new-child-name").value.trim();
    const grade = parseInt(document.getElementById("new-child-grade").value, 10);
    const errorEl = document.getElementById("add-child-error");
    if (!name) return;
    try {
      await createChild(name, grade);
      renderDashboard(root, { onExit });
    } catch (err) {
      errorEl.textContent = "Couldn't add child: " + err.message;
      errorEl.style.display = "";
    }
  };

  root.querySelectorAll(".child-save").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const row = root.querySelector(`.child-row[data-row="${id}"]`);
      const name = row.querySelector(".child-name").value.trim();
      const grade = parseInt(row.querySelector(".child-grade").value, 10);
      if (!name) return;
      btn.disabled = true;
      try {
        await updateChild(id, { name, gradeLevel: grade });
        renderDashboard(root, { onExit });
      } catch (err) {
        alert("Couldn't save: " + err.message);
        btn.disabled = false;
      }
    };
  });

  root.querySelectorAll(".child-toggle").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const isActive = btn.dataset.active === "true";
      btn.disabled = true;
      try {
        await setChildActive(id, !isActive);
        renderDashboard(root, { onExit });
      } catch (err) {
        alert("Couldn't update: " + err.message);
        btn.disabled = false;
      }
    };
  });
}

// ---- Word lists section ---------------------------------------------------

function wordListsSectionHtml(words) {
  return `
    <div class="card">
      <h2>Word lists</h2>
      <p class="muted">Add words to a grade one at a time, or upload a CSV. Existing words are never overwritten — duplicates (same spelling, same grade) are skipped automatically.</p>
      <div class="row" style="align-items:center; gap:8px; margin-bottom:16px">
        <label for="word-grade-select" class="muted" style="flex:0 0 auto">Grade:</label>
        <select id="word-grade-select">
          ${[1, 2, 3, 4, 5, 6].map((g) => `<option value="${g}" ${g === selectedWordGrade ? "selected" : ""}>Grade ${g}</option>`).join("")}
        </select>
        <button class="btn-link" id="download-template" style="flex:0 0 auto">Download CSV template</button>
      </div>

      <h3>Upload CSV</h3>
      <p class="muted">Columns: word, meaning, sentence, part_of_speech (optional), accepted_variants (optional, separate with ;)</p>
      <input type="file" id="csv-file" accept=".csv,text/csv" />
      <p id="csv-status" class="muted" style="display:none; margin-top:8px"></p>

      <h3 style="margin-top:20px">Add one word</h3>
      <form id="add-word-form" class="stack">
        <input type="text" id="new-word-word" placeholder="Word" required />
        <input type="text" id="new-word-meaning" placeholder="Meaning" required />
        <input type="text" id="new-word-sentence" placeholder="Example sentence" required />
        <input type="text" id="new-word-pos" placeholder="Part of speech (optional)" />
        <input type="text" id="new-word-variants" placeholder="Accepted variants, separated by ; (optional)" />
        <button type="submit" class="btn-primary">Add word to Grade ${selectedWordGrade}</button>
      </form>
      <p id="add-word-status" class="muted" style="display:none; margin-top:8px"></p>

      <h3 style="margin-top:20px">Grade ${selectedWordGrade} words (${words.filter((w) => w.active).length} active)</h3>
      <div class="stack" id="word-rows" style="max-height:320px; overflow-y:auto">
        ${
          words.length
            ? words
                .map(
                  (w) => `
          <div class="row word-row" style="align-items:center; gap:8px; ${w.active ? "" : "opacity:0.5"}">
            <div style="flex:1">
              <strong>${w.word}</strong>
              <span class="muted">— ${w.meaning || ""}</span>
            </div>
            <button class="btn-secondary word-toggle" data-id="${w.id}" data-active="${w.active}" style="flex:0 0 auto; width:auto; padding:8px 12px; font-size:0.85rem">${w.active ? "Remove" : "Restore"}</button>
          </div>
        `
                )
                .join("")
            : `<p class="muted">No words yet for Grade ${selectedWordGrade}.</p>`
        }
      </div>
    </div>
  `;
}

/**
 * Generates and stores Google Cloud TTS audio for each newly-added word, one
 * at a time, updating statusEl as it goes. Best-effort: a failure for one
 * word (e.g. a transient network hiccup) is reported but doesn't stop the
 * rest — a word without audio yet just falls back to the browser's voice
 * until it's retried (re-saving the word, e.g. re-uploading the same CSV
 * row, regenerates it).
 */
async function generateAudioForNewWords(insertedWords, statusEl) {
  if (!insertedWords.length) return;
  let failed = 0;
  for (let i = 0; i < insertedWords.length; i++) {
    statusEl.textContent = `Generating natural voice audio… (${i + 1}/${insertedWords.length})`;
    try {
      await generateAndStoreWordAudio(insertedWords[i]);
    } catch (err) {
      failed += 1;
      console.warn(`Couldn't generate audio for "${insertedWords[i].word}":`, err.message);
    }
  }
  statusEl.textContent = failed
    ? `Done, but audio failed for ${failed} word(s) — they'll use the browser's voice for now.`
    : `Audio ready for all ${insertedWords.length} new word(s).`;
}

function bindWordListsSection(root, { onExit }) {
  document.getElementById("word-grade-select").onchange = (e) => {
    selectedWordGrade = parseInt(e.target.value, 10);
    renderDashboard(root, { onExit });
  };

  document.getElementById("download-template").onclick = (e) => {
    e.preventDefault();
    const csv =
      "word,meaning,sentence,part_of_speech,accepted_variants\n" +
      'example,"a thing that shows what something is like.","This vase is an example of her pottery.",noun,\n';
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grade${selectedWordGrade}-word-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById("csv-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById("csv-status");
    statusEl.style.display = "";
    statusEl.textContent = "Reading file…";
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const parsedWords = csvRowsToWords(rows);
      if (!parsedWords.length) {
        statusEl.textContent = "No valid rows found in that file — check it has a 'word' column.";
        return;
      }
      const result = await addWords(selectedWordGrade, parsedWords);
      statusEl.textContent = `Added ${result.added} new word(s) to Grade ${selectedWordGrade}. Skipped ${result.skipped} already-existing word(s).`;
      await generateAudioForNewWords(result.insertedWords, statusEl);
      setTimeout(() => renderDashboard(root, { onExit }), 1200);
    } catch (err) {
      statusEl.textContent = "Couldn't import that file: " + err.message;
    }
  };

  document.getElementById("add-word-form").onsubmit = async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById("add-word-status");
    const word = document.getElementById("new-word-word").value.trim();
    const meaning = document.getElementById("new-word-meaning").value.trim();
    const sentence = document.getElementById("new-word-sentence").value.trim();
    const pos = document.getElementById("new-word-pos").value.trim();
    const variantsRaw = document.getElementById("new-word-variants").value.trim();
    if (!word || !meaning || !sentence) return;
    const acceptedVariants = variantsRaw
      ? variantsRaw.split(";").map((s) => s.trim()).filter(Boolean)
      : [];
    statusEl.style.display = "";
    statusEl.textContent = "Saving…";
    try {
      const result = await addWords(selectedWordGrade, [{ word, meaning, sentence, pos, acceptedVariants }]);
      if (result.added) {
        statusEl.textContent = `Added "${word}" to Grade ${selectedWordGrade}.`;
        await generateAudioForNewWords(result.insertedWords, statusEl);
      } else {
        statusEl.textContent = `"${word}" is already in Grade ${selectedWordGrade} — not added again.`;
      }
      setTimeout(() => renderDashboard(root, { onExit }), 900);
    } catch (err) {
      statusEl.textContent = "Couldn't add word: " + err.message;
    }
  };

  root.querySelectorAll(".word-toggle").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      const isActive = btn.dataset.active === "true";
      btn.disabled = true;
      try {
        await setWordActive(id, !isActive);
        renderDashboard(root, { onExit });
      } catch (err) {
        alert("Couldn't update: " + err.message);
        btn.disabled = false;
      }
    };
  });
}

// ---- Patterns section -------------------------------------------------

function patternsSectionHtml(words, patterns) {
  const patternOptions = (selected) =>
    `<option value="">—</option>` +
    Object.values(patterns)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${p.name}</option>`)
      .join("");

  return `
    <div class="card">
      <h2>Spelling patterns &amp; origins</h2>
      <p class="muted">Correct a word's pattern tags or origin here, then Save. "Origin verified" stays unchecked until you've confirmed it yourself — it's never set automatically.</p>
      <div class="row" style="align-items:center; gap:8px; margin-bottom:16px">
        <label for="pattern-grade-select" class="muted" style="flex:0 0 auto">Grade:</label>
        <select id="pattern-grade-select">
          ${[1, 2, 3, 4, 5, 6].map((g) => `<option value="${g}" ${g === selectedWordGrade ? "selected" : ""}>Grade ${g}</option>`).join("")}
        </select>
      </div>
      <div class="stack" id="pattern-rows" style="max-height:480px; overflow-y:auto">
        ${
          words.length
            ? words
                .map((w) => {
                  const meaningOk = countMeaningDistractors(w, words) >= 3;
                  const useItOk = blankSentence(w) !== null && countWordDistractors(w, words) >= 3;
                  return `
          <div class="card pattern-row" data-id="${w.id}" style="margin:0">
            <div class="row" style="align-items:center; gap:8px; flex-wrap:wrap">
              <strong style="flex:1 1 120px">${w.word}</strong>
              <span class="muted" style="flex:0 0 auto">${w.part_of_speech || "—"}</span>
              <span class="flag-pill" style="background:${meaningOk ? "#f0fdf4" : "#fff7ed"}; color:${meaningOk ? "#15803d" : "#c2410c"}">Meaning check: ${meaningOk ? "OK" : "Flagged"}</span>
              <span class="flag-pill" style="background:${useItOk ? "#f0fdf4" : "#fff7ed"}; color:${useItOk ? "#15803d" : "#c2410c"}">Use-it check: ${useItOk ? "OK" : "Flagged"}</span>
            </div>
            <div class="row" style="align-items:center; gap:8px; margin-top:10px; flex-wrap:wrap">
              <select class="pattern-primary" style="flex:1 1 150px">${patternOptions(w.pattern_primary)}</select>
              <select class="pattern-secondary" style="flex:1 1 150px">${patternOptions(w.pattern_secondary)}</select>
              <input type="text" class="pattern-origin" placeholder="Origin (optional)" value="${escapeAttr(w.origin || "")}" style="flex:1 1 150px" />
              <label class="muted" style="flex:0 0 auto; display:flex; align-items:center; gap:4px">
                <input type="checkbox" class="pattern-origin-verified" ${w.origin_verified ? "checked" : ""} /> Verified
              </label>
              <button class="btn-secondary pattern-save" style="flex:0 0 auto; width:auto; padding:8px 12px; font-size:0.85rem">Save</button>
            </div>
          </div>
        `;
                })
                .join("")
            : `<p class="muted">No words yet for Grade ${selectedWordGrade}.</p>`
        }
      </div>
    </div>
  `;
}

function bindPatternsSection(root, { onExit }, words, patterns) {
  document.getElementById("pattern-grade-select").onchange = (e) => {
    selectedWordGrade = parseInt(e.target.value, 10);
    renderDashboard(root, { onExit });
  };

  root.querySelectorAll(".pattern-row").forEach((rowEl) => {
    const id = parseInt(rowEl.dataset.id, 10);
    rowEl.querySelector(".pattern-save").onclick = async () => {
      const btn = rowEl.querySelector(".pattern-save");
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await updateWordTags(id, {
          patternPrimary: rowEl.querySelector(".pattern-primary").value,
          patternSecondary: rowEl.querySelector(".pattern-secondary").value,
          origin: rowEl.querySelector(".pattern-origin").value,
          originVerified: rowEl.querySelector(".pattern-origin-verified").checked,
        });
        btn.textContent = "Saved ✓";
        setTimeout(() => {
          btn.textContent = "Save";
          btn.disabled = false;
        }, 1200);
      } catch (err) {
        alert("Couldn't save: " + err.message);
        btn.textContent = "Save";
        btn.disabled = false;
      }
    };
  });
}

// ---- Reports section (read-only) ------------------------------------------

/** "1h 12m" / "8m" / "45s" -- never shows more than two units. */
function formatDuration(ms) {
  if (!ms || ms < 1000) return "0m";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return `${Math.round(ms / 1000)}s`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function reportsSectionHtml(sections) {
  if (!sections.length) {
    return `<div class="card"><p class="muted">No active children yet — add one in the Children tab to see reports here.</p></div>`;
  }
  return sections
    .map(
      ({ child, sessions, flagged, counts, total, timeStats, avgResponseMs }) => `
    <div class="card">
      <h2>${child.name} <span class="muted">(Grade ${child.grade_level})</span></h2>
      <p class="muted">Word status (${total} active words)</p>
      <div class="row" style="gap:8px; margin-bottom:16px">
        <span class="flag-pill" style="background:#f3f4f6; color:#374151">New: ${counts.new}</span>
        <span class="flag-pill" style="background:#fff7ed; color:#c2410c">Learning: ${counts.learning}</span>
        <span class="flag-pill" style="background:#f0fdf4; color:#15803d">Known: ${counts.known}</span>
      </div>
      <div class="row" style="gap:8px; margin-bottom:16px; flex-wrap:wrap">
        <span class="flag-pill" style="background:#eef2ff; color:#4338ca">⭐ ${child.points_balance || 0} points</span>
        <span class="flag-pill" style="background:#eef2ff; color:#4338ca">⏱️ ${timeStats ? formatDuration(timeStats.totalMs) : "—"} this week (${timeStats?.sessionCount || 0} sets)</span>
        <span class="flag-pill" style="background:#eef2ff; color:#4338ca">⚡ ${avgResponseMs != null ? (avgResponseMs / 1000).toFixed(1) + "s avg response" : "no data yet"}</span>
      </div>
      <p class="muted">Recent quiz scores</p>
      ${
        sessions.length
          ? `<table class="results">
              <thead><tr><th>Date</th><th>Score</th><th>Size</th></tr></thead>
              <tbody>
                ${sessions
                  .map(
                    (s) => `
                  <tr>
                    <td>${new Date(s.completed_at).toLocaleDateString()}</td>
                    <td>${s.score}/${s.total}</td>
                    <td>${s.size}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>`
          : `<p class="muted">No completed quizzes yet.</p>`
      }
      <p class="muted" style="margin-top:16px">Currently flagged words (${flagged.length})</p>
      ${
        flagged.length
          ? `<p>${flagged.map((w) => `<span class="flag-pill">${w.word}</span>`).join(" ")}</p>`
          : `<p class="muted">None right now.</p>`
      }
    </div>
  `
    )
    .join("");
}

function escapeAttr(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML.replace(/"/g, "&quot;");
}
