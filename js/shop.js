import { fetchAvatars, fetchChildUnlockedAvatarIds, unlockAvatar, setChildAvatar } from "./db.js";

/**
 * Avatar shop (motivation/gamification): spend points earned in Learn/
 * Practice/Quiz to unlock new avatars, then equip one. Free (cost 0)
 * avatars are always available; paid ones need a child_avatars row
 * (migration_007) to be usable. `child` is re-fetched fresh by the caller
 * each time Home renders, so its points_balance/avatar_id here are current
 * as of navigating in; this screen also tracks its own running balance
 * locally so it doesn't need a full round-trip after every purchase.
 */
export async function renderShop(root, { child, onExit }) {
  document.body.classList.add("kid-theme");
  root.innerHTML = `<p class="muted">Loading…</p>`;

  let avatars = [];
  let unlockedIds = [];
  try {
    [avatars, unlockedIds] = await Promise.all([fetchAvatars(), fetchChildUnlockedAvatarIds(child.id)]);
  } catch (err) {
    root.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="exit">← Home</button>
        <div class="topbar-title"><h2>Avatar Shop</h2></div>
      </div>
      <div class="card"><p><strong>Couldn't load the shop.</strong></p><p class="muted">${err.message}</p></div>
    `;
    document.getElementById("exit").onclick = onExit;
    return;
  }

  let balance = child.points_balance || 0;
  let equippedId = child.avatar_id;
  const owned = new Set(unlockedIds);

  function isOwned(a) {
    return a.cost === 0 || owned.has(a.id);
  }

  function render() {
    root.innerHTML = `
      <div class="topbar">
        <button class="btn-back" id="exit">← Home</button>
        <div class="topbar-title"><h2>🛍️ Avatar Shop — ${child.name}</h2></div>
      </div>
      <div class="card" style="text-align:center">
        <p class="muted" style="margin-bottom:4px">Your points</p>
        <div class="big" style="font-size:2rem; font-weight:800">⭐ ${balance}</div>
      </div>
      <div class="avatar-grid">
        ${avatars
          .map((a) => {
            const owns = isOwned(a);
            const equipped = a.id === equippedId;
            const canAfford = balance >= a.cost;
            let actionHtml;
            if (equipped) {
              actionHtml = `<button class="btn-secondary" disabled>Equipped</button>`;
            } else if (owns) {
              actionHtml = `<button class="btn-primary avatar-equip" data-id="${a.id}">Equip</button>`;
            } else if (canAfford) {
              actionHtml = `<button class="btn-study avatar-buy" data-id="${a.id}" data-cost="${a.cost}">Buy for ${a.cost} ⭐</button>`;
            } else {
              actionHtml = `<button class="btn-secondary" disabled>Need ${a.cost - balance} more ⭐</button>`;
            }
            return `
          <div class="avatar-card ${equipped ? "equipped" : ""}">
            <div class="avatar-emoji">${a.emoji}</div>
            <div class="avatar-name">${a.name}</div>
            <div class="muted" style="font-size:0.85rem; margin-bottom:8px">${a.cost === 0 ? "Free" : owns ? "Owned" : `${a.cost} points`}</div>
            ${actionHtml}
          </div>
        `;
          })
          .join("")}
      </div>
    `;

    document.getElementById("exit").onclick = onExit;

    root.querySelectorAll(".avatar-equip").forEach((btn) => {
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          await setChildAvatar(child.id, btn.dataset.id);
          equippedId = btn.dataset.id;
          render();
        } catch (err) {
          alert("Couldn't equip that avatar: " + err.message);
          btn.disabled = false;
        }
      };
    });

    root.querySelectorAll(".avatar-buy").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const cost = parseInt(btn.dataset.cost, 10);
        btn.disabled = true;
        btn.textContent = "Buying…";
        try {
          const newBalance = await unlockAvatar(child.id, id, cost);
          balance = newBalance;
          owned.add(id);
          // Auto-equip right after buying -- a kid who just spent points on
          // a new look wants to see it right away, not hunt for an Equip button.
          await setChildAvatar(child.id, id);
          equippedId = id;
          render();
        } catch (err) {
          alert("Couldn't buy that — " + (err.message.includes("not enough points") ? "not enough points." : err.message));
          btn.disabled = false;
          render();
        }
      };
    });
  }

  render();
}
