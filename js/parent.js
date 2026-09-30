import { CONFIG } from "./config.js";
import {
  getRecentSessions,
  getFlaggedWords,
  fetchChildren,
  createChild,
  updateChild,
  setChildActive,
} from "./db.js";

const PIN_SESSION_KEY = "parentUnlocked";

/**
 * Parent view: gated by a shared PIN (soft deterrent, not real security —
 * there's no login system in this app). Lets the parent create/edit/
 * deactivate child accounts and assign each one a grade (1-6), plus shows
 * read-only recent scores and flagged words per active child.
 */
export async function renderParentView(root, { onExit }) {
  if (sessionStorage.getItem(PIN_SESSION_KEY) === "yes") {
    return renderDashboard(root, { onExit });
  }
  renderPinGate(root, { onExit });
}

function renderPinGate(root, { onExit }) {
  root.innerHTML = `
    <h1>Parent view</h1>
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
    <button class="btn-link" id="back">Back to home</button>
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
  root.innerHTML = `<p class="muted">Loading…</p>`;

  let children = [];
  try {
    children = await fetchChildren({ includeInactive: true });
  } catch (err) {
    root.innerHTML = `<div class="card"><p><strong>Couldn't load children.</strong></p><p class="muted">${err.message}</p></div>`;
    return;
  }

  const activeChildren = children.filter((c) => c.active);
  const sections = await Promise.all(
    activeChildren.map(async (child) => {
      const [sessions, flagged] = await Promise.all([
        getRecentSessions(child.id, 5).catch(() => []),
        getFlaggedWords(child.id).catch(() => []),
      ]);
      return { child, sessions, flagged };
    })
  );

  root.innerHTML = `
    <h1>Parent view</h1>

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

    ${sections
      .map(
        ({ child, sessions, flagged }) => `
      <div class="card">
        <h2>${child.name} <span class="muted">(Grade ${child.grade_level})</span></h2>
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
      .join("")}
    <button class="btn-link" id="back">Back to home</button>
    <button class="btn-link" id="lock">Lock parent view</button>
  `;

  document.getElementById("back").onclick = onExit;
  document.getElementById("lock").onclick = () => {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    onExit();
  };

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

function escapeAttr(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML.replace(/"/g, "&quot;");
}
