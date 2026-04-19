// =============================================================
// render.js — Canvas cat drawing, DOM panels, event wiring
// =============================================================

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Transient UI state
const uiState = {
  activeNeighborhood: "park",
  picker: null, // { neighborhoodId, tier, selected: Set<catId>, searchForStrays: bool }
  strayQueue: [], // pending stray offers queued after resolution
  inventoryFilter: "all", // 'all' | 'common' | 'rare' | 'epic' | 'legendary'
  inventorySort: "rarity", // 'rarity' | 'slot' | 'affinity' | 'bonus'
  currentTalentCatId: null,
  currentStatChoiceCatId: null
};

// Canvas element + ctx per cat id, reused across renders.
const catCanvasCache = new Map();

// --- Cat drawing ---------------------------------------------------------

function drawCat(ctx, cat, opts = {}) {
  const w = opts.width || 120;
  const h = opts.height || 120;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + 8;

  const bestRarity = getBestEquippedRarity(cat);
  if (bestRarity) {
    const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, w * 0.58);
    grad.addColorStop(0, RARITY_TIERS[bestRarity].color + "66");
    grad.addColorStop(1, RARITY_TIERS[bestRarity].color + "00");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  const breed = CAT_BREEDS[cat.breed];

  // Tail — behind body, gentle sine-wave wag.
  const t = performance.now() / 600 + (parseInt(cat.id.slice(-2), 36) || 0);
  const tailWag = Math.sin(t) * 7;
  ctx.strokeStyle = cat.palette.fur;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx + 22, cy + 4);
  ctx.quadraticCurveTo(cx + 44 + tailWag, cy - 14, cx + 48 + tailWag, cy - 30);
  ctx.stroke();

  // Body (sitting pose)
  ctx.fillStyle = cat.palette.fur;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 14, 28, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Front forearms — short stubs visible in front of the body.
  ctx.strokeStyle = cat.palette.fur;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + 26); ctx.lineTo(cx - 10, cy + 34);
  ctx.moveTo(cx + 10, cy + 26); ctx.lineTo(cx + 10, cy + 34);
  ctx.stroke();

  // Front paws.
  ctx.fillStyle = cat.palette.fur;
  ctx.beginPath();
  ctx.ellipse(cx - 10, cy + 35, 6, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 10, cy + 35, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - 12, 20, 0, Math.PI * 2);
  ctx.fill();

  // Outer ears
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - 22);
  ctx.lineTo(cx - 8, cy - 32);
  ctx.lineTo(cx - 6, cy - 18);
  ctx.closePath();
  ctx.moveTo(cx + 18, cy - 22);
  ctx.lineTo(cx + 8, cy - 32);
  ctx.lineTo(cx + 6, cy - 18);
  ctx.closePath();
  ctx.fill();

  // Inner ears
  ctx.fillStyle = cat.palette.accent;
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy - 22);
  ctx.lineTo(cx - 10, cy - 28);
  ctx.lineTo(cx - 9, cy - 20);
  ctx.closePath();
  ctx.moveTo(cx + 15, cy - 22);
  ctx.lineTo(cx + 10, cy - 28);
  ctx.lineTo(cx + 9, cy - 20);
  ctx.closePath();
  ctx.fill();

  // Eye whites
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy - 12, 4, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, cy - 12, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iris
  ctx.fillStyle = cat.palette.eyes;
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy - 12, 2.6, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, cy - 12, 2.6, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(cx - 7, cy - 12, 1, 3.6, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, cy - 12, 1, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = "#D97A8F";
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx - 3, cy - 1);
  ctx.lineTo(cx + 3, cy - 1);
  ctx.closePath();
  ctx.fill();

  // Mouth
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx - 2, cy, 2.2, 0, Math.PI);
  ctx.arc(cx + 2, cy, 2.2, 0, Math.PI);
  ctx.stroke();

  // Whiskers
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 2); ctx.lineTo(cx - 22, cy - 4);
  ctx.moveTo(cx - 10, cy + 1); ctx.lineTo(cx - 22, cy + 2);
  ctx.moveTo(cx + 10, cy - 2); ctx.lineTo(cx + 22, cy - 4);
  ctx.moveTo(cx + 10, cy + 1); ctx.lineTo(cx + 22, cy + 2);
  ctx.stroke();

  // Class badge in top-right
  ctx.fillStyle = "#2a2a33";
  ctx.beginPath();
  ctx.arc(w - 14, 14, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd866";
  ctx.font = "bold 14px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(breed.icon, w - 14, 14);

  // Status ribbon on mission
  if (cat.status === "mission") {
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, h - 16, w, 16);
    ctx.fillStyle = "#ffd866";
    ctx.font = "bold 10px sans-serif";
    ctx.fillText("ON MISSION", w / 2, h - 8);
  }
}

// --- Helpers -------------------------------------------------------------

function describeBonus(bonus) {
  return Object.entries(bonus).map(([s, v]) => `+${v} ${STAT_LABELS[s]}`).join(", ");
}

