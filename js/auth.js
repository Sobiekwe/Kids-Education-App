import { supabase } from "./supabaseClient.js";

/**
 * Real parent accounts (migration_008) replace the old shared PIN. Supabase
 * Auth handles the email/password itself (signUp/signInWithPassword work
 * straight from the browser with the publishable key -- no server needed);
 * this module just wraps those calls plus creating the family row a new
 * signup needs, and the login screen shown when no session exists.
 *
 * A session persists in the browser (Supabase's default, via localStorage),
 * so a parent logs in once per device -- after that, kids can tap their own
 * name on Home like before, no separate kid-level login.
 */

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Fires on login, logout, and token refresh. */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signUp(email, password, familyName) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // If "Confirm email" is off in the Supabase project, data.session is set
  // immediately and we can create the family row right away. If it's on,
  // there's no session yet -- the family row gets created on first login
  // instead (see signIn below), once email confirmation has happened.
  if (data.session) {
    await ensureFamilyRow(familyName);
  }
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await ensureFamilyRow(); // no-op if one already exists (onConflict below)
  return data;
}

/** Creates this user's family row if it doesn't exist yet. Safe to call on
 * every login -- onConflict makes it a no-op after the first time. */
async function ensureFamilyRow(name) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;
  const { error } = await supabase
    .from("families")
    .upsert({ owner_user_id: userData.user.id, name: name || null }, { onConflict: "owner_user_id", ignoreDuplicates: true });
  if (error) console.warn("Could not create family row (non-fatal):", error.message);
}

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Shown instead of Home when there's no session. Email + password, with a
 * tab to switch between logging in and creating a new family account.
 */
export function renderAuthGate(root, { onAuthenticated }) {
  document.body.classList.add("kid-theme");
  let mode = "login";

  function draw() {
    root.innerHTML = `
      <h1>Spelling Practice</h1>
      <div class="card">
        <div class="row" style="margin-bottom:16px; gap:8px">
          <button class="btn-secondary auth-tab" id="tab-login" style="${mode === "login" ? "font-weight:700" : ""}">Log in</button>
          <button class="btn-secondary auth-tab" id="tab-signup" style="${mode === "signup" ? "font-weight:700" : ""}">Create family account</button>
        </div>
        <form id="auth-form" class="stack" autocomplete="on">
          ${mode === "signup" ? `<input type="text" id="auth-family-name" placeholder="Family name (optional, e.g. &quot;The Okekes&quot;)" autocomplete="organization" />` : ""}
          <input type="email" id="auth-email" placeholder="Email" required autocomplete="email" />
          <input type="password" id="auth-password" placeholder="Password" required minlength="6" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" />
          <button type="submit" class="btn-primary" id="auth-submit">${mode === "signup" ? "Create account" : "Log in"}</button>
        </form>
        <p id="auth-error" class="muted" style="display:none; color:#c2410c"></p>
        <p id="auth-notice" class="muted" style="display:none"></p>
      </div>
      <p class="muted" style="text-align:center; margin-top:12px">
        <button class="btn-link" id="view-leaderboard">🏆 See the leaderboard</button>
      </p>
    `;
    document.getElementById("tab-login").onclick = () => {
      mode = "login";
      draw();
    };
    document.getElementById("tab-signup").onclick = () => {
      mode = "signup";
      draw();
    };
    document.getElementById("view-leaderboard").onclick = () => onViewLeaderboard?.();

    document.getElementById("auth-form").onsubmit = async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("auth-error");
      const noticeEl = document.getElementById("auth-notice");
      errorEl.style.display = "none";
      noticeEl.style.display = "none";
      const submitBtn = document.getElementById("auth-submit");
      submitBtn.disabled = true;
      const email = document.getElementById("auth-email").value.trim();
      const password = document.getElementById("auth-password").value;
      try {
        if (mode === "signup") {
          const familyName = document.getElementById("auth-family-name").value.trim();
          const { session } = await signUp(email, password, familyName);
          if (!session) {
            noticeEl.textContent = "Account created — check your email to confirm it, then log in.";
            noticeEl.style.display = "";
            mode = "login";
            draw();
            return;
          }
        } else {
          await signIn(email, password);
        }
        onAuthenticated();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = "";
        submitBtn.disabled = false;
      }
    };
  }

  let onViewLeaderboard = null;
  draw();
  return {
    /** app.js wires this after the fact so auth.js doesn't need to import leaderboard.js. */
    setViewLeaderboard(fn) {
      onViewLeaderboard = fn;
    },
  };
}
