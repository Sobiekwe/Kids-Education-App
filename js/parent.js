import { CONFIG } from "./config.js";
import { getRecentSessions, getFlaggedWords } from "./db.js";

/**
 * Read-only parent view (F14): each child's recent completed quiz scores
 * and current flagged words. No admin controls here — edits are made in
 * config.js / data/words.js and redeployed.
 */
export async function renderParentView(root, { onExit }) {
  root.innerHTML = `<p class="muted">Loading…</p>`;

  const sections = await Promise.all(
    CONFIG.children.map(async (child) => {
      const [sessions, flagged] = await Promise.all([
        getRecentSessions(child.id, 5).catch(() => []),
        getFlaggedWords(child.id).catch(() => []),
      ]);
      return { child, sessions, flagged };
    })
  );

  root.innerHTML = `
    <h1>Parent view</h1>
    <p class="muted">Read-only. Edit word lists and defaults in the app's config files.</p>
    ${sections
      .map(
        ({ child, sessions, flagged }) => `
      <div class="card">
        <h2>${child.name}</h2>
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
  `;
  document.getElementById("back").onclick = onExit;
}