function describeItemFull(item) {
  const hood = NEIGHBORHOODS[item.affinity];
  const bonus = ELEMENT_BONUS_BY_RARITY[item.rarity] || 0;
  const tagTxt = hood ? ` · ${hood.icon} ${hood.name} affinity (+${bonus} hazard mitigation on missions there)` : "";
  return `${item.name} — ${describeBonus(item.bonus)}${tagTxt}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// K/M/B suffix formatter. Keeps small numbers readable (0–9999 shown as integers), then
// transitions to 1 decimal place for larger magnitudes. Strips trailing ".0" so e.g.
// 12345 → "12.3K" but 12000 → "12K" (cleaner than "12.0K").
function formatNumber(n) {
  if (n == null || isNaN(n)) return "0";
  const sign = n < 0 ? "-" : "";
  n = Math.abs(Math.floor(n));
  if (n < 10000)         return sign + n.toString();
  const units = [
    { v: 1e12, s: "T" },
    { v: 1e9,  s: "B" },
    { v: 1e6,  s: "M" },
    { v: 1e3,  s: "K" }
  ];
  for (const { v, s } of units) {
    if (n >= v) {
      const scaled = n / v;
      // Truncate to 1 decimal (not round) so 99999 displays "99.9K" not "100K". Strip
      // trailing ".0" for clean edges: 10K, 100K, 1M instead of "10.0K" etc.
      const txt = scaled < 100
        ? (Math.floor(scaled * 10) / 10).toString()
        : Math.floor(scaled).toString();
      return sign + txt + s;
    }
  }
  return sign + n.toString();
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec ? `${min}m ${sec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const rm = min % 60;
  if (hr < 24) return rm ? `${hr}h ${rm}m` : `${hr}h`;
  const d = Math.floor(hr / 24);
  const rh = hr % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

// --- Top bar -------------------------------------------------------------

function renderTopBar() {
  // Display abbreviated; the exact count lives in the title attribute on the parent span
  // so a hover shows the precise number (useful when you care exactly, e.g. before prestige).
  const g  = Math.floor(gameState.gold);
  const fs = Math.floor(gameState.fishes   || 0);
  const tr = Math.floor(gameState.treaties || 0);
  const nl = Math.floor(gameState.nineLives || 0);
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = formatNumber(val);
    const parent = el.parentElement;
    if (parent) {
      // Preserve the original description tooltip but append the precise number.
      const base = parent.dataset.baseTitle || parent.getAttribute("title") || "";
      if (!parent.dataset.baseTitle) parent.dataset.baseTitle = base;
      parent.setAttribute("title", `${parent.dataset.baseTitle}\n\nExact: ${val.toLocaleString()}`);
    }
  };
  set("gold", g);
  set("fishes", fs);
  set("treaties", tr);
  set("nine-lives", nl);
  $("#cat-count").textContent = `${gameState.cats.length}/${clubMax()}`;
}

// --- Party panel ---------------------------------------------------------

function renderParty() {
  const host = $("#party-panel");
  const presentIds = new Set(gameState.cats.map(c => c.id));
  $$(".cat-card", host).forEach(card => {
    if (!presentIds.has(card.dataset.catId)) {
      catCanvasCache.delete(card.dataset.catId);
      card.remove();
    }
  });

  for (const cat of gameState.cats) {
    let card = $(`.cat-card[data-cat-id="${cat.id}"]`, host);
    if (!card) {
      card = document.createElement("div");
      card.className = "cat-card";
      card.dataset.catId = cat.id;
      card.innerHTML = `
        <canvas width="120" height="120" class="cat-portrait"></canvas>
        <div class="cat-head">
          <div class="cat-head-text">
            <span class="cat-name"></span>
            <span class="cat-class"></span>
          </div>
          <div class="cat-head-actions">
            <button class="talent-btn" title="Open talent tree" aria-label="Talents">\u{1F9E0}</button>
            <button class="stat-choice-btn" title="Stat choice available" aria-label="Stat choice">\u2605</button>
            <button class="bulk-equip-btn" title="Auto-equip best gear in each slot" aria-label="Equip best">\u2699\uFE0F</button>
            <button class="retire-btn" title="Retire to the Cat Lounge" aria-label="Retire">\u{1F3E1}</button>
          </div>
        </div>
        <div class="cat-status">
          <span class="cat-status-text"></span>
          <button class="cat-status-come-home" type="button" title="Stop auto-repeat — this party comes home after the current mission." style="display:none">🏠 come home</button>
        </div>
        <div class="cat-level-row">
          <span class="cat-level"></span>
          <div class="xp-bar"><div class="xp-fill"></div></div>
        </div>
        <div class="stats-grid"></div>
        <div class="equip-row"></div>
        <div class="cat-suggested"></div>`;
      host.appendChild(card);
      catCanvasCache.set(cat.id, $("canvas", card).getContext("2d"));
    }

    const breed = CAT_BREEDS[cat.breed];
    const vetTxt = cat.veteranLevel ? ` · Vet ${toRoman(cat.veteranLevel)}` : "";
    const nameEl = $(".cat-name", card);
    nameEl.textContent  = cat.name + (cat.veteranLevel ? " \u2728" : "");
    nameEl.title = "Click to rename";
    const passiveTxt = breed.passive ? ` \u2014 ${breed.passive.label}` : "";
    $(".cat-class", card).textContent = `${breed.classLabel} · ${breed.name}${passiveTxt}${vetTxt}`;
    $(".cat-class", card).title = breed.passive ? breed.passive.desc : breed.blurb;
    $(".cat-level", card).textContent = `Lv ${cat.level}`;

    const xpPct = cat.level >= LEVEL_CAP ? 100 : Math.min(100, (cat.xp / xpToNext(cat.level)) * 100);
    $(".xp-fill", card).style.width = xpPct + "%";

    const eff = effectiveStats(cat); // no affinity — base + gear base bonuses
    const statsHtml = STATS.map(s => {
      const base = cat.stats[s];
      const e = eff[s];
      const gearBonus = e - base;
      const bonusHtml = gearBonus > 0 ? `<span class="stat-bonus">+${gearBonus}</span>` : "";
      const tip = gearBonus > 0
        ? `${STAT_LABELS[s]}: ${base} base + ${gearBonus} from gear (incl. any slot mastery) = ${e}`
        : `${STAT_LABELS[s]}: ${base} base`;
      return `<div class="stat" title="${escapeHtml(tip)}"><span class="stat-label">${STAT_LABELS[s]}</span><span class="stat-value">${e}${bonusHtml}</span></div>`;
    }).join("");
    $(".stats-grid", card).innerHTML = statsHtml;

    const equipHtml = ITEM_SLOTS.map(slot => {
      const item = findItem(cat.equipped[slot]);
      if (!item) {
        return `<div class="equip-slot empty" data-slot="${slot}" data-cat-id="${cat.id}" title="Empty ${slot}">${slot[0].toUpperCase()}</div>`;
      }
      const hood = NEIGHBORHOODS[item.affinity];
      return `<div class="equip-slot rarity-${item.rarity}" data-slot="${slot}" data-cat-id="${cat.id}"
              title="${escapeHtml(describeItemFull(item))} (click to unequip)">${hood?.icon || ""}</div>`;
    }).join("");
    $(".equip-row", card).innerHTML = equipHtml;

    card.classList.toggle("busy", cat.status === "mission");
    card.classList.toggle("stationed", cat.status === "stationed");

    // Best-hood hint + bond partners: shown on the same line for idle cats.
    const suggestedEl = $(".cat-suggested", card);
    if (suggestedEl) {
      if (cat.status === "idle") {
        const hood = suggestedHoodForCat(cat);
        const partners = bondPartners(cat.id);
        const partnerNames = partners.map(pid => findCat(pid)?.name).filter(Boolean);
        // Title explains the suggestion mechanism so players know it's based on their stats.
        const hoodTip = hood
          ? `This cat's two best stats match ${hood.name} (${hood.primaryChecks.map(s => STAT_LABELS[s]).join(" / ")}). Hood missions tend to go well.`
          : "";
        const hoodHtml = hood ? `<span title="${escapeHtml(hoodTip)}">Best fit: <span>${hood.icon} ${escapeHtml(hood.name)}</span></span>` : "";
        const bondHtml = partnerNames.length
          ? `<span class="cat-bond-indicator" title="Bonded with: ${escapeHtml(partnerNames.join(", "))}. Pair them in a party for +${BOND_SCORE_BONUS} score, +${Math.round(BOND_LOOT_PCT_BONUS * 100)}% loot.">\u{1F49E} ${partnerNames.length}</span>`
          : "";
        if (hoodHtml || bondHtml) {
          suggestedEl.innerHTML = `${hoodHtml}${hoodHtml && bondHtml ? " · " : ""}${bondHtml}`;
          suggestedEl.style.display = "";
        } else {
          suggestedEl.style.display = "none";
        }
      } else {
        suggestedEl.style.display = "none";
      }
    }

    const statusEl   = $(".cat-status",           card);
    const statusText = $(".cat-status-text",      card);
    const comeHome   = $(".cat-status-come-home", card);
    if (cat.status === "mission") {
      statusText.textContent = "\u2694\uFE0F On mission";  // tickActiveBars refines this live
      statusEl.style.display = "";
      // Show Come Home only while the current mission has auto-repeat on. Finding the
      // mission by id is cheap; missions is always a short list.
      const m = gameState.missions.find(x => x.id === cat.missionId);
      comeHome.style.display = (m && m.autoRepeat) ? "" : "none";
    } else if (cat.status === "stationed") {
      statusText.textContent = `\uD83D\uDCCD At the ${stationLabel(cat.station)}`;
      statusEl.style.display = "";
      comeHome.style.display = "none";
    } else {
      statusText.textContent = "";
      statusEl.style.display = "none";
      comeHome.style.display = "none";
    }

    const pending = cat.pendingStatChoices || 0;
    const choiceBtn = $(".stat-choice-btn", card);
    if (pending > 0) {
      choiceBtn.style.display = "";
      choiceBtn.textContent = pending > 1 ? `\u2605 ${pending}` : "\u2605";
    } else {
      choiceBtn.style.display = "none";
    }

    // Talent badge: always visible (class-relevant), pulses when points are unspent.
    const tBtn = $(".talent-btn", card);
    if (tBtn) {
      const pts = cat.pendingTalentPoints || 0;
      const picked = Object.keys(cat.talents || {}).length;
      const total = (TALENT_TREES[cat.breed] || []).length;
      tBtn.textContent = pts > 0 ? `\u{1F9E0} +${pts}` : `\u{1F9E0} ${picked}/${total}`;
      tBtn.classList.toggle("has-points", pts > 0);
      tBtn.title = pts > 0
        ? `${pts} talent point${pts > 1 ? "s" : ""} to spend`
        : `${picked} of ${total} talents learned`;
    }
  }
}

function openShopTargetPicker(shopItem) {
  const body = $("#modal-body");
  let pickerRows = "";
  let kind = "";

  if (shopItem.target === "cat") {
    kind = "cat";
    pickerRows = gameState.cats.map(cat => {
      const breed = CAT_BREEDS[cat.breed];
      return `<button class="picker-cat-btn" data-shop-target-cat="${cat.id}" data-shop-apply="${shopItem.id}">
        ${escapeHtml(cat.name)} \u00B7 ${breed.classLabel} Lv${cat.level}
      </button>`;
    }).join("");
  } else if (shopItem.target === "cat-breed") {
    kind = "cat";
    const idle = gameState.cats.filter(c => c.status === "idle");
    if (!idle.length) {
      pickerRows = `<div class="empty-state">No idle cats.</div>`;
    } else {
      pickerRows = idle.map(cat => {
        const breed = CAT_BREEDS[cat.breed];
        return `<button class="picker-cat-btn" data-kitten-cat="${cat.id}">
          <div class="equip-cat-line">${escapeHtml(cat.name)} \u00B7 ${breed.classLabel} Lv${cat.level}</div>
          <div class="equip-delta muted">level resets to 1, stats reroll</div>
        </button>`;
      }).join("");
    }
  } else if (shopItem.target === "item") {
    kind = "item";
    const rerollable = gameState.inventory.slice().sort((a, b) => {
      const r = { legendary: 4, epic: 3, rare: 2, common: 1 };
      return r[b.rarity] - r[a.rarity];
    });
    if (!rerollable.length) {
      pickerRows = `<div class="empty-state">No items to reroll.</div>`;
    } else {
      pickerRows = rerollable.map(it => {
        const hood = NEIGHBORHOODS[it.affinity];
        return `<button class="picker-cat-btn rarity-${it.rarity}" data-shop-target-item="${it.id}" data-shop-apply="${shopItem.id}">
          <span class="picker-name">${escapeHtml(it.name)}</span>
          <span class="picker-score">${hood.icon} ${hood.name} \u2192 ?</span>
        </button>`;
      }).join("");
    }
  }

  body.innerHTML = `
    <h3>${shopItem.icon} ${escapeHtml(shopItem.name)}</h3>
    <p class="muted">${escapeHtml(shopItem.desc)} \u2014 pick a target ${kind}.</p>
    <div class="picker-list">${pickerRows}</div>
    <div class="modal-actions"><button data-modal-close>Cancel</button></div>`;
  $("#modal").classList.add("open");
}

function openKittenBreedPicker(catId) {
  const cat = findCat(catId);
  if (!cat) return;
  const body = $("#modal-body");
  const breedBtns = Object.values(CAT_BREEDS).map(breed => {
    const passiveTxt = breed.passive ? ` · ${breed.passive.label}` : "";
    return `<button class="picker-cat-btn" data-kitten-apply="${catId}" data-kitten-breed="${breed.id}">
      <div class="equip-cat-line">${breed.icon} ${breed.classLabel}${passiveTxt}</div>
      <div class="equip-delta muted">${escapeHtml(breed.blurb)}</div>
    </button>`;
  }).join("");
  body.innerHTML = `
    <h3>\uD83C\uDF7C Kitten Formula \u2014 ${escapeHtml(cat.name)}</h3>
    <p class="muted">Pick a new class. ${escapeHtml(cat.name)} resets to Lv 1 with new starting stats. Name and gear stay.</p>
    <div class="picker-list">${breedBtns}</div>
    <div class="modal-actions"><button data-modal-close>Cancel</button></div>`;
  $("#modal").classList.add("open");
}

function openTalentModal(catId) {
  const cat = findCat(catId);
  if (!cat) return;
  uiState.currentTalentCatId = catId;
  renderTalentModal();
  $("#modal").classList.add("open");
}

function renderTalentModal() {
  const body = $("#modal-body");
  const cat = findCat(uiState.currentTalentCatId);
  if (!body || !cat) return;
  const breed = CAT_BREEDS[cat.breed];
  const tree = talentTreeFor(cat);
  const nextIdx = nextTalentIdx(cat);
  const points = cat.pendingTalentPoints || 0;
  const hasPts = points > 0;

  const rows = tree.map((node, i) => {
    const picked = !!cat.talents?.[node.id];
    const available = !picked && i === nextIdx && hasPts;
    const locked = !picked && i !== nextIdx;
    const state = picked ? "picked" : available ? "available" : "locked";
    const badge = picked ? "\u2713" : available ? "\u2605" : "\u2022";
    return `<div class="talent-node ${state}">
      <div class="talent-tier-num">${i + 1}</div>
      <div class="talent-body">
        <div class="talent-name">${badge} ${escapeHtml(node.name)}</div>
        <div class="talent-desc muted">${escapeHtml(node.desc)}</div>
      </div>
      ${available ? `<button class="talent-pick-btn" data-talent-pick="${node.id}" title="${escapeHtml(node.desc)}">Pick</button>` : ""}
    </div>`;
  }).join("");

  const summary = nextIdx === -1
    ? `All talents learned \u2014 ${breed.classLabel} mastery complete.`
    : hasPts
      ? `<strong>${points}</strong> point${points > 1 ? "s" : ""} available. Pick the next talent in ${escapeHtml(breed.classLabel)}'s path.`
      : `No points available. Earn one every 5 levels (next at level ${Math.ceil((cat.level + 1) / 5) * 5}).`;

  body.innerHTML = `
    <h3>Talents \u2014 ${escapeHtml(cat.name)}</h3>
    <p class="muted">${summary}</p>
    <div class="talent-tree">${rows}</div>
    <div class="modal-actions"><button data-modal-close>Close</button></div>`;
}

function openStatChoiceModal(catId) {
  const cat = findCat(catId);
  if (!cat || !cat.pendingStatChoices) return;
  uiState.currentStatChoiceCatId = catId;
  const body = $("#modal-body");
  const statBtns = STATS.map(s => {
    const v = cat.stats[s];
    const capped = v >= BASE_STAT_CAP;
    return `<button class="stat-pick-btn ${capped ? "disabled" : ""}" data-stat-pick="${s}" ${capped ? "disabled" : ""}>
      <span class="stat-pick-label">${STAT_LABELS[s]}</span>
      <span class="stat-pick-value">${v}${capped ? " (cap)" : " \u2192 " + (v + 1)}</span>
    </button>`;
  }).join("");
  body.innerHTML = `
    <h3>\u2605 Train ${escapeHtml(cat.name)}</h3>
    <p class="muted">${cat.pendingStatChoices} choice${cat.pendingStatChoices > 1 ? "s" : ""} available. +1 to any stat (cap ${BASE_STAT_CAP}).</p>
    <div class="stat-pick-grid">${statBtns}</div>
    <div class="modal-actions"><button data-modal-close>Close</button></div>`;
  $("#modal").classList.add("open");
}

// --- Neighborhoods & missions -------------------------------------------

function renderNeighborhoodTabs() {
  const host = $("#neighborhood-tabs");
  const visibleIds = unlockedNeighborhoodIds();
  // Guard against the active tab being one the player no longer has access to.
  if (!visibleIds.includes(uiState.activeNeighborhood)) {
    uiState.activeNeighborhood = visibleIds[0] || "park";
  }
  host.innerHTML = visibleIds.map(id => {
    const n = NEIGHBORHOODS[id];
    const active = uiState.activeNeighborhood === id ? "active" : "";
    const checks = n.primaryChecks.map(s => STAT_LABELS[s]).join(" / ");
    const tip = `${n.name} \u2014 ${n.element} \u00B7 Check: ${checks}\n${n.flavor}`;
    return `<button class="hood-tab ${active}" data-hood-id="${id}" style="--hood-color: ${n.color}" title="${escapeHtml(tip)}">
      <span class="hood-icon">${n.icon}</span>
      <span class="hood-name">${n.name}</span>
    </button>`;
  }).join("");
}

function renderMissions() {
  const hood = NEIGHBORHOODS[uiState.activeNeighborhood];
  const host = $("#missions-panel");
  const flavorEl = $("#hood-flavor");
  flavorEl.textContent = `${hood.flavor} · Check: ${hood.primaryChecks.map(s => STAT_LABELS[s]).join(" / ")}`;
  host.innerHTML = "";

  // Commission card — always present at the top; opens the challenge-neighborhood designer.
  {
    const card = document.createElement("div");
    card.className = "mission-card commission-card";
    card.innerHTML = `
      <div class="mission-row">
        <div class="mission-head">
          <span class="mission-tier commission-tag">\u{1F4DC} COMMISSION</span>
          <span class="mission-duration muted">bespoke</span>
        </div>
        <div class="mission-stats">
          <span class="muted">Spend \uD83C\uDF80 to design a one-shot mission with stacked modifiers.</span>
        </div>
        <button class="mission-send commission-send" data-commission-open="${hood.id}" title="Spend treaties to commission a one-shot mission with stacked bonuses: Fortune, Jackpot, Prestige, etc.">Design</button>
      </div>`;
    host.appendChild(card);
  }

  // Weekly Boss card — only when on the boss's current neighborhood.
  if (gameState.weeklyBoss && gameState.weeklyBoss.neighborhoodId === hood.id) {
    const boss = gameState.weeklyBoss;
    const card = document.createElement("div");
    card.className = "mission-card boss-card" + (boss.completed ? " completed" : "");
    card.innerHTML = `
      <div class="mission-row">
        <div class="mission-head">
          <span class="mission-tier boss-tag">\u{1F451} BOSS</span>
          <span class="mission-duration">${formatDuration(WEEKLY_BOSS_BASE.duration)}</span>
        </div>
        <div class="mission-stats">
          <span>DC ${WEEKLY_BOSS_BASE.difficulty}+hazards</span>
          <span>Party ${partyMax()} required</span>
          <span>Guaranteed ${WEEKLY_BOSS_BASE.guaranteedLegendaries} legendary + ${WEEKLY_BOSS_BASE.treatyGuaranteed}\uD83C\uDF80</span>
        </div>
        <button class="mission-send boss-send" data-boss-send ${boss.completed ? "disabled" : ""} title="${boss.completed ? "This week's boss is defeated. Another appears next week." : `Open the party picker. Requires a full ${partyMax()}-cat party. Duration ${formatDuration(WEEKLY_BOSS_BASE.duration)}.`}">
          ${boss.completed ? "Defeated" : "Plan"}
        </button>
      </div>
      <div class="boss-desc">
        <span>Every hazard in ${hood.name} active at once. Full party required.</span>
        <span class="reset-timer" title="Next weekly rotation">\u23F1 ${formatDuration(msUntilWeeklyReset())}</span>
      </div>`;
    host.appendChild(card);
  }

  // Daily Challenge card for this hood.
  const daily = getDailyForHood(hood.id);
  if (daily) {
    const mod  = DAILY_MODIFIERS.find(m => m.id === daily.modifierId);
    const base = MISSION_TIERS.find(t => t.tier === daily.tier);
    const tierUnlocked = isTierUnlocked(daily.tier);
    const card = document.createElement("div");
    card.className = "mission-card daily-card" + (daily.completed ? " completed" : "") + (tierUnlocked ? "" : " locked");
    card.innerHTML = `
      <div class="mission-row">
        <div class="mission-head">
          <span class="mission-tier daily-tag">\u{1F31F} DAILY \u00B7 T${daily.tier}</span>
          <span class="mission-duration">${formatDuration(Math.floor(base.duration * (mod.durationMul || 1)))}</span>
        </div>
        <div class="mission-stats">
          <span>DC ${base.difficulty}</span>
          <span class="daily-mod">${escapeHtml(mod.label)}: ${escapeHtml(mod.desc)}</span>
        </div>
        <button class="mission-send daily-send" data-daily-send="${daily.id}" ${daily.completed || !tierUnlocked ? "disabled" : ""} title="${daily.completed ? "Today's daily is done. Resets at UTC midnight." : !tierUnlocked ? "T" + daily.tier + " is not unlocked yet for your save." : `Open the party picker for today's T${daily.tier} daily. Modifier: ${mod.desc}.`}">
          ${daily.completed ? "Done" : !tierUnlocked ? "Locked" : "Plan"}
        </button>
      </div>
      <div class="daily-meta">
        <span class="reset-timer" title="Next daily rotation">\u23F1 ${formatDuration(msUntilDailyReset())}</span>
      </div>`;
    host.appendChild(card);
  }

  for (const tier of MISSION_TIERS) {
    const mission = getMission(hood.id, tier.tier);
    const unlocked = isTierUnlocked(tier.tier);
    const card = document.createElement("div");
    card.className = "mission-card" + (unlocked ? "" : " locked");
    card.dataset.tier = tier.tier;
    const reasons = unlocked ? [] : tierLockReasons(tier.tier);
    const unlockReq = reasons.length
      ? `<div class="mission-lock">Needs ${reasons.map(escapeHtml).join(" \u00B7 ")}</div>`
      : "";
    card.innerHTML = `
      <div class="mission-row">
        <div class="mission-head">
          <span class="mission-tier">T${tier.tier}</span>
          <span class="mission-duration">${formatDuration(tier.duration)}</span>
        </div>
        <div class="mission-stats">
          <span>DC ${tier.difficulty}</span>
          <span>Party 1\u2013${partyMax()}</span>
          <span>${tier.goldRange[0]}\u2013${tier.goldRange[1]}💰${tier.fishRange[1] ? ` · up to ${tier.fishRange[1]}🐟` : ""}${tier.treatyChance ? ` · 🎀` : ""} · ${tier.xpReward} xp</span>
        </div>
        <button class="mission-send" data-tier="${tier.tier}" ${unlocked ? "" : "disabled"} title="${unlocked ? `Open the party picker for T${tier.tier} ${hood.name}. ${formatDuration(tier.duration)} per run.` : "Locked — see requirements below the card."}">Plan</button>
      </div>
      ${unlockReq}`;
    host.appendChild(card);
  }
}

// --- Inventory & log -----------------------------------------------------

function renderInventory() {
  const host = $("#inventory-panel");
  const toolbar = $("#inventory-toolbar");
  if (toolbar) renderInventoryToolbar(toolbar);

  // Equipped items live on the cat cards — don't duplicate them here. This is the stash,
  // strictly what's available to equip or sell.
  const stash = gameState.inventory.filter(i => !isItemEquipped(i.id));

  if (!stash.length) {
    const msg = gameState.inventory.length
      ? "All your gear is equipped. Unequip something from a cat card to see it here."
      : "No loot yet. Plan a mission!";
    host.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  const filter = uiState.inventoryFilter;
  let items = stash;
  if (filter !== "all") items = items.filter(i => i.rarity === filter);

  // Sort — stash is all-unequipped so the primary key is whatever the player picked.
  const rarityRank = { legendary: 4, epic: 3, rare: 2, common: 1 };
  const slotRank   = { collar: 0, toy: 1, treat: 2, relic: 3 };
  const sortMode = uiState.inventorySort || "rarity";
  const cmpName = (a, b) => a.name.localeCompare(b.name);
  const cmpBonusSum = (a, b) => {
    const sa = Object.values(a.bonus).reduce((s, v) => s + v, 0);
    const sb = Object.values(b.bonus).reduce((s, v) => s + v, 0);
    return sb - sa;
  };
  items.sort((a, b) => {
    if (sortMode === "rarity") {
      const ra = rarityRank[b.rarity] - rarityRank[a.rarity];
      if (ra !== 0) return ra;
      return cmpName(a, b);
    }
    if (sortMode === "slot") {
      const ra = slotRank[a.type] - slotRank[b.type];
      if (ra !== 0) return ra;
      const rb = rarityRank[b.rarity] - rarityRank[a.rarity];
      if (rb !== 0) return rb;
      return cmpName(a, b);
    }
    if (sortMode === "affinity") {
      if (a.affinity !== b.affinity) return a.affinity.localeCompare(b.affinity);
      const rb = rarityRank[b.rarity] - rarityRank[a.rarity];
      if (rb !== 0) return rb;
      return cmpName(a, b);
    }
    if (sortMode === "bonus") {
      const rb = cmpBonusSum(a, b);
      if (rb !== 0) return rb;
      return cmpName(a, b);
    }
    return cmpName(a, b);
  });

  if (!items.length) {
    host.innerHTML = `<div class="empty-state">No unequipped ${filter} items.</div>`;
    return;
  }

  host.innerHTML = items.map(item => {
    const hood = NEIGHBORHOODS[item.affinity];
    return `
      <div class="inv-item rarity-${item.rarity}" data-item-id="${item.id}"
           title="${escapeHtml(describeItemFull(item))}">
        <div class="inv-type">${item.type} · ${hood?.icon || ""}</div>
        <div class="inv-name">${escapeHtml(item.name)}</div>
        <div class="inv-bonus">${describeBonus(item.bonus)}</div>
      </div>`;
  }).join("");
}

function renderInventoryToolbar(host) {
  // Counts reflect the stash (unequipped only) — equipped gear is shown on cat cards.
  const stash = gameState.inventory.filter(i => !isItemEquipped(i.id));
  const filters = ["all", "common", "rare", "epic", "legendary"];
  const pills = filters.map(f => {
    const count = f === "all"
      ? stash.length
      : stash.filter(i => i.rarity === f).length;
    const active = uiState.inventoryFilter === f ? "active" : "";
    const labelTxt = f === "all" ? "All" : f[0].toUpperCase() + f.slice(1);
    const tip = f === "all" ? "Show all unequipped items" : `Show only ${f} items (${count})`;
    return `<button class="inv-filter-pill ${active} rarity-${f}" data-inv-filter="${f}" title="${escapeHtml(tip)}">${labelTxt} <span class="inv-filter-count">${count}</span></button>`;
  }).join("");

  const unequippedCommons = gameState.inventory.filter(i => i.rarity === "common" && !isItemEquipped(i.id)).length;
  const unequippedRares   = gameState.inventory.filter(i => i.rarity === "rare"   && !isItemEquipped(i.id)).length;

  // Always-visible legend explaining affinity. Players see hood icons on items and need a
  // reason to care: matching gear absorbs hazard severity on that hood's missions.
  const legend = unlockedNeighborhoodIds().map(id => {
    const h = NEIGHBORHOODS[id];
    return `<span class="inv-legend-pill" title="${escapeHtml(h.name)}">${h.icon}</span>`;
  }).join("");

  // Sort control — small select next to bulk actions.
  const currentSort = uiState.inventorySort || "rarity";
  const sortOptions = [
    ["rarity",   "Rarity"],
    ["slot",     "Slot"],
    ["affinity", "Affinity"],
    ["bonus",    "Stat bonus"]
  ];
  const sortSelect = `<label class="inv-sort"><span class="muted">Sort:</span>
    <select id="inv-sort-select">
      ${sortOptions.map(([v, l]) => `<option value="${v}" ${v === currentSort ? "selected" : ""}>${l}</option>`).join("")}
    </select></label>`;

  // Bulk-sell previews their expected gold payout so the player knows what they're cashing in.
  const commonSellValue = unequippedCommons * (RARITY_TIERS.common.bonusValue * 10);
  const rareSellValue   = unequippedRares   * (RARITY_TIERS.rare.bonusValue * 10);
  host.innerHTML = `
    <div class="inv-filter-row">${pills}</div>
    <div class="inv-bulk-row">
      <button class="inv-bulk-btn" data-bulk-sell="common" ${unequippedCommons ? "" : "disabled"} title="Sell every unequipped common for ${commonSellValue}\uD83D\uDCB0 total.">Sell commons (${unequippedCommons})</button>
      <button class="inv-bulk-btn" data-bulk-sell="rare"   ${unequippedRares ? "" : "disabled"} title="Sell every unequipped rare for ${rareSellValue}\uD83D\uDCB0 total.">Sell rares (${unequippedRares})</button>
      ${sortSelect}
    </div>
    <div class="inv-legend muted" title="Gear matching a hood's element absorbs that hood's hazards. Higher-rarity pieces absorb more (C 1 · R 1 · E 2 · L 3).">
      <span class="inv-legend-pills">${legend}</span>
      <span class="inv-legend-text">Matching-hood gear cancels hazards on that hood's missions.</span>
    </div>`;
}

function renderShop() {
  const host = $("#shop-panel");
  if (!host) return;
  const pendingSummons = gameState.shop?.pendingStraySummons || 0;
  const pendingBonus   = gameState.shop?.pendingStrayBonus   || 0;
  host.innerHTML = SHOP_ITEMS.map(item => {
    const available = shopItemAvailable(item);
    const afford = canAfford(item.cost);
    let stateBadge = "";
    if (item.id === "autosell" && gameState.shop.autoSellCommons) stateBadge = `<div class="shop-state">Unlocked</div>`;
    if (item.id === "summons" && pendingSummons > 0)              stateBadge = `<div class="shop-state">Pending \u00D7 ${pendingSummons}</div>`;
    if (item.strayBonus && pendingBonus > 0)                      stateBadge = `<div class="shop-state">Next mission +${Math.round(pendingBonus * 100)}%</div>`;
    const disabled = !available || !afford;
    const btnLabel = !available ? "Owned" : formatCost(item.cost);
    const buyTip = !available ? "Already unlocked" : !afford ? insufficientMessage(item.cost) : `Buy for ${formatCost(item.cost)}`;
    return `
      <div class="shop-item ${disabled ? "disabled" : ""}" data-shop="${item.id}" title="${escapeHtml(item.desc)}">
        <div class="shop-icon">${item.icon}</div>
        <div class="shop-info">
          <div class="shop-name">${escapeHtml(item.name)}</div>
          <div class="shop-desc">${escapeHtml(item.desc)}</div>
          ${stateBadge}
        </div>
        <button class="shop-buy" data-shop-buy="${item.id}" ${disabled ? "disabled" : ""} title="${escapeHtml(buyTip)}">${btnLabel}</button>
      </div>`;
  }).join("");
}

function renderLounge() {
  const host = $("#lounge-panel");
  if (!host) return;
  const lounge = gameState.loungeCats || [];
  const summary = $(".lounge-details summary h2");
  if (summary) summary.textContent = `\uD83C\uDFE1 Cat Lounge (${lounge.length})`;
  if (!lounge.length) {
    host.innerHTML = `<div class="empty-state">No retirees yet. The club is young.</div>`;
    return;
  }
  host.innerHTML = lounge.map(c => {
    const breed = CAT_BREEDS[c.breed];
    const when = new Date(c.retiredAt).toLocaleDateString();
    const statsTxt = STATS.map(s => `${STAT_LABELS[s]} ${c.finalStats[s]}`).join(" · ");
    return `<div class="lounge-card" data-lounge-id="${c.id}" title="${escapeHtml(statsTxt)}&#10;Retired ${when}">
      <canvas width="60" height="60" class="lounge-portrait"></canvas>
      <div class="lounge-info">
        <div class="lounge-name">${escapeHtml(c.name)}</div>
        <div class="lounge-meta">${breed.classLabel} · Lv ${c.finalLevel}</div>
      </div>
    </div>`;
  }).join("");
  // Draw each portrait — scale the 120px drawing down to the 60px thumb.
  for (const c of lounge) {
    const canvas = host.querySelector(`.lounge-card[data-lounge-id="${c.id}"] canvas`);
    if (!canvas) continue;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(0.5, 0.5);
    drawCat(ctx, { ...c, stats: c.finalStats, level: c.finalLevel, equipped: {}, status: "idle" });
    ctx.restore();
  }
}

function renderClubLevel() {
  const info = $("#club-level-info");
  const host = $("#club-perks-panel");
  if (!info || !host) return;
  const lvl = gameState.clubLevel || 1;
  const xp  = gameState.clubXp || 0;
  const needed = clubXpToNext(lvl);
  const pct = Math.min(100, (xp / needed) * 100);
  info.innerHTML = `
    <div class="club-level-row">
      <span class="club-level-label">Level ${lvl}</span>
      <div class="club-xp-bar"><div class="club-xp-fill" style="width:${pct}%"></div></div>
      <span class="club-xp-text">${xp} / ${needed}</span>
    </div>`;
  host.innerHTML = CLUB_PERKS.map(perk => {
    const owned = perk.owned && perk.owned(gameState);
    const levelOk = (gameState.clubLevel || 1) >= (perk.requiresClubLevel || 1);
    const afford = (gameState.nineLives || 0) >= perk.cost;
    const disabled = owned || !levelOk || !afford;
    const label = owned ? "Unlocked"
      : !levelOk ? `Lvl ${perk.requiresClubLevel}`
      : `${perk.cost} \uD83C\uDF00`;
    const stateBadge = owned ? `<div class="shop-state">Unlocked</div>` : "";
    return `
      <div class="shop-item ${disabled ? "disabled" : ""}" data-club-perk="${perk.id}">
        <div class="shop-icon">${perk.icon}</div>
        <div class="shop-info">
          <div class="shop-name">${escapeHtml(perk.name)}</div>
          <div class="shop-desc">${escapeHtml(perk.desc)}</div>
          ${stateBadge}
        </div>
        <button class="shop-buy" data-club-perk-buy="${perk.id}" ${disabled ? "disabled" : ""}>${label}</button>
      </div>`;
  }).join("");
}

function renderAchievements() {
  const host = $("#achievements-panel");
  if (!host) return;
  const total = ACHIEVEMENTS.length;
  const done  = ACHIEVEMENTS.filter(a => gameState.achievements?.[a.id]?.claimed).length;
  host.innerHTML = `
    <div class="ach-summary">${done}/${total} unlocked</div>
    <div class="ach-list">
      ${ACHIEVEMENTS.map(a => {
        const claimed = gameState.achievements?.[a.id]?.claimed;
        return `<div class="ach-row ${claimed ? "claimed" : ""}">
          <div class="ach-icon">${claimed ? "\uD83C\uDFC6" : "\u25EF"}</div>
          <div class="ach-info">
            <div class="ach-name">${escapeHtml(a.name)}</div>
            <div class="ach-desc">${escapeHtml(a.desc)}</div>
          </div>
          <div class="ach-reward">${escapeHtml((a.reward && a.reward.note) || "")}</div>
        </div>`;
      }).join("")}
    </div>`;
}

// --- Tier-2 minigames ---------------------------------------------------

// Shared assigned-cat badge shown at the top of each station panel.
function renderStationBadge(stationId) {
  const catId = getStationCatId(stationId);
  if (!catId) {
    return `<div class="station-badge empty">
      <span class="station-badge-text muted">No cat assigned</span>
      <button class="station-assign-btn" data-station-assign="${stationId}">+ Assign Cat</button>
    </div>`;
  }
  const cat = findCat(catId);
  if (!cat) return "";
  const breed = CAT_BREEDS[cat.breed];
  return `<div class="station-badge">
    <span class="station-cat">${breed.icon} <strong>${escapeHtml(cat.name)}</strong> \u00B7 ${breed.classLabel} Lv${cat.level}</span>
    <button class="station-unassign-btn" data-station-unassign="${stationId}">Unassign</button>
  </div>`;
}

function formatMs(ms) {
  if (ms <= 0) return "0s";
  if (ms < 60 * 1000) return Math.ceil(ms / 1000) + "s";
  if (ms < 60 * 60 * 1000) return Math.ceil(ms / 60000) + "m";
  return (ms / (60 * 60 * 1000)).toFixed(1) + "h";
}

function renderStars() {
  const host = $("#stars-panel");
  if (!host) return;
  if (!isStargazingUnlocked()) {
    host.innerHTML = `<div class="minigame-locked">\uD83D\uDD12 ${escapeHtml(MINIGAME_GATES.stargazing.label)}</div>`;
    return;
  }
  refreshStarSign();
  const sign = currentStarSign();
  const assigned = !!getStationCatId("stargazing");
  const badge = renderStationBadge("stargazing");

  if (!sign) {
    host.innerHTML = `${badge}<div class="empty-state muted">The sky is overcast tonight.</div>`;
    return;
  }

  // With a cat assigned, each sign becomes a clickable pip; without, only the reroll button
  // changes the sign (costs 🎀). Daily rotation is also skipped while assigned.
  let action;
  if (assigned) {
    action = `<div class="star-pick-hint muted">Click a sign to hold it \u2014 the perch-cat keeps it until swapped.</div>`;
  } else {
    const cost = effectiveShopCost(STAR_REROLL_COST);
    const canAff = canAfford(STAR_REROLL_COST);
    action = `<button class="star-reroll" id="star-reroll" ${canAff ? "" : "disabled"}>Shift \u00B7 ${cost.treaties}\uD83C\uDF80</button>`;
  }

  const pips = STAR_SIGNS.map(s => {
    const cls = (s.id === sign.id ? "active" : "") + (assigned ? " pickable" : "");
    const attr = assigned ? `data-star-pick="${s.id}"` : "";
    return `<span class="star-pip ${cls}" ${attr} title="${escapeHtml(s.name + ' — +' + STAR_CHECK_BONUS + ' ' + STAT_LABELS[s.stat])}">${s.glyph}</span>`;
  }).join("");

  host.innerHTML = `
    ${badge}
    <div class="star-card">
      <div class="star-glyph">${sign.glyph}</div>
      <div class="star-info">
        <div class="star-name">${escapeHtml(sign.name)} <span class="star-stat">\u00B7 +${STAR_CHECK_BONUS} ${STAT_LABELS[sign.stat]}</span></div>
        <div class="star-flavor muted">${escapeHtml(sign.flavor)}</div>
      </div>
      ${action}
    </div>
    <div class="star-signs-strip">${pips}</div>`;
}

function renderFishing() {
  const host = $("#fishing-panel");
  if (!host) return;
  if (!isFishingUnlocked()) {
    host.innerHTML = `<div class="minigame-locked">\uD83D\uDD12 ${escapeHtml(MINIGAME_GATES.fishing.label)}</div>`;
    host.dataset.biteState = "none";
    return;
  }
  const f = gameState.fishing;
  if (!f) { host.innerHTML = ""; return; }
  const cast = f.cast;
  const now = Date.now();
  let bar = "";
  let button = "";
  let biteState = "none";
  if (cast) {
    biteState = fishingBiteState(now);
    const elapsed = now - cast.startedAt;
    const pct = Math.min(100, (elapsed / cast.durationMs) * 100);
    const remaining = Math.max(0, cast.durationMs - elapsed);
    const readyTxt = remaining <= 0 ? "Reeling\u2026" : `Nibbling \u00B7 ${formatMs(remaining)}`;
    bar = `
      <div class="fish-bar"><div class="fish-bar-fill" style="width:${pct}%"></div></div>
      <div class="fish-eta muted">${readyTxt}</div>`;
    if (biteState === "biting") {
      button = `<button id="fish-hook" class="fish-btn fish-btn-hook">\uD83D\uDD25 HOOK!</button>`;
    } else {
      button = `<button class="fish-btn" disabled>${biteState === "waiting" ? "Watching the bobber\u2026" : biteState === "missed" ? "Reeling slowly\u2026" : "Casting\u2026"}</button>`;
    }
  } else {
    bar = `<div class="fish-bar"><div class="fish-bar-fill" style="width:0%"></div></div>
           <div class="fish-eta muted">Line is dry. Cast time: ${formatMs(fishingDuration())}</div>`;
    button = `<button id="fish-cast" class="fish-btn">Cast Line</button>`;
  }
  host.dataset.biteState = biteState;
  const upgradeRows = FISHING_UPGRADES.map(up => {
    const lvl = f.upgrades[up.id] || 0;
    const maxed = lvl >= up.max;
    const cost = maxed ? null : effectiveShopCost(up.costFn(lvl));
    const afford = !maxed && canAfford(up.costFn(lvl));
    const costTxt = maxed ? "MAX"
      : cost.fishes ? `${cost.fishes}\uD83D\uDC1F`
      : cost.treaties ? `${cost.treaties}\uD83C\uDF80`
      : "?";
    return `
      <div class="fish-upgrade ${maxed ? "maxed" : ""} ${!afford && !maxed ? "disabled" : ""}">
        <div class="fish-up-icon">${up.icon}</div>
        <div class="fish-up-body">
          <div class="fish-up-name">${escapeHtml(up.name)} ${maxed ? "" : `<span class="muted">Lv ${lvl}/${up.max}</span>`}</div>
          <div class="fish-up-desc">${escapeHtml(up.desc)}</div>
        </div>
        <button class="fish-up-buy" data-fish-upgrade="${up.id}" ${maxed || !afford ? "disabled" : ""}>${costTxt}</button>
      </div>`;
  }).join("");
  const badge = renderStationBadge("fishing");
  const assignedCat = findCat(getStationCatId("fishing"));
  const stationNote = assignedCat
    ? `<div class="muted" style="font-size:11px">${escapeHtml(assignedCat.name)}'s WIS boosts rarity shift, DEX shortens cast time, and each catch grants ${STATION_XP_PER_CATCH}\u00A0XP.</div>`
    : "";
  host.innerHTML = `
    ${badge}
    ${stationNote}
    <div class="fish-status">
      ${bar}
      <div class="fish-actions">${button}</div>
    </div>
    <div class="fish-stats muted">Total caught: ${f.totalCaught || 0}${fishingPrestigeBonus() > 0 ? ` \u00B7 +${fishingPrestigeBonus()}\uD83D\uDC1F/catch from prestige` : ""} \u00B7 Watch for a tug \u2014 HOOK! mid-cast for a richer catch.</div>
    <div class="fish-upgrades">${upgradeRows}</div>`;
}

function renderGarden() {
  const host = $("#garden-panel");
  if (!host) return;
  if (!isGardenUnlocked()) {
    host.innerHTML = `<div class="minigame-locked">\uD83D\uDD12 ${escapeHtml(MINIGAME_GATES.garden.label)}</div>`;
    return;
  }
  const g = gameState.garden;
  if (!g) { host.innerHTML = ""; return; }
  const now = Date.now();
  const plots = g.plots.map((plot, idx) => {
    if (!plot) {
      const seedOpts = availableSeeds().map(s => {
        const afford = canAfford(s.cost);
        const costTxt = Object.entries(s.cost).map(([k, v]) => `${v}${k === "fishes" ? "\uD83D\uDC1F" : k === "treaties" ? "\uD83C\uDF80" : "\uD83D\uDCB0"}`).join(" ");
        const yieldList = s.yields.map(y => y.note).join(" \u00B7 ");
        const tip = `Grows in ${formatDuration(s.growMs)}. Yields one of: ${yieldList}`;
        return `<button class="plot-seed-btn" data-plant-plot="${idx}" data-plant-seed="${s.id}" ${afford ? "" : "disabled"} title="${escapeHtml(tip)}">${s.icon} ${escapeHtml(s.name)} \u00B7 ${costTxt}</button>`;
      }).join("");
      return `<div class="plot empty">
        <div class="plot-label muted">Plot ${idx + 1} \u00B7 empty</div>
        <div class="plot-seeds">${seedOpts}</div>
      </div>`;
    }
    const seed = GARDEN_SEEDS.find(s => s.id === plot.seedId);
    if (!seed) return `<div class="plot"><div class="plot-label muted">Plot ${idx + 1} \u00B7 unknown</div></div>`;
    const remaining = plot.finishedAt - now;
    const total = plot.finishedAt - plot.plantedAt;
    const pct = Math.max(0, Math.min(100, 100 * (1 - remaining / total)));
    const ready = remaining <= 0;
    return `<div class="plot ${ready ? "ready" : "growing"}">
      <div class="plot-label">${seed.icon} ${escapeHtml(seed.name)}</div>
      <div class="plot-bar"><div class="plot-bar-fill" style="width:${pct}%"></div></div>
      <div class="plot-eta muted">${ready ? "Ready to harvest!" : formatMs(remaining)}</div>
      ${ready ? `<button class="plot-harvest" data-harvest-plot="${idx}">Harvest</button>` : ""}
    </div>`;
  }).join("");
  const badge = renderStationBadge("garden");
  const gardener = findCat(getStationCatId("garden"));
  const toggle = gardener
    ? `<label class="garden-autoplant"><input type="checkbox" id="garden-autoplant" ${g.autoPlant ? "checked" : ""}> Auto-plant catnip (3\uD83D\uDC1F) in empty plots</label>`
    : "";
  const note = gardener
    ? `<div class="muted" style="font-size:11px">${escapeHtml(gardener.name)}'s INT skews yields toward rarer drops. ${STATION_XP_PER_HARVEST}\u00A0XP per harvest.</div>`
    : "";
  host.innerHTML = `
    ${badge}
    ${toggle}
    ${note}
    <div class="garden-grid">${plots}</div>`;
}

// Challenge Neighborhood designer modal.
function openCommissionModal(neighborhoodId) {
  uiState.commission = {
    neighborhoodId: neighborhoodId || uiState.activeNeighborhood,
    tier: Math.min(gameState.highestTier || 1, MISSION_TIERS.length) || 1,
    mods: new Set()
  };
  renderCommissionModal();
  $("#modal").classList.add("open");
}

function renderCommissionModal() {
  const body = $("#modal-body");
  if (!body || !uiState.commission) return;
  const c = uiState.commission;
  const hood = NEIGHBORHOODS[c.neighborhoodId];
  if (!hood) return;
  const cost = challengeCommissionCost(Array.from(c.mods));
  const canAfford = (gameState.treaties || 0) >= cost;
  const tierUnlocked = isTierUnlocked(c.tier);

  // Hood picker — only unlocked hoods.
  const hoodBtns = unlockedNeighborhoodIds().map(hid => {
    const h = NEIGHBORHOODS[hid];
    return `<button class="commission-hood ${hid === c.neighborhoodId ? "active" : ""}" data-commission-hood="${hid}" title="${escapeHtml(h.flavor)}">${h.icon} ${escapeHtml(h.name)}</button>`;
  }).join("");

  // Tier picker — only unlocked tiers for the selected hood.
  const tierBtns = MISSION_TIERS.filter(t => isTierUnlocked(t.tier)).map(t =>
    `<button class="commission-tier ${t.tier === c.tier ? "active" : ""}" data-commission-tier="${t.tier}" title="DC ${t.difficulty} \u00B7 ${formatDuration(t.duration)} \u00B7 ${t.goldRange[0]}\u2013${t.goldRange[1]}\uD83D\uDCB0">T${t.tier}</button>`
  ).join("") || `<span class="muted">No tiers unlocked yet.</span>`;

  // Modifier checkboxes.
  const modRows = CHALLENGE_MODIFIERS.map(mod => {
    const on = c.mods.has(mod.id);
    return `<label class="commission-mod ${on ? "on" : ""}">
      <input type="checkbox" data-commission-mod="${mod.id}" ${on ? "checked" : ""}>
      <span class="commission-mod-name">${escapeHtml(mod.label)}</span>
      <span class="commission-mod-desc muted">${escapeHtml(mod.desc)}</span>
      <span class="commission-mod-cost">${mod.cost ? mod.cost + "\uD83C\uDF80" : "free"}</span>
    </label>`;
  }).join("");

  // Preview of the built mission for feedback.
  const preview = buildChallengeMission(c.neighborhoodId, c.tier, Array.from(c.mods));
  const previewTxt = preview
    ? `Duration ${formatDuration(preview.duration)} · ${preview.goldRange.join("\u2013")}\uD83D\uDCB0 · up to ${preview.fishRange[1]}\uD83D\uDC1F · ${preview.xpReward}xp · ${preview.effectsActive}/${hood.effects.length} hazards${preview.lootRolls > 1 ? ` · ${preview.lootRolls}\u00D7 loot` : ""}${preview.rarityShift ? ` · +${preview.rarityShift} rarity` : ""}${preview.bonusTreaties ? ` · +${preview.bonusTreaties}\uD83C\uDF80 guaranteed` : ""}`
    : "—";

  body.innerHTML = `
    <h3>\u{1F4DC} Commission a Mission</h3>
    <div class="commission-section">
      <div class="commission-label">Neighborhood</div>
      <div class="commission-row">${hoodBtns}</div>
    </div>
    <div class="commission-section">
      <div class="commission-label">Tier</div>
      <div class="commission-row">${tierBtns}</div>
    </div>
    <div class="commission-section">
      <div class="commission-label">Modifiers</div>
      <div class="commission-mods">${modRows}</div>
    </div>
    <div class="commission-preview">${escapeHtml(previewTxt)}</div>
    <div class="commission-footer">
      <span class="commission-cost">Total: <strong>${cost}\uD83C\uDF80</strong></span>
      <div class="modal-actions">
        <button data-modal-close>Cancel</button>
        <button id="commission-dispatch" class="btn-primary" ${canAfford && tierUnlocked ? "" : "disabled"}>${tierUnlocked ? `Commission (${cost}\uD83C\uDF80)` : "Tier locked"}</button>
      </div>
    </div>`;
}

function openStationAssignPicker(stationId) {
  const body = $("#modal-body");
  if (!body) return;
  const label = { fishing: "Fishing Hole", garden: "Catnip Garden", stargazing: "Stargazing perch" }[stationId] || stationId;
  // Only truly-idle cats (not on missions, not already at another station) are eligible.
  const idle = gameState.cats.filter(c => c.status === "idle");
  if (!idle.length) {
    body.innerHTML = `
      <h3>Assign to the ${escapeHtml(label)}</h3>
      <p class="muted">No idle cats available right now. Recall missions or unassign another station.</p>
      <div class="modal-actions"><button data-modal-close>Close</button></div>`;
    $("#modal").classList.add("open");
    return;
  }
  // Hint per station for why a given stat matters at that post.
  const hint = stationId === "fishing"    ? "WIS boosts rarity shift, DEX shortens cast time."
             : stationId === "garden"     ? "INT biases yield rolls toward rarer outcomes."
             : stationId === "stargazing" ? "Any cat can hold the sign; prioritize someone you want to train passively."
             : "";
  const rows = idle.map(c => {
    const breed = CAT_BREEDS[c.breed];
    const eff = effectiveStats(c);
    const relevant = stationId === "fishing"    ? `WIS ${eff.wis} \u00B7 DEX ${eff.dex}`
                   : stationId === "garden"     ? `INT ${eff.int}`
                   : stationId === "stargazing" ? `Lv ${c.level}`
                   : "";
    return `<button class="picker-cat-btn" data-station-assign-cat="${stationId}" data-cat-id="${c.id}">
      <div class="equip-cat-line">${breed.icon} ${escapeHtml(c.name)} \u00B7 ${breed.classLabel} Lv${c.level}</div>
      <div class="equip-delta muted">${relevant}</div>
    </button>`;
  }).join("");
  body.innerHTML = `
    <h3>Assign to the ${escapeHtml(label)}</h3>
    <p class="muted">${escapeHtml(hint)}</p>
    <div class="picker-list">${rows}</div>
    <div class="modal-actions"><button data-modal-close>Cancel</button></div>`;
  $("#modal").classList.add("open");
}

// --- Stats dashboard ----------------------------------------------------

function renderStats() {
  const host = $("#stats-panel");
  if (!host) return;
  const s = gameState.stats || {};
  const missions = s.missionsRun || 0;
  const crits    = s.missionsCrit || 0;
  const fails    = s.missionsFail || 0;
  const successes = Math.max(0, missions - crits - fails);
  const critRate  = missions ? Math.round(100 * crits / missions) : 0;
  const failRate  = missions ? Math.round(100 * fails / missions) : 0;

  const elapsedMs = Date.now() - (s.firstStartedAt || Date.now());
  const hours = Math.floor(elapsedMs / (60 * 60 * 1000));
  const mins  = Math.floor((elapsedMs % (60 * 60 * 1000)) / (60 * 1000));
  const playtime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const totalBonds = Object.values(gameState.catBonds || {}).filter(n => n >= BOND_THRESHOLD).length;
  const researchDone = Object.keys(gameState.research?.completed || {}).length;
  const bestiaryTotal = BESTIARY.reduce((sum, c) => sum + Math.min(c.count(gameState), c.total()), 0);
  const bestiaryGoal  = BESTIARY.reduce((sum, c) => sum + c.total(), 0);

  // Compact grid layout: label + formatted value per row.
  const rows = [
    ["Playtime",            playtime],
    ["Missions run",        formatNumber(missions)],
    ["Crit rate",           `${critRate}% (${formatNumber(crits)})`],
    ["Fail rate",           `${failRate}% (${formatNumber(fails)})`],
    ["Legendaries found",   formatNumber(s.legendariesFound || 0)],
    ["Lifetime gold",       `${formatNumber(gameState.cumulativeGold || 0)}\uD83D\uDCB0`],
    ["Prestiges",           formatNumber(gameState.prestigeCount || 0)],
    ["Highest tier",        `T${gameState.highestTier || 0}`],
    ["Club level",          `Lv ${gameState.clubLevel || 1}`],
    ["Cats retired",        formatNumber((gameState.loungeCats || []).length)],
    ["Bonds formed",        formatNumber(totalBonds)],
    ["Research complete",   `${researchDone} / ${RESEARCH_NODES.length}`],
    ["Bestiary progress",   `${formatNumber(bestiaryTotal)} / ${formatNumber(bestiaryGoal)}`],
    ["Consumables bought",  formatNumber(s.consumablesBought || 0)],
    ["Mouse sightings",     formatNumber(s.mousesSeen || 0)]
  ];
  host.innerHTML = `
    <div class="stats-grid-rows">
      ${rows.map(([k, v]) => `<div class="stats-row"><span class="stats-k">${escapeHtml(k)}</span><span class="stats-v">${v}</span></div>`).join("")}
    </div>`;
}

// --- Research panel -----------------------------------------------------

function renderResearch() {
  const host = $("#research-panel");
  if (!host) return;
  if (!isResearchUnlocked()) {
    const n = RESEARCH_UNLOCK_CLUB_LEVEL;
    const have = gameState.clubLevel || 1;
    host.innerHTML = `<div class="minigame-locked">\uD83D\uDD12 Club Level ${n} unlocks the Research Library (${have}/${n}).</div>`;
    host.dataset.researchState = "locked";
    return;
  }
  const active = gameState.research?.active;
  const completed = gameState.research?.completed || {};

  // Active row at the top, if something's being researched.
  let activeBlock = "";
  if (active) {
    const node = RESEARCH_NODES.find(n => n.id === active.nodeId);
    const now = Date.now();
    const remaining = Math.max(0, active.completesAt - now);
    const total = active.completesAt - active.startedAt;
    const pct = Math.max(0, Math.min(100, 100 * (1 - remaining / total)));
    activeBlock = `
      <div class="research-active">
        <div class="research-active-head">
          <span class="research-icon">${node?.icon || "\uD83D\uDCDA"}</span>
          <span class="research-name">${escapeHtml(node?.name || "Research")}</span>
          <button class="research-cancel-btn" id="research-cancel" title="Cancel (half refund)">Cancel</button>
        </div>
        <div class="research-bar"><div class="research-bar-fill" style="width:${pct}%"></div></div>
        <div class="research-eta muted">${remaining > 0 ? formatDuration(remaining) : "Finalizing\u2026"}</div>
      </div>`;
  }

  // Group nodes by tier.
  const tiers = {};
  for (const n of RESEARCH_NODES) {
    tiers[n.tier] = tiers[n.tier] || [];
    tiers[n.tier].push(n);
  }
  const tierLabels = { 1: "Foundations", 2: "Intermediate", 3: "Advanced", 4: "Grand" };

  const tierBlocks = Object.keys(tiers).sort().map(t => {
    const rows = tiers[t].map(node => {
      const isDone = !!completed[node.id];
      const isActive = active && active.nodeId === node.id;
      const prereqsMet = researchPrereqsMet(node);
      const afford = canAfford(node.cost);
      const state = isDone ? "done" : isActive ? "active" : !prereqsMet ? "locked" : !afford ? "unaffordable" : "available";
      const costStr = Object.entries(node.cost).map(([k, v]) => `${v}${k === "fishes" ? "\uD83D\uDC1F" : k === "treaties" ? "\uD83C\uDF80" : "\uD83D\uDCB0"}`).join(" ");
      const durStr = formatDuration(node.duration);
      let actionBtn = "";
      if (state === "available") {
        actionBtn = `<button class="research-start-btn" data-research-start="${node.id}" title="${escapeHtml(node.desc)} Takes ${formatDuration(node.duration)}.">Start \u00B7 ${costStr}</button>`;
      } else if (state === "unaffordable") {
        actionBtn = `<button class="research-start-btn" disabled>Needs ${costStr}</button>`;
      } else if (state === "done") {
        actionBtn = `<span class="research-done-pill">\u2713 Done</span>`;
      } else if (state === "active") {
        actionBtn = `<span class="research-active-pill">In progress</span>`;
      } else {
        const locks = node.prereq.filter(id => !completed[id]).map(id => RESEARCH_NODES.find(x => x.id === id)?.name || id);
        actionBtn = `<span class="research-lock-pill" title="Needs: ${escapeHtml(locks.join(", "))}">\uD83D\uDD12 Locked</span>`;
      }
      return `<div class="research-node research-node-${state}">
        <div class="research-node-icon">${node.icon}</div>
        <div class="research-node-body">
          <div class="research-node-name">${escapeHtml(node.name)} <span class="muted">\u00B7 ${durStr}</span></div>
          <div class="research-node-desc muted">${escapeHtml(node.desc)}</div>
        </div>
        <div class="research-node-action">${actionBtn}</div>
      </div>`;
    }).join("");
    return `
      <div class="research-tier">
        <div class="research-tier-label muted">${tierLabels[t] || ("Tier " + t)}</div>
        ${rows}
      </div>`;
  }).join("");

  const completedCount = Object.keys(completed).length;
  host.innerHTML = `
    ${activeBlock}
    <div class="research-summary muted">${completedCount} / ${RESEARCH_NODES.length} researched</div>
    ${tierBlocks}`;
  host.dataset.researchState = active ? "active" : "idle";
}

// --- Patrons ------------------------------------------------------------

function renderPatron() {
  const host = $("#patron-panel");
  if (!host) return;
  if (!isPatronUnlocked()) {
    const n = PATRON_REQUIRES_PRESTIGE;
    const have = gameState.prestigeCount || 0;
    host.innerHTML = `<div class="minigame-locked">\uD83D\uDD12 Take ${n} Cat Naps to choose a Patron (${have}/${n}).</div>`;
    return;
  }
  const p = activePatron();
  if (!p) {
    host.innerHTML = `
      <div class="patron-empty">
        <p class="muted">You haven't pledged to a Patron yet. The first choice is free \u2014 switching later costs ${PATRON_SWAP_COST}\uD83C\uDF00.</p>
        <button id="patron-open-picker" class="btn-primary">Choose a Patron</button>
      </div>`;
    return;
  }
  const summary = p.summary.map(s => `<li>${escapeHtml(s)}</li>`).join("");
  const canSwap = (gameState.nineLives || 0) >= PATRON_SWAP_COST;
  host.innerHTML = `
    <div class="patron-card active" style="border-color:${p.color};">
      <div class="patron-head">
        <span class="patron-icon" style="color:${p.color};">${p.icon}</span>
        <span class="patron-name">${escapeHtml(p.name)}</span>
      </div>
      <div class="patron-flavor muted">${escapeHtml(p.flavor)}</div>
      <ul class="patron-summary">${summary}</ul>
      <button id="patron-open-picker" class="patron-swap-btn" ${canSwap ? "" : "disabled"}>Swap \u00B7 ${PATRON_SWAP_COST}\uD83C\uDF00</button>
    </div>`;
}

function openPatronPicker() {
  const body = $("#modal-body");
  if (!body) return;
  const current = gameState.patronId;
  const isSwap = !!current;
  const cost = isSwap ? PATRON_SWAP_COST : 0;
  const canAfford = !isSwap || (gameState.nineLives || 0) >= cost;

  const cards = PATRONS.map(p => {
    const isCurrent = p.id === current;
    const summary = p.summary.map(s => `<li>${escapeHtml(s)}</li>`).join("");
    const btnText = isCurrent ? "Current" : isSwap ? `Swap (${cost}\uD83C\uDF00)` : "Pledge";
    const disabled = isCurrent || !canAfford;
    return `<div class="patron-pick-card" style="border-color:${p.color};">
      <div class="patron-head">
        <span class="patron-icon" style="color:${p.color};">${p.icon}</span>
        <span class="patron-name">${escapeHtml(p.name)}</span>
      </div>
      <div class="patron-flavor muted">${escapeHtml(p.flavor)}</div>
      <ul class="patron-summary">${summary}</ul>
      <button class="patron-pick-btn" data-patron-pick="${p.id}" ${disabled ? "disabled" : ""}>${btnText}</button>
    </div>`;
  }).join("");

  body.innerHTML = `
    <h3>\uD83C\uDFAD Choose a Patron</h3>
    <p class="muted">Each Patron rewrites a slice of the game's math. ${isSwap ? `Swapping costs <strong>${cost}\uD83C\uDF00</strong>.` : "Your first pledge is free."}</p>
    <div class="patron-picker-grid">${cards}</div>
    <div class="modal-actions"><button data-modal-close>Cancel</button></div>`;
  $("#modal").classList.add("open");
}

function renderChallenges() {
  const host = $("#challenges-panel");
  if (!host) return;
  const active = gameState.activeChallenge;
  const boons = gameState.challengeBoons || {};

  const activeCh = active ? CHALLENGES.find(c => c.id === active.id) : null;
  const activeBlock = activeCh ? (() => {
    const pct = Math.min(100, (active.missionsCompleted / activeCh.goalCount) * 100);
    const hoodNote = activeCh.restriction === "homebody"
      ? (active.hoodLock ? ` · Locked to ${NEIGHBORHOODS[active.hoodLock]?.name || active.hoodLock}` : " · Locks on first mission")
      : "";
    return `
      <div class="challenge-active">
        <div class="challenge-head">
          <span class="challenge-icon">${activeCh.icon}</span>
          <span class="challenge-name">${escapeHtml(activeCh.name)} — Active</span>
        </div>
        <div class="challenge-desc">${escapeHtml(activeCh.desc)}${hoodNote}</div>
        <div class="challenge-bar"><div class="challenge-fill" style="width:${pct}%"></div></div>
        <div class="challenge-progress">
          <span>${active.missionsCompleted} / ${activeCh.goalCount} wins${activeCh.goalMinTier > 1 ? ` (T${activeCh.goalMinTier}+)` : ""}</span>
          <button class="challenge-btn abandon" id="challenge-abandon">Abandon</button>
        </div>
      </div>`;
  })() : "";

  const listBlock = CHALLENGES.map(ch => {
    const lvl = boons[ch.id] || 0;
    const isActive = active && active.id === ch.id;
    const locked = !!active && !isActive;
    const stateBadge = lvl > 0
      ? `<div class="challenge-boon">Boon Lv ${lvl} · ${escapeHtml(ch.reward.label)} (stacked)</div>`
      : `<div class="challenge-boon muted">Reward: ${escapeHtml(ch.reward.label)}</div>`;
    const minTierTxt = ch.goalMinTier > 1 ? ` at T${ch.goalMinTier}+` : "";
    const btnLabel = isActive ? "Active" : lvl > 0 ? `Repeat (Lv ${lvl + 1})` : "Begin";
    return `
      <div class="challenge-row ${isActive ? "is-active" : ""} ${locked ? "locked" : ""}">
        <div class="challenge-icon-lg">${ch.icon}</div>
        <div class="challenge-body">
          <div class="challenge-name">${escapeHtml(ch.name)}</div>
          <div class="challenge-desc">${escapeHtml(ch.desc)}</div>
          <div class="challenge-goal muted">Goal: win ${ch.goalCount} missions${minTierTxt}.</div>
          ${stateBadge}
        </div>
        <button class="challenge-btn" data-challenge-start="${ch.id}" ${isActive || locked ? "disabled" : ""}>${btnLabel}</button>
      </div>`;
  }).join("");

  host.innerHTML = `${activeBlock}<div class="challenge-list">${listBlock}</div>`;
}

function renderMastery() {
  const host = $("#mastery-panel");
  if (!host) return;
  const rows = ITEM_SLOTS.map(slot => {
    const xp    = gameState.slotMasteryXp?.[slot] || 0;
    const lvl   = slotMasteryLevel(slot);
    const need  = slotMasteryXpToNext(lvl + 1);
    const pct   = Math.min(100, (xp / need) * 100);
    const affix = slotMasteryAffixBonus(slot);
    const lootC = Math.round(lvl * MASTERY_LOOT_PER_LEVEL * 1000) / 10; // %
    const nextAffixLvl = (Math.floor(lvl / MASTERY_AFFIX_STEP) + 1) * MASTERY_AFFIX_STEP;
    return `
      <div class="mastery-row">
        <div class="mastery-slot">${slot[0].toUpperCase() + slot.slice(1)}</div>
        <div class="mastery-body">
          <div class="mastery-head">
            <span class="mastery-level">Lv ${lvl}</span>
            <span class="mastery-xp">${xp} / ${need}</span>
          </div>
          <div class="mastery-bar"><div class="mastery-fill" style="width:${pct}%"></div></div>
          <div class="mastery-bonus muted">+${affix} affix · +${lootC}% loot (when equipped) · next affix at Lv ${nextAffixLvl}</div>
        </div>
      </div>`;
  }).join("");
  host.innerHTML = rows;
}

function renderBestiary() {
  const host = $("#bestiary-panel");
  if (!host) return;
  const rows = BESTIARY.map(cat => {
    const have    = cat.count(gameState);
    const need    = cat.total();
    const pct     = Math.min(100, (have / need) * 100);
    const tier    = bestiaryTier(cat.id);
    const maxTier = bestiaryMaxTier(cat.id);
    const nextAt  = bestiaryNextThreshold(cat.id);
    const maxed   = tier >= maxTier;
    const current = tier > 0 ? cat.tierLabel(tier) : `Next tier at ${cat.step} \u2014 ${cat.tierLabel(1)}`;
    const nextHint = nextAt !== null ? ` \u00B7 next tier at ${nextAt}` : " \u00B7 MAX";
    return `
      <div class="bestiary-row ${tier > 0 ? "has-tier" : ""} ${maxed ? "maxed" : ""}">
        <div class="bestiary-icon">${cat.icon}</div>
        <div class="bestiary-body">
          <div class="bestiary-head">
            <span class="bestiary-label">${escapeHtml(cat.label)}</span>
            <span class="bestiary-count">${have} / ${need} \u00B7 Tier ${tier}/${maxTier}</span>
          </div>
          <div class="bestiary-bar"><div class="bestiary-fill" style="width:${pct}%"></div></div>
          <div class="bestiary-reward ${tier > 0 ? "earned" : "muted"}">${tier > 0 ? "\u2605 " : ""}${escapeHtml(current)}${escapeHtml(nextHint)}</div>
        </div>
      </div>`;
  }).join("");
  host.innerHTML = rows;
}

function renderEternalPerks() {
  const host = $("#eternal-panel");
  if (!host) return;
  host.innerHTML = ETERNAL_PERKS.map(perk => {
    const owned    = perk.owned && perk.owned(gameState);
    const locked   = perk.available && !perk.available(gameState);
    const cost     = eternalPerkCost(perk);
    const canBuy   = !owned && !locked && (gameState.nineLives || 0) >= cost;
    const level    = perk.level ? perk.level(gameState) : 0;
    const maxLvl   = perk.maxLevel || 0;

    // Level badge for repeatables; special-case clubSlot which uses clubMax as its "level".
    let stateBadge = "";
    if (perk.id === "clubSlot") {
      stateBadge = `<div class="shop-state">Club cap ${gameState.eternalPerks.clubMax}/${MAX_CLUB_CAP}</div>`;
    } else if (perk.repeatable && maxLvl) {
      stateBadge = `<div class="shop-state">Lv ${level}/${maxLvl}</div>`;
    } else if (owned && !perk.repeatable) {
      stateBadge = `<div class="shop-state">Unlocked</div>`;
    }

    const label = owned && !perk.repeatable ? "Owned"
      : locked ? "MAX"
      : `${cost} 🌀`;
    return `
      <div class="shop-item ${!canBuy ? "disabled" : ""}" data-eternal="${perk.id}">
        <div class="shop-icon">${perk.icon}</div>
        <div class="shop-info">
          <div class="shop-name">${escapeHtml(perk.name)}</div>
          <div class="shop-desc">${escapeHtml(perk.desc)}</div>
          ${stateBadge}
        </div>
        <button class="shop-buy" data-eternal-buy="${perk.id}" ${!canBuy ? "disabled" : ""}>${label}</button>
      </div>`;
  }).join("");
  renderCatNap();
}

function renderCatNap() {
  const host = $("#cat-nap-area");
  if (!host) return;
  const preview = nineLivesPreview();
  // Persistent nudge badge on the Eternal Perks summary header. Shows while prestige would
  // earn a meaningful amount — most useful before the player's first nap, but stays on to
  // remind veterans they have stacked-up gold waiting to cash in.
  const napBadge = $("#eternal-nap-badge");
  if (napBadge) {
    const productive = preview >= 5;
    if (productive) {
      const firstNap = (gameState.prestigeCount || 0) === 0;
      napBadge.textContent = firstNap ? `\u{1F4A4} +${preview}\uD83C\uDF00 ready` : `+${preview}\uD83C\uDF00`;
      napBadge.style.display = "";
      napBadge.classList.toggle("first-nap", firstNap);
    } else {
      napBadge.style.display = "none";
    }
  }
  const canNap = !gameState.missions.length && gameState.cats.some(c => c.status === "idle");
  const reason = gameState.missions.length ? "Finish active missions first"
    : !gameState.cats.length ? "No cats to carry"
    : "";
  host.innerHTML = `
    <div class="cat-nap-box">
      <div class="cat-nap-head">
        <span class="cat-nap-title">Cat Nap (Ascension)</span>
        <span class="cat-nap-preview">Ascend now: <strong>+${preview} 🌀</strong></span>
      </div>
      <div class="cat-nap-desc">
        Retire 15 cats, pick 1 to carry (with gear) into a new run. Kept cat gains <strong>Veteran +1</strong> (all base stats +1).
      </div>
      <div class="cat-nap-meta">Prestige count: ${gameState.prestigeCount || 0} · Run high tier: T${gameState.highestTier || 0}</div>
      <button class="cat-nap-btn" id="cat-nap-btn" ${canNap ? "" : "disabled"} title="${canNap ? `Prestige for +${preview}\uD83C\uDF00 Nine Lives. You'll pick which cat(s) to keep.` : reason}">${canNap ? "Begin Cat Nap\u2026" : reason}</button>
    </div>`;
}

function openCatNapModal() {
  if (gameState.missions.length) {
    alert("Finish all active missions before a Cat Nap.");
    return;
  }
  const idle = gameState.cats.filter(c => c.status === "idle");
  if (!idle.length) { alert("No idle cats to carry forward."); return; }
  uiState.napSelected = new Set();
  renderCatNapModal();
  $("#modal").classList.add("open");
}

function renderCatNapModal() {
  const body = $("#modal-body");
  if (!body) return;
  const idle = gameState.cats.filter(c => c.status === "idle");
  const preview = nineLivesPreview();
  const cap = catNapKeepCount();
  const selected = uiState.napSelected || new Set();
  const capHit = selected.size >= cap;

  const catRows = idle.map(cat => {
    const breed = CAT_BREEDS[cat.breed];
    const vet = cat.veteranLevel ? ` · Vet ${toRoman(cat.veteranLevel)}` : "";
    const gearCount = ITEM_SLOTS.reduce((n, s) => n + (cat.equipped[s] ? 1 : 0), 0);
    const isSel = selected.has(cat.id);
    const canToggle = isSel || !capHit;
    return `<label class="nap-cat-row ${isSel ? "selected" : ""} ${canToggle ? "" : "disabled"}">
      <input type="checkbox" data-nap-toggle="${cat.id}" ${isSel ? "checked" : ""} ${canToggle ? "" : "disabled"}>
      <div class="equip-cat-line">${escapeHtml(cat.name)} · ${breed.classLabel} Lv${cat.level}${vet}</div>
      <div class="equip-delta muted">Carries ${gearCount} equipped item${gearCount === 1 ? "" : "s"}. Veteran ${toRoman((cat.veteranLevel || 0) + 1)} after nap.</div>
    </label>`;
  }).join("");

  const retireCount = gameState.cats.length - selected.size;
  const confirmDisabled = selected.size === 0;
  body.innerHTML = `
    <h3>\u{1F4A4} Cat Nap</h3>
    <p>You'll earn <strong>+${preview} \uD83C\uDF00 Nine Lives</strong>. Pick up to <strong>${cap}</strong> cat${cap > 1 ? "s" : ""} to carry forward with their gear; the other ${retireCount} retire${retireCount === 1 ? "s" : ""} to the Lounge.</p>
    <p class="muted">Selected: ${selected.size}/${cap}${cap > 1 ? " \u2014 raise the cap with the Cherished Companion Eternal Perk." : ""}</p>
    <div class="picker-list nap-list">${catRows}</div>
    <div class="modal-actions">
      <button data-modal-close>Cancel</button>
      <button class="btn-primary" id="cat-nap-confirm" ${confirmDisabled ? "disabled" : ""}>Begin Nap (${selected.size})</button>
    </div>`;
}

function renderLog() {
  const host = $("#log-panel");
  host.innerHTML = gameState.log.map(entry => {
    const time = new Date(entry.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `<div class="log-entry"><span class="log-time">${time}</span> ${escapeHtml(entry.msg)}</div>`;
  }).join("");
}

// --- Active missions strip ---------------------------------------------

function renderActiveMissions() {
  const host = $("#missions-active-panel");
  const queue = gameState.missionQueue || [];
  // Small count badge in the footer heading: "3 running · 2 queued". Gives at-a-glance
  // totals even when the rows scroll off the visible area.
  const badge = $("#active-count-badge");
  if (badge) {
    const running = gameState.missions.length;
    if (!running && !queue.length) {
      badge.style.display = "none";
    } else {
      const parts = [];
      if (running)    parts.push(`${running} running`);
      if (queue.length) parts.push(`${queue.length} queued`);
      badge.textContent = parts.join(" \u00B7 ");
      badge.style.display = "";
    }
  }
  if (!gameState.missions.length && !queue.length) {
    host.innerHTML = `<div class="empty-state">No active missions.</div>`;
    return;
  }
  host.innerHTML = "";
  for (const m of gameState.missions) {
    const hood = NEIGHBORHOODS[m.neighborhoodId];
    const cats = m.catIds.map(findCat).filter(Boolean);
    const row = document.createElement("div");
    row.className = "active-row";
    row.dataset.activeId = m.id;
    // Per-mission "Come Home" button lives here too — natural for multi-cat parties
    // where the per-cat button is ambiguous ("which card do I click?"). Uses the same
    // cancelAutoRepeat plumbing; this button just targets any cat on the mission.
    const comeHomeBtn = m.autoRepeat && cats.length
      ? `<button class="active-come-home" data-active-come-home="${m.id}" title="Stop auto-repeat \u2014 this party comes home after the current mission.">\uD83C\uDFE0 come home</button>`
      : "";
    row.innerHTML = `
      <div class="active-party">${escapeHtml(cats.map(c => c.name).join(", ")) || "?"}</div>
      <div class="active-mission" style="--hood-color: ${hood.color}">${hood.icon} T${m.tier} ${hood.name}</div>
      <div class="active-bar"><div class="active-fill"></div></div>
      <div class="active-eta"></div>
      ${comeHomeBtn}`;
    host.appendChild(row);
  }
  // Queued missions appear below active ones with a "cancel" handle.
  for (const q of queue) {
    const hood = NEIGHBORHOODS[q.neighborhoodId];
    const cats = q.catIds.map(findCat).filter(Boolean);
    const row = document.createElement("div");
    row.className = "active-row queued-row";
    row.innerHTML = `
      <div class="active-party muted">${escapeHtml(cats.map(c => c.name).join(", ")) || "?"}</div>
      <div class="active-mission muted" style="--hood-color: ${hood.color}">${hood.icon} T${q.tier} ${hood.name}</div>
      <div class="active-bar"><div class="active-fill queued-fill"></div></div>
      <div class="active-eta"><button class="queue-cancel-btn" data-queue-cancel="${q.id}" title="Remove from queue">\u2715</button></div>`;
    host.appendChild(row);
  }
}

function tickActiveBars() {
  const now = Date.now();
  for (const m of gameState.missions) {
    const row = $(`.active-row[data-active-id="${m.id}"]`);
    if (!row) continue;
    const pct = Math.min(100, ((now - m.startedAt) / m.durationMs) * 100);
    $(".active-fill", row).style.width = pct + "%";
    const remaining = Math.max(0, (m.startedAt + m.durationMs) - now);
    $(".active-eta", row).textContent = remaining ? formatDuration(remaining) : "returning…";
  }
  // Fishing bar — live update without re-rendering the whole panel.
  // Skip entirely if fishing is still locked; the panel shows a static locked message.
  const cast = isFishingUnlocked() ? gameState.fishing?.cast : null;
  const panel = document.querySelector("#fishing-panel");
  // Bite-state transitions re-render the panel. Crucially we check this OUTSIDE the
  // `if (cast && ...)` block so the "missed → none" transition (cast finishes and
  // resolves) is caught — otherwise the UI froze on "Reeling slowly…" forever.
  if (panel) {
    const biteState = fishingBiteState(now);
    if (panel.dataset.biteState !== biteState) {
      renderFishing();
    }
  }
  const fillEl = panel?.querySelector(".fish-bar-fill");
  const etaEl  = panel?.querySelector(".fish-eta");
  if (cast && fillEl && etaEl) {
    const pct = Math.min(100, ((now - cast.startedAt) / cast.durationMs) * 100);
    fillEl.style.width = pct + "%";
    const remaining = Math.max(0, (cast.startedAt + cast.durationMs) - now);
    etaEl.textContent = remaining ? `Nibbling \u00B7 ${formatMs(remaining)}` : "Reeling\u2026";
  }
  // Garden plot bars — same idea.
  for (let i = 0; i < (gameState.garden?.plots?.length || 0); i++) {
    const plot = gameState.garden.plots[i];
    if (!plot) continue;
    const plotEl = document.querySelectorAll("#garden-panel .plot")[i];
    if (!plotEl) continue;
    const barFill = plotEl.querySelector(".plot-bar-fill");
    const etaEl2 = plotEl.querySelector(".plot-eta");
    if (!barFill || !etaEl2) continue;
    const remaining = Math.max(0, plot.finishedAt - now);
    const total = plot.finishedAt - plot.plantedAt;
    const pct = Math.max(0, Math.min(100, 100 * (1 - remaining / total)));
    barFill.style.width = pct + "%";
    etaEl2.textContent = remaining <= 0 ? "Ready to harvest!" : formatMs(remaining);
  }
  // Live reset chips on daily/boss cards — these were static on render; now they tick.
  // Rendered text updates are cheap even at 60fps; only the visible cards get touched.
  const dailyMs = msUntilDailyReset(now);
  for (const el of document.querySelectorAll(".daily-meta .reset-timer")) {
    el.textContent = `\u23F1 ${formatDuration(dailyMs)}`;
  }
  const weeklyMs = msUntilWeeklyReset(now);
  for (const el of document.querySelectorAll(".boss-desc .reset-timer")) {
    el.textContent = `\u23F1 ${formatDuration(weeklyMs)}`;
  }
  // Research bar — tick smoothly without re-rendering the whole panel. On completion the
  // next tick() call in main.js will re-render and flip the node to "done".
  const rActive = gameState.research?.active;
  const rPanel = document.querySelector("#research-panel");
  if (rActive && rPanel) {
    const fillEl = rPanel.querySelector(".research-bar-fill");
    const etaEl  = rPanel.querySelector(".research-eta");
    if (fillEl && etaEl) {
      const total = rActive.completesAt - rActive.startedAt;
      const remaining = Math.max(0, rActive.completesAt - now);
      const pct = Math.max(0, Math.min(100, 100 * (1 - remaining / total)));
      fillEl.style.width = pct + "%";
      etaEl.textContent = remaining > 0 ? formatDuration(remaining) : "Finalizing\u2026";
    }
  }

  // Cat cards: show live mission ETA on the status line for cats currently out on a mission.
  // Stationed cats keep their station label (no countdown for an open-ended station post).
  // Only mutates .cat-status-text so the adjacent "come home" button keeps its state.
  for (const cat of gameState.cats) {
    if (cat.status !== "mission" || !cat.missionId) continue;
    const m = gameState.missions.find(x => x.id === cat.missionId);
    if (!m) continue;
    const card = document.querySelector(`.cat-card[data-cat-id="${cat.id}"]`);
    const statusText = card?.querySelector(".cat-status-text");
    if (!statusText) continue;
    const remaining = Math.max(0, (m.startedAt + m.durationMs) - now);
    statusText.textContent = remaining ? `\u2694\uFE0F ${formatDuration(remaining)}` : "\u2694\uFE0F returning\u2026";
  }
}

// --- Mission picker modal ------------------------------------------------

function openMissionPicker(neighborhoodId, tier) {
  const mission = getMission(neighborhoodId, tier);
  if (!mission) return;
  uiState.picker = {
    neighborhoodId,
    tier,
    mission,
    selected: new Set(),
    searchForStrays: gameState.cats.length < clubMax()
  };
  renderPicker();
  $("#modal").classList.add("open");
}

function openDailyPicker(dailyId) {
  const daily = (gameState.dailyChallenges || []).find(d => d.id === dailyId);
  if (!daily || daily.completed) return;
  const mission = buildDailyMission(daily);
  uiState.picker = {
    neighborhoodId: mission.neighborhoodId,
    tier: mission.tier,
    mission,
    isDaily: true,
    selected: new Set(),
    searchForStrays: gameState.cats.length < clubMax()
  };
  renderPicker();
  $("#modal").classList.add("open");
}

function openBossPicker() {
  if (!gameState.weeklyBoss || gameState.weeklyBoss.completed) return;
  const mission = buildBossMission(gameState.weeklyBoss);
  uiState.picker = {
    neighborhoodId: mission.neighborhoodId,
    tier: mission.tier,
    mission,
    isBoss: true,
    selected: new Set(),
    searchForStrays: false // boss doesn't search for strays
  };
  renderPicker();
  $("#modal").classList.add("open");
}

function renderPicker() {
  const body = $("#modal-body");
  const p = uiState.picker;
  if (!p) return;
  const mission = p.mission || getMission(p.neighborhoodId, p.tier);
  const hood = NEIGHBORHOODS[p.neighborhoodId];
  const idle = gameState.cats.filter(c => c.status === "idle");

  // live score with neighborhood-effect adjustment
  const selectedIds = Array.from(p.selected);
  const score = selectedIds.length ? partyScore(selectedIds, mission) : 0;
  const summary = missionEffectsSummary(selectedIds, mission);
  const margin = score - summary.effectiveDC;
  const verdict = !selectedIds.length ? "pick a cat"
    : margin >= 6 ? "likely crit"
    : margin >= 0 ? "favored"
    : margin >= -4 ? "risky"
    : "doomed";

  p.abilityActivations = p.abilityActivations || {}; // { catId: abilityId }
  const catRows = idle.map(cat => {
    const selected = p.selected.has(cat.id);
    const disabled = !selected && p.selected.size >= partyMax();
    const eff = effectiveStats(cat);
    const checkTotal = mission.primaryChecks.reduce((s, st) => s + eff[st], 0);
    const breed = CAT_BREEDS[cat.breed];
    // Count this cat's matching-element gear pieces for a quick hint.
    const matching = ITEM_SLOTS.reduce((n, slot) => {
      const item = findItem(cat.equipped[slot]);
      return n + (item && item.affinity === p.neighborhoodId ? 1 : 0);
    }, 0);
    const matchTxt = matching ? ` · ${hood.icon}\u00D7${matching}` : "";

    // Active ability chip — only shown when the cat is selected AND has charges.
    const ability = catAbility(cat);
    const charges = catAbilityAvailable(cat);
    const max = catAbilityMaxCharges(cat);
    const chipActive = !!p.abilityActivations[cat.id];
    const showChip = selected && ability && charges > 0;
    const abilityChip = showChip ? `
      <button type="button" class="ability-chip ${chipActive ? "active" : ""}"
        data-ability-toggle="${cat.id}"
        title="${escapeHtml(ability.desc)} Charges: ${charges}/${max}">
        ${ability.icon} ${escapeHtml(ability.name)}${chipActive ? " \u2713" : ""}
      </button>` : "";

    return `<label class="picker-cat ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}">
      <input type="checkbox" data-pick-cat="${cat.id}" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""}/>
      <span class="picker-name">${escapeHtml(cat.name)} · ${breed.classLabel} Lv${cat.level}</span>
      <span class="picker-score">${STAT_LABELS[mission.primaryChecks[0]]} ${eff[mission.primaryChecks[0]]} · ${STAT_LABELS[mission.primaryChecks[1]]} ${eff[mission.primaryChecks[1]]} (${checkTotal})${matchTxt}</span>
      ${abilityChip}
    </label>`;
  }).join("");

  const full = gameState.cats.length >= clubMax();
  const pendingSummons = gameState.shop?.pendingStraySummons || 0;
  const pendingBonus   = gameState.shop?.pendingStrayBonus   || 0;
  const baseChance = (STRAY_BASE_CHANCE + (p.tier - 1) * STRAY_TIER_BONUS);
  let strayHint = "";
  if (p.searchForStrays && !full) {
    if (pendingSummons > 0) {
      strayHint = ` <span class="stray-hint">\u2014 guaranteed (consumes 1 Summons)</span>`;
    } else {
      const pct = Math.min(1, baseChance + pendingBonus);
      const bonusTxt = pendingBonus > 0 ? ` (base ${Math.round(baseChance * 100)}% +${Math.round(pendingBonus * 100)}% consumable)` : "";
      strayHint = ` <span class="stray-hint">\u2014 ~${Math.round(pct * 100)}% chance${bonusTxt}</span>`;
    }
  }
  const strayToggle = `
    <label class="stray-toggle ${full ? "disabled" : ""}">
      <input type="checkbox" id="stray-checkbox" ${p.searchForStrays ? "checked" : ""} ${full ? "disabled" : ""}/>
      <span>Search for strays${full ? " (club is full)" : ""}${strayHint}</span>
    </label>`;

  // Auto-repeat toggle — regular tier missions only. Commissioned/daily/boss missions are
  // one-shots by design (they cost treaties, reset weekly, etc.) so there's no sensible
  // re-fire. The toggle is purely opt-in and stored on the active record at start.
  const canAutoRepeat = !p.isDaily && !p.isBoss && !p.isCommission;
  const autoRepeatToggle = canAutoRepeat ? `
    <label class="auto-repeat-toggle">
      <input type="checkbox" id="auto-repeat-checkbox" ${p.autoRepeat ? "checked" : ""}/>
      <span>Auto-repeat when this party returns <span class="stray-hint">\u2014 same party, same mission, stops if anyone goes missing</span></span>
    </label>` : "";

  // Hazards breakdown
  const hazardRows = summary.effects.map(e => {
    const cls = e.remaining === 0 ? "hazard-mitigated"
      : e.mitigated > 0 ? "hazard-partial"
      : "hazard-full";
    const right = e.remaining === 0 ? "mitigated" : `+${e.remaining} DC`;
    return `<div class="hazard-row ${cls}">
      <span class="hazard-name">${escapeHtml(e.name)}</span>
      <span class="hazard-desc">${escapeHtml(e.desc)}</span>
      <span class="hazard-value">${right}</span>
    </div>`;
  }).join("");
  const hazardBlock = summary.effects.length ? `
    <div class="picker-hazards">
      <div class="picker-hazards-head">
        <span>Hazards @ ${hood.icon} ${hood.name}</span>
        <span class="muted">Mitigation pool: ${summary.mitigation} / ${summary.totalSeverity}</span>
      </div>
      ${hazardRows}
    </div>` : "";

  const dcDisplay = summary.netPenalty > 0
    ? `DC ${mission.difficulty}+${summary.netPenalty}=<strong>${summary.effectiveDC}</strong>`
    : `DC <strong>${mission.difficulty}</strong>`;

  const partyBonus = selectedIds.length > 1 ? 1 + (selectedIds.length - 1) * 0.15 : 1;
  const rewardHint = partyBonus > 1 ? ` · rewards \u00D7${partyBonus.toFixed(2)}` : "";

  // Class-passive badges for the currently selected party.
  const passives = partyPassives(selectedIds);
  const passiveChips = [];
  if (passives.mit)         passiveChips.push(`<span class="pass-chip pass-mit"    title="Mitigation: absorbs hazard severity before it raises the mission's DC.">\u2694 +${passives.mit} mitigation</span>`);
  if (passives.lootPct)     passiveChips.push(`<span class="pass-chip pass-loot"   title="Added to each cat's loot roll chance this mission.">\u273F +${Math.round(passives.lootPct * 100)}% loot</span>`);
  if (passives.speedPct)    passiveChips.push(`<span class="pass-chip pass-speed"  title="Cuts this mission's duration. Caps at 50% total from passives.">\u2756 -${Math.round(passives.speedPct * 100)}% time</span>`);
  if (passives.floorPct)    passiveChips.push(`<span class="pass-chip pass-floor"  title="On fail, reward payout rises by this much (cap 0.9 of success rewards, or 0.95 with Sanctuary).">\u271A +${Math.round(passives.floorPct * 100)}% floor</span>`);
  if (passives.xpPct)       passiveChips.push(`<span class="pass-chip pass-xp"     title="Each cat gains this much extra XP on resolve.">\u266A +${Math.round(passives.xpPct * 100)}% XP</span>`);
  if (passives.rarityShift) passiveChips.push(`<span class="pass-chip pass-rarity" title="Shifts loot rolls toward rarer outcomes (small fish \u2192 big fish \u2192 rare gear).">\u2726 +${passives.rarityShift} rarity shift</span>`);
  const passivesBlock = passiveChips.length ? `<div class="picker-passives">${passiveChips.join("")}</div>` : "";

  // Synergy badges — show when the current party triggers a party-wide bonus combo.
  const syns = activeSynergies(selectedIds);
  const synergyChips = syns.map(s =>
    `<span class="pass-chip pass-synergy" title="${escapeHtml(s.desc)}">${s.icon} ${escapeHtml(s.name)}</span>`
  ).join("");
  const synergyBlock = synergyChips ? `<div class="picker-passives picker-synergies">${synergyChips}</div>` : "";

  // Bonded-pair indicator — shows +3 score / +2% loot per bonded pair currently in the party.
  const bondCount = bondedPairsInParty(selectedIds);
  const bondChip = bondCount > 0
    ? `<span class="pass-chip pass-bond" title="Bonded pairs grant +${BOND_SCORE_BONUS} score and +${Math.round(BOND_LOOT_PCT_BONUS * 100)}% loot each.">\u{1F49E} ${bondCount} bonded pair${bondCount > 1 ? "s" : ""}</span>`
    : "";

  // Gear-set indicator — any matching-element set of 2+ pieces across the party.
  const setCounts = partyGearSets(selectedIds);
  const setChips = NEIGHBORHOOD_IDS.map(id => {
    const n = setCounts[id];
    if (n < 2) return "";
    const hood = NEIGHBORHOODS[id];
    const tierTxt = n >= 4 ? "4-piece" : "2-piece";
    const matching = id === uiState.picker?.neighborhoodId;
    const tip = matching
      ? `${tierTxt} ${hood.name} set: +${n >= 4 ? 4 : 1} mitigation here${n >= 4 ? ", +3% loot globally" : ""}.`
      : `${tierTxt} ${hood.name} set${n >= 4 ? ": +3% loot globally" : " (no mit bonus — wrong hood)"}`;
    return `<span class="pass-chip pass-set" title="${escapeHtml(tip)}">${hood.icon} ${tierTxt}</span>`;
  }).filter(Boolean).join("");
  const setBlock = (bondChip || setChips) ? `<div class="picker-passives picker-sets">${bondChip}${setChips}</div>` : "";

  // "Use last party" link — show if any of the last party's cats are still idle.
  const lastParty = (gameState.lastParty || []).filter(id => {
    const c = findCat(id);
    return c && c.status === "idle";
  });
  const lastPartyLink = lastParty.length
    ? `<button class="picker-last-party" id="picker-last-party" title="Select the same cats as your most recent mission (idle ones only).">\u21BA Use last party (${lastParty.length})</button>`
    : "";

  // Party presets — three slots, each independently save/load/clear.
  const presets = gameState.partyPresets || [null, null, null];
  const currentSize = p.selected.size;
  const presetRows = [0, 1, 2].map(i => {
    const preset = presets[i];
    if (preset && preset.catIds?.length) {
      // Show how many of this preset's cats are currently loadable (idle + in roster).
      const loadable = preset.catIds.filter(id => {
        const c = findCat(id);
        return c && c.status === "idle";
      }).length;
      const names = preset.catIds.map(id => findCat(id)?.name).filter(Boolean).join(", ") || "(cats retired)";
      return `<div class="picker-preset">
        <span class="picker-preset-label">Preset ${i + 1}:</span>
        <span class="picker-preset-names muted" title="${escapeHtml(names)}">${escapeHtml(names)}</span>
        <button class="picker-preset-btn" data-preset-load="${i}" ${loadable ? "" : "disabled"} title="Select these ${loadable} idle cat${loadable === 1 ? "" : "s"} for this mission. Retired or busy cats from the saved preset are skipped.">Load (${loadable})</button>
        <button class="picker-preset-btn" data-preset-save="${i}" ${currentSize ? "" : "disabled"} title="Overwrite preset ${i + 1} with the currently-selected cats.">Save</button>
      </div>`;
    }
    return `<div class="picker-preset">
      <span class="picker-preset-label">Preset ${i + 1}:</span>
      <span class="picker-preset-names muted">empty</span>
      <button class="picker-preset-btn picker-preset-btn-single" data-preset-save="${i}" ${currentSize ? "" : "disabled"}>Save current</button>
    </div>`;
  }).join("");
  const presetBlock = `<div class="picker-presets">${presetRows}</div>`;

  body.innerHTML = `
    <h3>${hood.icon} T${p.tier} ${hood.name}</h3>
    <p class="muted">Check: ${mission.primaryChecks.map(s => STAT_LABELS[s]).join(" / ")} · Duration ${formatDuration(mission.duration)} · Party 1\u2013${partyMax()}</p>
    <div class="picker-scoreboard">
      <span>Party score: <strong>${score}</strong> vs ${dcDisplay}<span class="muted">${rewardHint}</span></span>
      <span class="picker-verdict verdict-${verdict.replace(/\s+/g, "-")}">${verdict}</span>
    </div>
    ${passivesBlock}
    ${synergyBlock}
    ${setBlock}
    ${hazardBlock}
    ${lastPartyLink}
    ${presetBlock}
    <div class="picker-list">${catRows || '<div class="empty-state">No idle cats available.</div>'}</div>
    ${strayToggle}
    ${autoRepeatToggle}
    <div class="modal-actions">
      <button data-modal-close>Cancel</button>
      ${(p.isDaily || p.isBoss || p.isCommission) ? "" : `<button id="picker-queue" ${selectedIds.length ? "" : "disabled"} title="Add this mission to the end of the queue — fires once these cats are idle.">Queue</button>`}
      <button class="btn-primary" id="picker-start" ${selectedIds.length ? "" : "disabled"}>Send party</button>
    </div>`;
}

// --- Item action modal --------------------------------------------------

function openItemAction(itemId) {
  const item = findItem(itemId);
  if (!item) return;
  const body = $("#modal-body");
  const sellValue = Math.max(1, RARITY_TIERS[item.rarity].bonusValue * 10);
  const hood = NEIGHBORHOODS[item.affinity];
  const equipButtons = gameState.cats.map(cat => {
    const current = findItem(cat.equipped[item.type]);
    const currentTxt = current ? ` (replaces ${escapeHtml(current.name)})` : "";

    // Compute stat deltas by simulating the swap against effectiveStats.
    const before = effectiveStats(cat);
    const prevId = cat.equipped[item.type];
    cat.equipped[item.type] = item.id;
    const after = effectiveStats(cat);
    cat.equipped[item.type] = prevId;
    const deltaChips = [];
    for (const s of STATS) {
      const d = after[s] - before[s];
      if (d > 0) deltaChips.push(`<span class="delta delta-up">+${d} ${STAT_LABELS[s]}</span>`);
      else if (d < 0) deltaChips.push(`<span class="delta delta-down">${d} ${STAT_LABELS[s]}</span>`);
    }
    const deltaRow = deltaChips.length
      ? `<div class="equip-delta">${deltaChips.join(" ")}</div>`
      : `<div class="equip-delta muted">no stat change</div>`;

    return `<button class="picker-cat-btn" data-equip-cat="${cat.id}" data-equip-item="${item.id}">
      <div class="equip-cat-line">Equip on ${escapeHtml(cat.name)}${currentTxt}</div>
      ${deltaRow}
    </button>`;
  }).join("");
  body.innerHTML = `
    <h3 class="rarity-${item.rarity}">${escapeHtml(item.name)}</h3>
    <p class="muted">${item.type} · ${describeBonus(item.bonus)} · affinity: ${hood.icon} ${hood.name}</p>
    <div class="picker-list">${equipButtons}</div>
    <div class="modal-actions">
      <button class="btn-sell" data-sell-item="${item.id}">Sell for ${sellValue}g</button>
      <button data-modal-close>Cancel</button>
    </div>`;
  $("#modal").classList.add("open");
}

// --- Offline return modal ----------------------------------------------

function openOfflineModal(summary) {
  if (!summary.resolved.length) return;
  const body = $("#modal-body");
  const totalGold    = summary.resolved.reduce((s, r) => s + (r.gold     || 0), 0);
  const totalFish    = summary.resolved.reduce((s, r) => s + (r.fishes   || 0), 0);
  const totalTreaty  = summary.resolved.reduce((s, r) => s + (r.treaties || 0), 0);
  const totalLoot    = summary.resolved.reduce((s, r) => s + r.items.length, 0);
  const list = summary.resolved.map(r => {
    const hood = NEIGHBORHOODS[r.neighborhoodId];
    const loot = r.items.map(i => i.name).join(", ");
    const lootTxt = loot ? ` + ${loot}` : "";
    const fishTxt = r.fishes ? `, +${r.fishes}🐟` : "";
    const treatyTxt = r.treaties ? `, +${r.treaties}🎀` : "";
    let hazardTxt = "";
    if (r.outcome === "fail" && r.topUnmitigated) {
      hazardTxt = ` <span class="muted">— ${escapeHtml(r.topUnmitigated.name)} (+${r.topUnmitigated.remaining})</span>`;
    } else if (r.netPenalty > 0) {
      hazardTxt = ` <span class="muted">— hazards +${r.netPenalty} DC</span>`;
    }
    return `<li>${escapeHtml(r.catNames.join(", "))} @ ${hood.icon} T${r.tier} ${hood.name} — ${r.outcome} (+${r.gold}💰${fishTxt}${treatyTxt}${lootTxt})${hazardTxt}</li>`;
  }).join("");
  body.innerHTML = `
    <h3>While you were gone (${formatDuration(summary.elapsed)})\u2026</h3>
    <p>${summary.resolved.length} missions finished. +${totalGold}💰${totalFish ? `, +${totalFish}🐟` : ""}${totalTreaty ? `, +${totalTreaty}🎀` : ""}, ${totalLoot} item(s).</p>
    <ul class="offline-list">${list}</ul>
    <div class="modal-actions"><button class="btn-primary" data-modal-close>Nice!</button></div>`;
  $("#modal").classList.add("open");

  // Queue stray offers from offline catchup.
  for (const r of summary.resolved) {
    if (r.strayOffer) uiState.strayQueue.push(r.strayOffer);
  }
}

// --- Golden Mouse modal -------------------------------------------------

function openGoldenMouseModal() {
  const body = $("#modal-body");
  if (!body) return;
  // Drain the queued event AT open-time so Escape-closing doesn't leave it stuck.
  // The choice/dismiss buttons no longer need to shift themselves — they just trigger
  // the effect + close.
  const event = (gameState.goldenMouseQueue || []).shift();
  if (event) logEvent("\u{1F9C0} A glittering mouse scurries past the club window\u2026");
  const choices = GOLDEN_MOUSE_CHOICES.map(choice => {
    const costTxt = Object.entries(choice.cost || {}).map(([k, v]) => `${v}${k === "fishes" ? "\uD83D\uDC1F" : k === "treaties" ? "\uD83C\uDF80" : "\uD83D\uDCB0"}`).join(" ");
    const afford = canAfford(choice.cost || {});
    return `<button class="mouse-choice" data-mouse-choice="${choice.id}" ${afford ? "" : "disabled"} title="${escapeHtml(choice.desc)}">
      <div class="mouse-choice-head">${escapeHtml(choice.label)} ${costTxt ? `<span class="muted">· ${costTxt}</span>` : `<span class="muted">· free</span>`}</div>
      <div class="mouse-choice-desc muted">${escapeHtml(choice.desc)}</div>
    </button>`;
  }).join("");
  body.innerHTML = `
    <h3>\u{1F9C0} A Golden Mouse!</h3>
    <p>A glittering mouse scurries past the club window. Your cats perk up \u2014 what do you do?</p>
    <div class="mouse-choices">${choices}</div>
    <div class="modal-actions"><button data-modal-close id="mouse-dismiss">Pretend you didn't see it</button></div>`;
  $("#modal").classList.add("open");
}

// Present the next queued Golden Mouse, if any and no modal is currently open.
function presentNextGoldenMouse() {
  const q = gameState.goldenMouseQueue || [];
  if (!q.length) return;
  const modal = $("#modal");
  if (modal && modal.classList.contains("open")) return;
  openGoldenMouseModal();
}

// --- Welcome modal (first-run onboarding) ------------------------------

function openWelcomeModal() {
  const body = $("#modal-body");
  if (!body) return;
  body.innerHTML = `
    <h3>\u{1F408} Welcome to the Cat Adventure Club</h3>
    <p>You run a rescue for adventuring cats. Here's the 30-second tour:</p>
    <ol class="welcome-steps">
      <li>Your starter is a <strong>Scrapper</strong> \u2014 strong in <strong>STR</strong> and <strong>CON</strong>. That matches <strong>The Park</strong>.</li>
      <li>In the middle column, click <strong>Plan</strong> on <strong>Park T1</strong>, pick your cat, and Send.</li>
      <li>Missions run on real-time timers. Close the tab if you want \u2014 your cats keep working and the rewards wait.</li>
      <li>Gold unlocks higher tiers. Strays sometimes ask to join. Retired cats keep training the younger ones.</li>
      <li>Stuck? A <strong>Cat Nap</strong> restarts the run with a permanent bonus carried forward.</li>
    </ol>
    <p class="muted">Panels on the right unfold as you unlock them. Hover any chip or cell for details.</p>
    <div class="modal-actions">
      <button class="btn-primary" id="welcome-dismiss">Start exploring \u2192</button>
    </div>`;
  $("#modal").classList.add("open");
}

// --- Stray offer modal -------------------------------------------------

function openStrayModal(cat) {
  uiState.currentStray = cat;
  const body = $("#modal-body");
  const breed = CAT_BREEDS[cat.breed];
  const statsHtml = STATS.map(s => {
    return `<div class="stat"><span class="stat-label">${STAT_LABELS[s]}</span><span class="stat-value">${cat.stats[s]}</span></div>`;
  }).join("");
  body.innerHTML = `
    <h3>\uD83D\uDC3E A stray approaches\u2026</h3>
    <p><strong>${escapeHtml(cat.name)}</strong> — ${breed.classLabel} · ${breed.name}</p>
    <p class="muted">${breed.blurb}</p>
    <div class="stray-preview">
      <canvas id="stray-canvas" width="140" height="140"></canvas>
      <div class="stats-grid" style="margin-top:8px">${statsHtml}</div>
    </div>
    <div class="modal-actions">
      <button data-decline-stray>Decline</button>
      <button class="btn-primary" data-accept-stray>Invite to club</button>
    </div>`;
  $("#modal").classList.add("open");
  const ctx = $("#stray-canvas").getContext("2d");
  drawCat(ctx, cat, { width: 140, height: 140 });
  // Keep redrawing for tail wag while modal is open.
  (function loop() {
    if (!$("#stray-canvas")) return;
    drawCat(ctx, cat, { width: 140, height: 140 });
    requestAnimationFrame(loop);
  })();
}

function presentNextStray() {
  if (!uiState.strayQueue.length) return false;
  const modal = $("#modal");
  if (modal.classList.contains("open")) return false; // wait for current modal to close
  const next = uiState.strayQueue.shift();
  openStrayModal(next);
  return true;
}

// --- Toasts --------------------------------------------------------------

// Small floating notices for delightful moments. Shorter-lived than mission toasts.
function showFlashToast(icon, title, subtitle, flavorClass) {
  const host = $("#toast-stack");
  if (!host) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-flash ${flavorClass || ""}`;
  toast.innerHTML = `
    <div class="toast-head">
      <span class="toast-outcome">${icon} ${escapeHtml(title)}</span>
    </div>
    ${subtitle ? `<div class="toast-body">${escapeHtml(subtitle)}</div>` : ""}`;
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 350);
  }, 2800);
}

// Drain any flash events queued by game.js during a tick. Coalesces multi-level-ups on
// the same cat into a single toast showing the final level.
function presentQueuedFlashes() {
  const q = gameState._flashQueue;
  if (!Array.isArray(q) || !q.length) return;
  // Coalesce level-ups per cat: keep only the highest level reached in this batch.
  const levelUps = new Map();
  const others = [];
  for (const ev of q) {
    if (ev.type === "levelUp") {
      const prev = levelUps.get(ev.catId);
      if (!prev || ev.level > prev.level) levelUps.set(ev.catId, ev);
    } else {
      others.push(ev);
    }
  }
  for (const ev of levelUps.values()) {
    showFlashToast("\u{1F38A}", `${ev.name} \u2192 Lv ${ev.level}`, null, "toast-levelup");
  }
  for (const ev of others) {
    if (ev.type === "legendary") {
      showFlashToast("\u2728", "Legendary drop!", ev.itemName, "toast-legendary");
    } else if (ev.type === "research") {
      showFlashToast("\uD83D\uDCDA", "Research complete", ev.name, "toast-research");
    } else if (ev.type === "napNudge") {
      showFlashToast("\u{1F4A4}", "Cat Nap ready", `+${ev.preview}\uD83C\uDF00 waiting \u2014 check Eternal Perks.`, "toast-nap");
    }
  }
  gameState._flashQueue = [];
}

function showMissionToast(r) {
  const host = $("#toast-stack");
  if (!host) return;
  const hood = NEIGHBORHOODS[r.neighborhoodId];
  const outcomeIcon = r.outcome === "crit" ? "\u2B50" : r.outcome === "success" ? "\u2705" : "\u26A0\uFE0F";
  const parts = [`+${r.gold}\uD83D\uDCB0`];
  if (r.fishes)   parts.push(`+${r.fishes}\uD83D\uDC1F`);
  if (r.treaties) parts.push(`+${r.treaties}\uD83C\uDF80`);
  if (r.items.length) parts.push(`+${r.items.length} loot`);
  const hazardLine = (r.outcome === "fail" && r.topUnmitigated)
    ? `<div class="toast-hazard">${escapeHtml(r.topUnmitigated.name)} (+${r.topUnmitigated.remaining}) overwhelmed them.</div>`
    : "";

  const toast = document.createElement("div");
  toast.className = `toast toast-${r.outcome}`;
  toast.innerHTML = `
    <div class="toast-head">
      <span class="toast-outcome">${outcomeIcon} ${r.outcome.toUpperCase()}</span>
      <span class="toast-zone">${hood.icon} T${r.tier} ${hood.name}</span>
    </div>
    <div class="toast-body">${escapeHtml(r.catNames.join(", "))}</div>
    <div class="toast-rewards">${parts.join(" \u00B7 ")}</div>
    ${hazardLine}`;
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 350);
  }, 5000);
}

function closeModal() {
  $("#modal").classList.remove("open");
  $("#modal-body").innerHTML = "";
  uiState.picker = null;
  // Source of truth for "is there a stray up right now" — presentNextStray bails on
  // truthy, so clearing here lets subsequent queued strays open.
  uiState.currentStray = null;
  // Chain to any queued follow-up modals so they open automatically.
  setTimeout(() => { presentNextStray(); presentNextGoldenMouse(); }, 0);
}

// --- Full render orchestrator -------------------------------------------

// Panels start collapsed; each one auto-opens the first time its trigger fires so the
// player isn't greeted with 14 detailed panels on fresh load. Once auto-opened, the flag
// persists — if the player manually re-collapses, we respect that and don't force it open.
const AUTO_OPEN_RULES = [
  { id: "club-details",        trigger: () => (gameState.clubLevel || 1) >= 2 },
  { id: "achievement-details", trigger: () => Object.values(gameState.achievements || {}).some(a => a.claimed) },
  { id: "bestiary-details",    trigger: () => BESTIARY.some(c => bestiaryTier(c.id) >= 1) },
  { id: "mastery-details",     trigger: () => ITEM_SLOTS.some(slot => slotMasteryLevel(slot) >= 1) },
  { id: "eternal-details",     trigger: () => (gameState.prestigeCount || 0) >= 1 || (gameState.nineLives || 0) > 0 || nineLivesPreview() >= 5 },
  { id: "challenges-details",  trigger: () => (gameState.prestigeCount || 0) >= 1 },
  { id: "stars-details",       trigger: () => isStargazingUnlocked() },
  { id: "fishing-details",     trigger: () => isFishingUnlocked() },
  { id: "garden-details",      trigger: () => isGardenUnlocked() },
  { id: "lounge-details",      trigger: () => (gameState.loungeCats || []).length > 0 },
  { id: "patron-details",      trigger: () => isPatronUnlocked() },
  { id: "research-details",    trigger: () => isResearchUnlocked() }
];

function autoOpenPanels() {
  if (!gameState.uiAutoOpened) gameState.uiAutoOpened = {};
  for (const rule of AUTO_OPEN_RULES) {
    if (gameState.uiAutoOpened[rule.id]) continue;
    if (!rule.trigger()) continue;
    const el = document.querySelector("." + rule.id);
    if (!el) continue;
    el.setAttribute("open", "");
    gameState.uiAutoOpened[rule.id] = true;
  }
}

function renderAll() {
  renderTopBar();
  renderParty();
  renderNeighborhoodTabs();
  renderMissions();
  renderShop();
  renderEternalPerks();
  renderClubLevel();
  renderAchievements();
  renderStars();
  renderFishing();
  renderGarden();
  renderPatron();
  renderResearch();
  renderStats();
  renderChallenges();
  renderMastery();
  renderBestiary();
  renderInventory();
  renderLog();
  renderLounge();
  renderActiveMissions();
  autoOpenPanels();
}

// --- Animation frame ----------------------------------------------------

function animateFrame() {
  for (const cat of gameState.cats) {
    const ctx = catCanvasCache.get(cat.id);
    if (ctx) drawCat(ctx, cat);
  }
  tickActiveBars();
}

// --- Event wiring --------------------------------------------------------

function wireEvents(onMutation) {
  document.addEventListener("click", (e) => {
    const t = e.target;

    if (t.closest("[data-modal-close]")) { closeModal(); return; }
    if (t.id === "modal" && t.classList.contains("open")) { closeModal(); return; }

    // Golden Mouse: choice selected or dismissed.
    const mouseChoice = t.closest("[data-mouse-choice]");
    if (mouseChoice && !mouseChoice.disabled) {
      const r = resolveGoldenMouse(mouseChoice.dataset.mouseChoice);
      if (!r.ok) { alert(r.reason); return; }
      closeModal();
      onMutation();
      return;
    }
    if (t.id === "mouse-dismiss") {
      dismissGoldenMouse();
      closeModal();
      onMutation();
      return;
    }

    // Welcome modal dismiss — set the flag so returning players skip it.
    if (t.id === "welcome-dismiss") {
      gameState.tutorialSeen = true;
      requestSave();
      closeModal();
      presentNextStray();
      return;
    }

    // Save export — serialize and surface in the textarea; copy if possible.
    if (t.id === "save-export") {
      const ta = $("#save-textarea");
      if (!ta) return;
      ta.value = JSON.stringify(gameState);
      ta.focus(); ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      logEvent("Save exported \u2014 copy the text and keep it somewhere safe.");
      renderLog();
      return;
    }

    // Save import — validate version, two-step confirm, then replace state and reload.
    if (t.id === "save-import") {
      const ta = $("#save-textarea");
      const raw = ta ? ta.value.trim() : "";
      if (!raw) { alert("Paste save JSON into the text box first."); return; }
      let parsed;
      try { parsed = JSON.parse(raw); }
      catch (e) { alert("That doesn't look like valid JSON: " + e.message); return; }
      if (!parsed || typeof parsed !== "object") { alert("Save data is empty."); return; }
      if (parsed.version !== SAVE_VERSION) {
        if (!confirm(`Save version mismatch (file v${parsed.version ?? "?"}, game v${SAVE_VERSION}). Importing may break things. Continue?`)) return;
      }
      if (!confirm("Importing replaces your current save. Continue?")) return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
      } catch (e) {
        alert("Could not write save: " + e.message);
        return;
      }
      // Suspend saves so beforeunload doesn't overwrite the freshly-imported payload with
      // the current in-memory gameState.
      suspendSaves();
      location.reload();
      return;
    }

    // Emergency reset — two confirms, then wipe localStorage and reload.
    // Suspend saves BEFORE removing the key: otherwise beforeunload (or the debounced
    // saver) fires during the reload and writes the in-memory gameState right back,
    // un-doing the reset. suspendSaves() also cancels any pending setTimeout.
    if (t.id === "save-reset") {
      if (!confirm("Start fresh? This permanently deletes your entire save and cannot be undone.")) return;
      if (!confirm("Really wipe everything? Cats, prestige progress, bestiary, challenge boons \u2014 ALL of it.")) return;
      suspendSaves();
      localStorage.removeItem(SAVE_KEY);
      location.reload();
      return;
    }

    // Neighborhood tab
    const hoodTab = t.closest(".hood-tab");
    if (hoodTab) {
      uiState.activeNeighborhood = hoodTab.dataset.hoodId;
      renderNeighborhoodTabs();
      renderMissions();
      return;
    }

    // Daily challenge Plan button
    const dailyBtn = t.closest("[data-daily-send]");
    if (dailyBtn && !dailyBtn.disabled) {
      openDailyPicker(dailyBtn.dataset.dailySend);
      return;
    }

    // Weekly Boss Plan button
    const bossBtn = t.closest("[data-boss-send]");
    if (bossBtn && !bossBtn.disabled) {
      openBossPicker();
      return;
    }

    // Mission Plan button (regular tier)
    const missionBtn = t.closest(".mission-send");
    if (missionBtn && !missionBtn.disabled && missionBtn.dataset.tier) {
      openMissionPicker(uiState.activeNeighborhood, parseInt(missionBtn.dataset.tier, 10));
      return;
    }

    // Party preset save — snapshots the current selection into slot N.
    const presetSaveBtn = t.closest("[data-preset-save]");
    if (presetSaveBtn && !presetSaveBtn.disabled) {
      const p = uiState.picker;
      if (!p || !p.selected.size) return;
      const idx = parseInt(presetSaveBtn.dataset.presetSave, 10);
      gameState.partyPresets = gameState.partyPresets || [null, null, null];
      gameState.partyPresets[idx] = { catIds: Array.from(p.selected) };
      requestSave();
      renderPicker();
      return;
    }

    // Party preset load — replaces the selection with the preset's cats that are still
    // idle. Gracefully drops retired or stationed cats.
    const presetLoadBtn = t.closest("[data-preset-load]");
    if (presetLoadBtn && !presetLoadBtn.disabled) {
      const p = uiState.picker;
      const idx = parseInt(presetLoadBtn.dataset.presetLoad, 10);
      const preset = gameState.partyPresets?.[idx];
      if (!p || !preset) return;
      p.selected = new Set();
      for (const id of preset.catIds) {
        const c = findCat(id);
        if (c && c.status === "idle" && p.selected.size < partyMax()) p.selected.add(id);
      }
      renderPicker();
      return;
    }

    // Use last party shortcut
    if (t.id === "picker-last-party") {
      const p = uiState.picker;
      if (!p) return;
      p.selected = new Set();
      for (const id of (gameState.lastParty || [])) {
        const c = findCat(id);
        if (c && c.status === "idle" && p.selected.size < partyMax()) p.selected.add(id);
      }
      renderPicker();
      return;
    }

    // Ability chip toggle on a picker cat row.
    const abilityBtn = t.closest("[data-ability-toggle]");
    if (abilityBtn && !abilityBtn.disabled) {
      const p = uiState.picker;
      if (!p) return;
      const catId = abilityBtn.dataset.abilityToggle;
      const cat = findCat(catId);
      const ability = catAbility(cat);
      if (!ability) return;
      p.abilityActivations = p.abilityActivations || {};
      if (p.abilityActivations[catId]) delete p.abilityActivations[catId];
      else p.abilityActivations[catId] = ability.id;
      renderPicker();
      return;
    }

    // Mission picker: Queue — append to missionQueue instead of starting now.
    // Only offered for regular tier missions (synthetics can't queue).
    if (t.id === "picker-queue" && !t.disabled) {
      const p = uiState.picker;
      const catAbilities = {};
      for (const id of p.selected) {
        if (p.abilityActivations?.[id]) catAbilities[id] = p.abilityActivations[id];
      }
      const r = queueMission(Array.from(p.selected), p.neighborhoodId, p.tier, p.searchForStrays, { autoRepeat: !!p.autoRepeat, catAbilities });
      if (!r.ok) { alert(r.reason); return; }
      closeModal();
      onMutation();
      return;
    }

    // Cancel a queued mission from the Active Missions footer.
    const queueCancelBtn = t.closest("[data-queue-cancel]");
    if (queueCancelBtn) {
      const r = cancelQueuedMission(queueCancelBtn.dataset.queueCancel);
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }

    // Mission picker: Start. Synthetic missions (daily/boss/commission) pass the whole
    // mission object instead of (hood,tier) so their modifier-applied fields take effect.
    // autoRepeat is only meaningful for regular tier missions (one-shots can't re-fire).
    if (t.id === "picker-start" && !t.disabled) {
      const p = uiState.picker;
      // Only pass abilities for cats actually in the selected party.
      const catAbilities = {};
      for (const id of p.selected) {
        if (p.abilityActivations?.[id]) catAbilities[id] = p.abilityActivations[id];
      }
      const opts = { autoRepeat: !!p.autoRepeat, catAbilities };
      const res = (p.isDaily || p.isBoss || p.isCommission)
        ? startMission(Array.from(p.selected), p.mission, p.searchForStrays, opts)
        : startMission(Array.from(p.selected), p.neighborhoodId, p.tier, p.searchForStrays, opts);
      if (!res.ok) { alert(res.reason); return; }
      closeModal();
      onMutation();
      return;
    }

    // Inventory filter pill
    const filterPill = t.closest("[data-inv-filter]");
    if (filterPill) {
      uiState.inventoryFilter = filterPill.dataset.invFilter;
      renderInventory();
      return;
    }

    // Inventory bulk sell
    const bulkBtn = t.closest("[data-bulk-sell]");
    if (bulkBtn && !bulkBtn.disabled) {
      const rarity = bulkBtn.dataset.bulkSell;
      const r = sellMatching(i => i.rarity === rarity);
      if (r.count > 0) onMutation();
      return;
    }

    // Item inventory click
    const invItem = t.closest(".inv-item");
    if (invItem) { openItemAction(invItem.dataset.itemId); return; }

    // Equip from item modal
    const equipBtn = t.closest("[data-equip-cat]");
    if (equipBtn) {
      if (equipItem(equipBtn.dataset.equipCat, equipBtn.dataset.equipItem)) {
        closeModal();
        onMutation();
      }
      return;
    }

    // Sell from item modal
    const sellBtn = t.closest("[data-sell-item]");
    if (sellBtn) {
      if (sellItem(sellBtn.dataset.sellItem)) { closeModal(); onMutation(); }
      return;
    }

    // Unequip via equip slot click
    const slot = t.closest(".equip-slot");
    if (slot && !slot.classList.contains("empty")) {
      unequipItem(slot.dataset.catId, slot.dataset.slot);
      onMutation();
      return;
    }

    // Stargazing: reroll the active sign (no cat) or pick a pip (cat assigned).
    if (t.id === "star-reroll" && !t.disabled) {
      const r = rerollStarSign();
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }
    const starPip = t.closest("[data-star-pick]");
    if (starPip) {
      const r = setStarSign(starPip.dataset.starPick);
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }

    // Commission: open designer modal.
    const commissionOpenBtn = t.closest("[data-commission-open]");
    if (commissionOpenBtn) {
      openCommissionModal(commissionOpenBtn.dataset.commissionOpen);
      return;
    }
    // Commission designer: change hood / tier.
    const commissionHood = t.closest("[data-commission-hood]");
    if (commissionHood && uiState.commission) {
      uiState.commission.neighborhoodId = commissionHood.dataset.commissionHood;
      renderCommissionModal();
      return;
    }
    const commissionTier = t.closest("[data-commission-tier]");
    if (commissionTier && uiState.commission) {
      uiState.commission.tier = parseInt(commissionTier.dataset.commissionTier, 10);
      renderCommissionModal();
      return;
    }
    // Commission: dispatch — pay treaties, build mission, open party picker on it.
    if (t.id === "commission-dispatch" && !t.disabled && uiState.commission) {
      const c = uiState.commission;
      const r = commissionChallenge(c.neighborhoodId, c.tier, Array.from(c.mods));
      if (!r.ok) { alert(r.reason); return; }
      closeModal();
      // Route through the picker just like daily/boss synthetic missions.
      uiState.picker = {
        neighborhoodId: r.mission.neighborhoodId,
        tier: r.mission.tier,
        mission: r.mission,
        isCommission: true,
        selected: new Set(),
        searchForStrays: gameState.cats.length < clubMax()
      };
      renderPicker();
      $("#modal").classList.add("open");
      onMutation();
      return;
    }

    // Station assignment flow: open picker, pick a cat, or unassign.
    const assignBtn = t.closest("[data-station-assign]");
    if (assignBtn) {
      openStationAssignPicker(assignBtn.dataset.stationAssign);
      return;
    }
    const unassignBtn = t.closest("[data-station-unassign]");
    if (unassignBtn) {
      const r = unassignStation(unassignBtn.dataset.stationUnassign);
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }
    const assignCatBtn = t.closest("[data-station-assign-cat]");
    if (assignCatBtn) {
      const r = assignCatToStation(assignCatBtn.dataset.stationAssignCat, assignCatBtn.dataset.catId);
      if (!r.ok) { alert(r.reason); return; }
      closeModal();
      onMutation();
      return;
    }

    // Fishing: cast / hook / upgrade.
    if (t.id === "fish-cast" && !t.disabled) {
      const r = castFishingLine();
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }
    if (t.id === "fish-hook" && !t.disabled) {
      const r = hookFishingBite();
      if (!r.ok) {
        // Just log silently — don't alert; a misclick in the wrong window shouldn't nag.
        logEvent(r.reason);
        onMutation();
      } else {
        onMutation();
      }
      return;
    }
    const fishUp = t.closest("[data-fish-upgrade]");
    if (fishUp && !fishUp.disabled) {
      const r = buyFishingUpgrade(fishUp.dataset.fishUpgrade);
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }

    // Garden: plant seed or harvest plot.
    const plantBtn = t.closest("[data-plant-plot]");
    if (plantBtn && !plantBtn.disabled) {
      const r = plantSeed(parseInt(plantBtn.dataset.plantPlot, 10), plantBtn.dataset.plantSeed);
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }
    const harvBtn = t.closest("[data-harvest-plot]");
    if (harvBtn) {
      const r = harvestPlot(parseInt(harvBtn.dataset.harvestPlot, 10));
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }

    // Research: start node / cancel active.
    const researchStartBtn = t.closest("[data-research-start]");
    if (researchStartBtn && !researchStartBtn.disabled) {
      const r = startResearch(researchStartBtn.dataset.researchStart);
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }
    if (t.id === "research-cancel") {
      if (confirm("Cancel active research? Half of the cost is refunded.")) {
        const r = cancelResearch();
        if (!r.ok) alert(r.reason); else onMutation();
      }
      return;
    }

    // Patron: open picker + pledge.
    if (t.id === "patron-open-picker") {
      openPatronPicker();
      return;
    }
    const patronPickBtn = t.closest("[data-patron-pick]");
    if (patronPickBtn && !patronPickBtn.disabled) {
      const r = choosePatron(patronPickBtn.dataset.patronPick);
      if (!r.ok) { alert(r.reason); return; }
      closeModal();
      onMutation();
      return;
    }

    // Challenges: start or abandon.
    const chStart = t.closest("[data-challenge-start]");
    if (chStart && !chStart.disabled) {
      const r = startChallenge(chStart.dataset.challengeStart);
      if (!r.ok) alert(r.reason); else onMutation();
      return;
    }
    if (t.id === "challenge-abandon") {
      if (confirm("Abandon the active challenge? Progress resets; earned Boons stay.")) {
        const r = abandonChallenge();
        if (!r.ok) alert(r.reason); else onMutation();
      }
      return;
    }

    // Club Perk buy.
    const clubPerkBtn = t.closest("[data-club-perk-buy]");
    if (clubPerkBtn && !clubPerkBtn.disabled) {
      const r = buyClubPerk(clubPerkBtn.dataset.clubPerkBuy);
      if (!r.ok) alert(r.reason);
      onMutation();
      return;
    }

    // Eternal Perk buy.
    const eternalBuyBtn = t.closest("[data-eternal-buy]");
    if (eternalBuyBtn && !eternalBuyBtn.disabled) {
      const r = buyEternalPerk(eternalBuyBtn.dataset.eternalBuy);
      if (!r.ok) alert(r.reason);
      onMutation();
      return;
    }

    // Cat Nap button — open pick-cat modal.
    if (t.id === "cat-nap-btn" && !t.disabled) {
      openCatNapModal();
      return;
    }

    // Cat Nap: confirm the selected roster and prestige.
    if (t.id === "cat-nap-confirm" && !t.disabled) {
      const selected = uiState.napSelected ? Array.from(uiState.napSelected) : [];
      if (!selected.length) return;
      const preview = nineLivesPreview();
      const names = selected.map(id => findCat(id)?.name).filter(Boolean).join(", ");
      const ok = confirm(`Cat Nap: carry ${names} forward, retire the rest, earn +${preview} 🌀 Nine Lives. Continue?`);
      if (!ok) return;
      const r = prestige(selected);
      if (!r.ok) { alert(r.reason); return; }
      uiState.napSelected = new Set();
      closeModal();
      renderAll();
      return;
    }

    // Shop: initial click — immediate purchase or open target picker.
    const shopBuyBtn = t.closest("[data-shop-buy]");
    if (shopBuyBtn && !shopBuyBtn.disabled) {
      const item = SHOP_ITEMS.find(i => i.id === shopBuyBtn.dataset.shopBuy);
      if (!item) return;
      if (item.id === "autosell") {
        const r = buyAutosell();
        if (!r.ok) alert(r.reason); else onMutation();
      } else if (item.id === "summons") {
        const r = buyStraySummons();
        if (!r.ok) alert(r.reason); else onMutation();
      } else if (item.strayBonus) {
        const r = buyStrayConsumable(item.id);
        if (!r.ok) alert(r.reason); else onMutation();
      } else {
        openShopTargetPicker(item);
      }
      return;
    }

    // Kitten Formula: cat picked → move to breed picker.
    const kittenCatBtn = t.closest("[data-kitten-cat]");
    if (kittenCatBtn) {
      openKittenBreedPicker(kittenCatBtn.dataset.kittenCat);
      return;
    }

    // Kitten Formula: breed picked → apply reroll.
    const kittenApplyBtn = t.closest("[data-kitten-apply]");
    if (kittenApplyBtn) {
      const r = buyKittenFormula(kittenApplyBtn.dataset.kittenApply, kittenApplyBtn.dataset.kittenBreed);
      if (r && !r.ok) { alert(r.reason); return; }
      closeModal();
      onMutation();
      return;
    }

    // Shop target-picker selection — apply the chosen item to the chosen target.
    const shopApplyBtn = t.closest("[data-shop-apply]");
    if (shopApplyBtn) {
      const id = shopApplyBtn.dataset.shopApply;
      let r;
      if (id === "training") r = buyTrainingTin(shopApplyBtn.dataset.shopTargetCat);
      else if (id === "tonic") r = buyStatTonic(shopApplyBtn.dataset.shopTargetCat);
      else if (id === "reroll") r = buyElementReroll(shopApplyBtn.dataset.shopTargetItem);
      if (r && !r.ok) { alert(r.reason); return; }
      closeModal();
      onMutation();
      // Stat Tonic queues a pending stat choice — open that modal right away.
      if (id === "tonic" && r && r.ok) {
        const catId = shopApplyBtn.dataset.shopTargetCat;
        setTimeout(() => openStatChoiceModal(catId), 10);
      }
      return;
    }

    // "Come home" button on a cat card — cancels auto-repeat on its active mission so
    // the party returns after the current run. Shared flag: one click covers all party cats.
    const comeHomeBtn = t.closest(".cat-status-come-home");
    if (comeHomeBtn) {
      const card = comeHomeBtn.closest(".cat-card");
      const catId = card?.dataset.catId;
      if (catId) {
        const r = cancelAutoRepeat(catId);
        if (!r.ok) alert(r.reason); else onMutation();
      }
      return;
    }

    // Same cancel, but on the Active Missions strip — one row per mission, so multi-cat
    // parties have a single unambiguous click target.
    const activeComeHome = t.closest("[data-active-come-home]");
    if (activeComeHome) {
      const missionId = activeComeHome.dataset.activeComeHome;
      const mission = gameState.missions.find(m => m.id === missionId);
      if (mission && mission.catIds?.length) {
        const r = cancelAutoRepeat(mission.catIds[0]);
        if (!r.ok) alert(r.reason); else onMutation();
      }
      return;
    }

    // Cat name click — inline rename via prompt (keeps UX simple, no modal/form needed).
    const nameEl = t.closest(".cat-name");
    if (nameEl) {
      const card = nameEl.closest(".cat-card");
      const catId = card?.dataset.catId;
      const cat = findCat(catId);
      if (!cat) return;
      const raw = prompt(`Rename ${cat.name}:`, cat.name);
      if (raw === null) return; // cancelled
      const r = renameCat(catId, raw);
      if (!r.ok) alert(r.reason);
      else onMutation();
      return;
    }

    // Talent badge — open tree modal.
    const talentBtn = t.closest(".talent-btn");
    if (talentBtn) {
      const card = talentBtn.closest(".cat-card");
      if (card) openTalentModal(card.dataset.catId);
      return;
    }

    // Talent pick inside the tree modal.
    const talentPickBtn = t.closest("[data-talent-pick]");
    if (talentPickBtn && !talentPickBtn.disabled) {
      const catId = uiState.currentTalentCatId;
      if (catId) {
        const r = pickTalent(catId, talentPickBtn.dataset.talentPick);
        if (!r.ok) { alert(r.reason); return; }
        // Refresh both modal and panels so stat changes and the remaining points show.
        renderTalentModal();
        onMutation();
      }
      return;
    }

    // Stat choice badge
    const statChoiceBtn = t.closest(".stat-choice-btn");
    if (statChoiceBtn) {
      const card = statChoiceBtn.closest(".cat-card");
      if (card) openStatChoiceModal(card.dataset.catId);
      return;
    }

    // Stat pick inside the choice modal
    const statPickBtn = t.closest("[data-stat-pick]");
    if (statPickBtn && !statPickBtn.disabled) {
      const catId = uiState.currentStatChoiceCatId;
      if (catId && spendStatChoice(catId, statPickBtn.dataset.statPick)) {
        const cat = findCat(catId);
        if (cat && cat.pendingStatChoices > 0) openStatChoiceModal(catId);
        else closeModal();
        onMutation();
      }
      return;
    }

    // Bulk equip best — picks the highest-scoring item per slot from inventory.
    const bulkEquipBtn = t.closest(".bulk-equip-btn");
    if (bulkEquipBtn) {
      const card = bulkEquipBtn.closest(".cat-card");
      const catId = card?.dataset.catId;
      if (!catId) return;
      const r = equipBestForCat(catId);
      if (!r.ok) alert(r.reason);
      else if (r.changed === 0) {
        // Silent no-op if everything was already optimal.
      }
      onMutation();
      return;
    }

    // Retire
    const retireBtn = t.closest(".retire-btn");
    if (retireBtn) {
      const card = retireBtn.closest(".cat-card");
      const catId = card?.dataset.catId;
      const cat = findCat(catId);
      if (!cat) return;
      if (confirm(`Retire ${cat.name} to the Cat Lounge? This frees a slot. Equipped gear returns to inventory.`)) {
        const r = retireCat(catId);
        if (!r.ok) alert(r.reason);
        else onMutation();
      }
      return;
    }

    // Stray offer buttons
    if (t.closest("[data-accept-stray]")) {
      // The cat currently shown is the first in uiState.strayQueue's displayed slot — but we shifted it out.
      // Reconstruct from DOM: we stored nothing, so re-derive from first render target name.
      // Simpler: stash current stray in uiState.currentStray.
      const cat = uiState.currentStray;
      if (cat) acceptStray(cat);
      closeModal();
      onMutation();
      return;
    }
    if (t.closest("[data-decline-stray]")) {
      const cat = uiState.currentStray;
      if (cat) logEvent(`${cat.name} wandered off into the night.`);
      closeModal();
      onMutation();
      return;
    }
  });

  // Checkbox handling in picker
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("[data-pick-cat]")) {
      const p = uiState.picker;
      if (!p) return;
      const id = t.dataset.pickCat;
      if (t.checked) p.selected.add(id);
      else p.selected.delete(id);
      renderPicker();
      return;
    }
    if (t.id === "stray-checkbox") {
      const p = uiState.picker;
      if (p) p.searchForStrays = t.checked;
      return;
    }
    if (t.id === "auto-repeat-checkbox") {
      const p = uiState.picker;
      if (p) p.autoRepeat = t.checked;
      return;
    }
    if (t.id === "garden-autoplant") {
      if (gameState.garden) gameState.garden.autoPlant = !!t.checked;
      requestSave();
      return;
    }
    if (t.id === "inv-sort-select") {
      uiState.inventorySort = t.value;
      renderInventory();
      return;
    }
    if (t.matches("[data-nap-toggle]")) {
      uiState.napSelected = uiState.napSelected || new Set();
      const id = t.dataset.napToggle;
      if (t.checked) uiState.napSelected.add(id);
      else uiState.napSelected.delete(id);
      renderCatNapModal();
      return;
    }
    if (t.matches("[data-commission-mod]") && uiState.commission) {
      const id = t.dataset.commissionMod;
      if (t.checked) uiState.commission.mods.add(id);
      else uiState.commission.mods.delete(id);
      renderCommissionModal();
      return;
    }
  });

  document.addEventListener("keydown", (e) => {
    // Skip all shortcuts while the user is typing (input / textarea / contenteditable).
    // Also skip when any modifier except shift is pressed so we don't hijack browser keys.
    const target = e.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "Escape") { closeModal(); return; }

    // Enter confirms the modal's primary button if it exists + is enabled.
    if (e.key === "Enter") {
      const primary = document.querySelector("#modal.open .btn-primary:not(:disabled), #modal.open #picker-start:not(:disabled), #modal.open #welcome-dismiss, #modal.open #cat-nap-confirm:not(:disabled), #modal.open #commission-dispatch:not(:disabled)");
      if (primary) { e.preventDefault(); primary.click(); return; }
    }

    // Number keys 1-6 switch neighborhood tabs. Only applies when no modal is open so
    // hitting "1" in a picker input doesn't yank you elsewhere (the input check above
    // also covers typing fields).
    const modalOpen = document.querySelector("#modal.open");
    if (!modalOpen && /^[1-6]$/.test(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      const unlocked = unlockedNeighborhoodIds();
      if (unlocked[idx]) {
        uiState.activeNeighborhood = unlocked[idx];
        renderNeighborhoodTabs();
        renderMissions();
        e.preventDefault();
      }
    }
  });
}

