// =============================================================
// state.js — Save, load, and offline catch-up
// =============================================================

let gameState = null;
let saveTimer = null;

function defaultEternalPerks() {
  return { partyMax: INITIAL_PARTY_MAX, clubMax: INITIAL_CLUB_MAX, headStartGold: 0 };
}

// Reusable partial-reset for prestige and for first-run newGame.
// Preserves: nineLives, prestigeCount, eternalPerks, loungeCats (passed in or empty).
// Fresh: cats, inventory, missions, currencies, shop state, lastParty, highestTier.
function freshRunShell(persistents, starter, initialGold) {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    lastSaved: now,
    lastTick: now,
    gold: initialGold,
    fishes: 0,
    treaties: 0,
    cumulativeGold: 0,
    highestTier: 0,
    cats: starter ? [starter] : [],
    inventory: [],
    missions: [],
    pendingStrays: [],
    lastParty: [],
    shop: { autoSellCommons: false, pendingStraySummons: 0, pendingStrayBonus: 0 },
    dailyChallenges:  [],
    weeklyBoss:       null,
    nineLives:        persistents.nineLives        || 0,
    prestigeCount:    persistents.prestigeCount    || 0,
    eternalPerks:     persistents.eternalPerks     || defaultEternalPerks(),
    loungeCats:       persistents.loungeCats        || [],
    clubXp:           persistents.clubXp           || 0,
    clubLevel:        persistents.clubLevel        || 1,
    clubPerks:        persistents.clubPerks        || {},
    achievements:     persistents.achievements     || {},
    achievementFlags: persistents.achievementFlags || {},
    // Long-horizon systems — all persist across prestige.
    challengeBoons:   persistents.challengeBoons   || {},
    slotMasteryXp:    persistents.slotMasteryXp    || { collar: 0, toy: 0, treat: 0, relic: 0 },
    bestiary:         persistents.bestiary         || { breedsSeen: {}, hoodTiersCleared: {}, itemTemplates: {}, bossesDefeated: 0, dailiesCompleted: 0, straysAccepted: 0 },
    bestiaryRewards:  persistents.bestiaryRewards  || {},
    // Active-run-only state — reset on prestige.
    activeChallenge:  null,
    // Tier-2 minigames: per-run state. Timers stored as absolute ms so offline catch-up works.
    // Each station can have one assigned cat who provides passives + auto-operation.
    fishing:          { cast: null, upgrades: { rod: 0, bait: 0, auto: 0 }, totalCaught: 0, assignedCatId: null },
    garden:           { plots: Array.from({ length: GARDEN_PLOTS }, () => null), assignedCatId: null, autoPlant: true },
    stargazing:       { signId: null, dayKey: null, assignedCatId: null, lastXpDay: null },
    pendingRarityShift: 0, // consumed by the next mission start
    lastLoungeTrickle: null, // ms timestamp for dynasty XP batching
    // Cat Bonds — map of "idA|idB" (sorted) to co-mission count. Persists across prestige so
    // kept-cat pairs keep their history; pairs with retired cats stay in the map but go dormant.
    catBonds:         persistents.catBonds         || {},
    // Patron — null until the player picks one (gated at prestige 3). Persists across naps.
    patronId:         persistents.patronId         || null,
    // Research — long-horizon tech tree. `active` is a real-time timer; `completed` is a
    // permanent set. Both persist across prestige so investment pays off forever.
    research:         persistents.research         || { active: null, completed: {} },
    // Golden Mouse event queue — events appear as modals; ephemeral per run (reset on Nap).
    goldenMouseQueue: [],
    // First-run onboarding: welcome modal shows once, auto-opened panels stay remembered.
    tutorialSeen:     persistents.tutorialSeen     || false,
    uiAutoOpened:     persistents.uiAutoOpened     || {},
    log: []
  };
}

function newGame() {
  const now = Date.now();
  const starter = rollCat("fighter");
  const state = freshRunShell({}, starter, 0);
  // Head Start perk bonus is applied via starter gold when coming from a prestige.
  // Seed the bestiary with the starter breed so it shows up right away.
  state.bestiary.breedsSeen[starter.breed] = 1;
  state.log.push({ t: now, msg: `${starter.name} the ${CAT_BREEDS[starter.breed].classLabel} joined the club.` });
  return state;
}

