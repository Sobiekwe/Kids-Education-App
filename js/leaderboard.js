import { fetchLeaderboard } from "./db.js";

/**
 * Public leaderboard (migration_009) -- reachable with or without being
 * logged in. Shows only what opted-in families have agreed to share:
 * first name, grade, points, and equipped avatar. Grouped by grade so a
 * 1st grader is never compared to a 6th grader. Nothing else (full name,
 * scores, flagged words, time spent) ever appears here.
 */
export async function renderLeaderboard(root, { onExit }) {
  document.body.classList.add("kid-theme");
  root.innerHTML = `<p class="muted">Loading…</p>`;

  let rows = [];
  let loadError = null;
  try {
    rows = await fetchLeaderboard();
  } catch (err) {
    loadError = err;
  }

  if (loadError) {
    root.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="back">← Back</button>
        <div class="topbar-title"><h1>🏆 Leaderboard</h1></div>
      </div>
      <div class="card"><p><strong>Couldn't load the leaderboard.</strong></p><p class="muted">${loadError.message}</p></div>
    `;
    document.getElementById("back").onclick = onExit;
    return;
  }

  const byGrade = {};
  rows.forEach((r) => {
    (byGrade[r.grade_level] ||= []).push(r);
  });
  const grades = Object.keys(byGrade)
    .map(Number)
    .sort((a, b) => a - b);

  root.innerHTML = `
    <div class="topbar">
      <button class="btn-back" id="back">← Back</button>
      <div class="topbar-title"><h1>🏆 Leaderboard</h1></div>
    </div>
    <p class="muted">Only families who've opted in appear here — ask a parent to turn it on in Parent view if you don't see your name.</p>
    ${
      !grades.length
        ? `<div class="card"><p class="muted">No families have opted in to the leaderboard yet.</p></div>`
        : grades
            .map(
              (g) => `
      <div class="card">
        <h2>Grade ${g}</h2>
        <div class="stack">
          ${byGrade[g]
            .map(
              (r, i) => `
            <div class="row" style="align-items:center; gap:10px">
              <span class="muted" style="flex:0 0 auto; width:24px; text-align:right">${i + 1}.</span>
              <span style="flex:0 0 auto; font-size:1.4rem">${r.avatar_emoji || "🙂"}</span>
              <span style="flex:1"><strong>${escapeHtml(r.first_name)}</strong></span>
              <span class="flag-pill" style="flex:0 0 auto; background:#eef2ff; color:#4338ca">⭐ ${r.points}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
            )
            .join("")
    }
  `;
  document.getElementById("back").onclick = onExit;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