function loadState() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return newGame();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SAVE_VERSION) return newGame();
    // Backfill fields that may be missing from older v2 saves during dev.
    parsed.pendingStrays = parsed.pendingStrays || [];
    parsed.missions = parsed.missions || [];
    parsed.cumulativeGold = parsed.cumulativeGold || 0;
    parsed.fishes = parsed.fishes || 0;
    parsed.treaties = parsed.treaties || 0;
    parsed.lastParty = parsed.lastParty || [];
    parsed.dailyChallenges = parsed.dailyChallenges || [];
    if (typeof parsed.weeklyBoss === "undefined") parsed.weeklyBoss = null;
    parsed.shop = parsed.shop || { autoSellCommons: false, pendingStraySummons: 0, pendingStrayBonus: 0 };
    if (typeof parsed.shop.autoSellCommons !== "boolean") parsed.shop.autoSellCommons = false;
    if (typeof parsed.shop.pendingStraySummons !== "number") parsed.shop.pendingStraySummons = 0;
    if (typeof parsed.shop.pendingStrayBonus !== "number") parsed.shop.pendingStrayBonus = 0;
    parsed.loungeCats = parsed.loungeCats || [];

    // Prestige-system fields.
    if (typeof parsed.nineLives     !== "number") parsed.nineLives     = 0;
    if (typeof parsed.prestigeCount !== "number") parsed.prestigeCount = 0;
    if (typeof parsed.highestTier   !== "number") parsed.highestTier   = 0;
    if (!parsed.eternalPerks) parsed.eternalPerks = defaultEternalPerks();
    if (typeof parsed.eternalPerks.partyMax      !== "number") parsed.eternalPerks.partyMax      = INITIAL_PARTY_MAX;
    if (typeof parsed.eternalPerks.clubMax       !== "number") parsed.eternalPerks.clubMax       = INITIAL_CLUB_MAX;
    if (typeof parsed.eternalPerks.headStartGold !== "number") parsed.eternalPerks.headStartGold = 0;

    // Club Level & Achievements — persistent meta progression.
    if (typeof parsed.clubXp    !== "number") parsed.clubXp    = 0;
    if (typeof parsed.clubLevel !== "number") parsed.clubLevel = 1;
    parsed.clubPerks        = parsed.clubPerks        || {};
    parsed.achievements     = parsed.achievements     || {};
    parsed.achievementFlags = parsed.achievementFlags || {};

    // Long-horizon systems — backfill for older saves.
    parsed.challengeBoons   = parsed.challengeBoons   || {};
    if (typeof parsed.activeChallenge === "undefined") parsed.activeChallenge = null;
    if (!parsed.slotMasteryXp) parsed.slotMasteryXp = { collar: 0, toy: 0, treat: 0, relic: 0 };
    for (const slot of ITEM_SLOTS) {
      if (typeof parsed.slotMasteryXp[slot] !== "number") parsed.slotMasteryXp[slot] = 0;
    }
    if (!parsed.bestiary) parsed.bestiary = { breedsSeen: {}, hoodTiersCleared: {}, itemTemplates: {}, bossesDefeated: 0, dailiesCompleted: 0, straysAccepted: 0 };
    parsed.bestiary.breedsSeen        = parsed.bestiary.breedsSeen        || {};
    parsed.bestiary.hoodTiersCleared  = parsed.bestiary.hoodTiersCleared  || {};
    parsed.bestiary.itemTemplates     = parsed.bestiary.itemTemplates     || {};
    if (typeof parsed.bestiary.bossesDefeated   !== "number") parsed.bestiary.bossesDefeated   = 0;
    if (typeof parsed.bestiary.dailiesCompleted !== "number") parsed.bestiary.dailiesCompleted = 0;
    if (typeof parsed.bestiary.straysAccepted   !== "number") parsed.bestiary.straysAccepted   = 0;
    parsed.bestiaryRewards  = parsed.bestiaryRewards  || {};

    // Tier-2 minigames backfill.
    if (!parsed.fishing) parsed.fishing = { cast: null, upgrades: { rod: 0, bait: 0, auto: 0 }, totalCaught: 0, assignedCatId: null };
    parsed.fishing.upgrades = parsed.fishing.upgrades || { rod: 0, bait: 0, auto: 0 };
    for (const k of ["rod", "bait", "auto"]) {
      if (typeof parsed.fishing.upgrades[k] !== "number") parsed.fishing.upgrades[k] = 0;
    }
    if (typeof parsed.fishing.totalCaught !== "number") parsed.fishing.totalCaught = 0;
    if (typeof parsed.fishing.assignedCatId === "undefined") parsed.fishing.assignedCatId = null;
    if (!parsed.garden) parsed.garden = { plots: Array.from({ length: GARDEN_PLOTS }, () => null), assignedCatId: null, autoPlant: true };
    if (!Array.isArray(parsed.garden.plots)) parsed.garden.plots = Array.from({ length: GARDEN_PLOTS }, () => null);
    while (parsed.garden.plots.length < GARDEN_PLOTS) parsed.garden.plots.push(null);
    if (typeof parsed.garden.assignedCatId === "undefined") parsed.garden.assignedCatId = null;
    if (typeof parsed.garden.autoPlant !== "boolean") parsed.garden.autoPlant = true;
    if (!parsed.stargazing) parsed.stargazing = { signId: null, dayKey: null, assignedCatId: null, lastXpDay: null };
    if (typeof parsed.stargazing.assignedCatId === "undefined") parsed.stargazing.assignedCatId = null;
    if (typeof parsed.stargazing.lastXpDay === "undefined") parsed.stargazing.lastXpDay = null;
    if (typeof parsed.pendingRarityShift !== "number") parsed.pendingRarityShift = 0;
    if (typeof parsed.lastLoungeTrickle === "undefined") parsed.lastLoungeTrickle = null;
    parsed.catBonds = parsed.catBonds || {};
    parsed.goldenMouseQueue = parsed.goldenMouseQueue || [];
    if (typeof parsed.patronId === "undefined") parsed.patronId = null;
    if (!parsed.research) parsed.research = { active: null, completed: {} };
    parsed.research.completed = parsed.research.completed || {};
    if (typeof parsed.research.active === "undefined") parsed.research.active = null;
    if (typeof parsed.tutorialSeen !== "boolean") parsed.tutorialSeen = false;
    parsed.uiAutoOpened = parsed.uiAutoOpened || {};

    // Defensive: reconcile cat.station and station.assignedCatId. The station's
    // assignedCatId is the source of truth; cat.station / cat.status are derived.
    //   Step 1 — clear dangling station refs whose cats no longer exist.
    //   Step 2 — sync each cat's fields to match whichever station (if any) claims them.
    // Handles both directions of drift (edited saves, old format, feature rollout).
    const stationSaves = { fishing: parsed.fishing, garden: parsed.garden, stargazing: parsed.stargazing };
    for (const cat of parsed.cats) {
      if (typeof cat.station === "undefined") cat.station = null;
    }
    for (const [stId, save] of Object.entries(stationSaves)) {
      if (!save.assignedCatId) continue;
      const c = parsed.cats.find(x => x.id === save.assignedCatId);
      if (!c) save.assignedCatId = null;
    }
    const claimedBy = {};
    for (const [stId, save] of Object.entries(stationSaves)) {
      if (save.assignedCatId) claimedBy[save.assignedCatId] = stId;
    }
    for (const cat of parsed.cats) {
      if (claimedBy[cat.id]) {
        cat.status = "stationed";
        cat.station = claimedBy[cat.id];
      } else if (cat.status === "stationed" || cat.station) {
        // Cat says it's stationed somewhere, but no station claims it — back to idle.
        cat.status = "idle";
        cat.station = null;
      }
    }
    for (const cat of parsed.cats) {
      for (const slot of ITEM_SLOTS) {
        if (!(slot in cat.equipped)) cat.equipped[slot] = null;
      }
      if (cat.status === "expedition") cat.status = "mission"; // rename safety
      if (typeof cat.pendingStatChoices !== "number") cat.pendingStatChoices = 0;
      if (typeof cat.pendingTalentPoints !== "number") cat.pendingTalentPoints = 0;
      if (!cat.talents) cat.talents = {};
      if (typeof cat.abilitiesUsed !== "number") cat.abilitiesUsed = 0;
    }
    return parsed;
  } catch (err) {
    console.warn("Save corrupt, starting fresh", err);
    return newGame();
  }
}

// Skip flag used by "Start Fresh" so the beforeunload listener doesn't resurrect the save
// we just deleted. Also short-circuits the debounced saver.
let _saveSuspended = false;
function suspendSaves() { _saveSuspended = true; if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } }

function saveStateNow() {
  if (!gameState || _saveSuspended) return;
  gameState.lastSaved = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    flashSaveIndicator();
  } catch (err) {
    console.error("Failed to save", err);
  }
}

function requestSave() {
  if (saveTimer || _saveSuspended) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveStateNow();
  }, 250);
}

function flashSaveIndicator() {
  const el = document.getElementById("save-indicator");
  if (!el) return;
  el.classList.add("active");
  setTimeout(() => el.classList.remove("active"), 400);
}

function logEvent(msg) {
  gameState.log.unshift({ t: Date.now(), msg });
  if (gameState.log.length > 40) gameState.log.length = 40;
}
