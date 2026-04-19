// =============================================================
// game.js — Tick loop, multi-cat missions, leveling, recruitment
// =============================================================

function randInt(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function hexShift(hex, amt) {
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp(parseInt(hex.slice(1, 3), 16) + randInt(-amt, amt));
  const g = clamp(parseInt(hex.slice(3, 5), 16) + randInt(-amt, amt));
  const b = clamp(parseInt(hex.slice(5, 7), 16) + randInt(-amt, amt));
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

function rollBaseStats(breed) {
  const stats = {};
  for (const s of STATS) {
    let range;
    if (breed.primaries.includes(s))        range = [8, 10];
    else if (breed.secondaries.includes(s)) range = [6, 8];
    else                                    range = [3, 6];
    stats[s] = randInt(range[0], range[1]);
  }
  return stats;
}

function rollCat(breedId) {
  if (!breedId) breedId = choice(Object.keys(CAT_BREEDS));
  const breed = CAT_BREEDS[breedId];
  const base = rollBaseStats(breed);
  // Bestiary reward (Breeds Discovered, tiered): each tier raises the currently-lowest stat
  // by 1. Applied N times so the boost spreads across multiple weak stats rather than piling
  // onto one.
  const breedBoost = bestiaryBreedStatBoost();
  for (let i = 0; i < breedBoost; i++) {
    let minStat = STATS[0];
    for (const s of STATS) if (base[s] < base[minStat]) minStat = s;
    base[minStat] += 1;
  }
  const palette = {
    fur:    hexShift(breed.palette.fur,    breed.paletteVariance.fur),
    accent: hexShift(breed.palette.accent, breed.paletteVariance.accent),
    eyes:   hexShift(breed.palette.eyes,   breed.paletteVariance.eyes)
  };
  const equipped = {};
  for (const slot of ITEM_SLOTS) equipped[slot] = null;
  return {
    id: uid(),
    name: choice(CAT_NAMES),
    breed: breedId,
    palette,
    baseStats: { ...base },
    stats: { ...base },
    level: 1,
    xp: 0,
    equipped,
    status: "idle",
    missionId: null,
    station: null,
    pendingStatChoices: 0,
    pendingTalentPoints: 0,
    talents: {}
  };
}

function findCat(id)  { return gameState.cats.find(c => c.id === id) || null; }
function findItem(id) { return id ? gameState.inventory.find(i => i.id === id) || null : null; }
function findMissionState(id) { return gameState.missions.find(m => m.id === id) || null; }

// Stats are neighborhood-agnostic. Gear element tags contribute separately via elementBonus().
// Slot mastery adds a flat amplifier to every affix on equipped items in that slot (step-based).
function effectiveStats(cat) {
  const result = { ...cat.stats };
  for (const slot of ITEM_SLOTS) {
    const item = findItem(cat.equipped[slot]);
    if (!item) continue;
    const amp = slotMasteryAffixBonus(slot);
    for (const [stat, bonus] of Object.entries(item.bonus)) {
      result[stat] = (result[stat] || 0) + bonus + amp;
    }
  }
  return result;
}

// Class passive contributions summed across the selected party. Each class adds a
// distinct dimension (mitigation / loot-chance / speed / failure-floor) so diverse
// parties gain multi-axis benefits and specialized parties stack one axis.
function partyPassives(catIds) {
  const totals = { mit: 0, lootPct: 0, speedPct: 0, floorPct: 0, xpPct: 0, rarityShift: 0 };
  for (const catId of catIds) {
    const cat = findCat(catId);
    if (!cat) continue;
    const p = CAT_BREEDS[cat.breed]?.passive;
    if (!p) continue;
    // Base breed passive.
    totals[p.kind] = (totals[p.kind] || 0) + p.amount;
    // Talent passive-amp: any "passiveKind" talent the cat has picked adds to the same kind,
    // letting specced cats scale their class identity (Bulwark II, Insight II, etc.).
    const tree = talentTreeFor(cat);
    for (const node of tree) {
      if (!cat.talents?.[node.id] || !node.passiveKind) continue;
      totals[node.passiveKind.kind] = (totals[node.passiveKind.kind] || 0) + node.passiveKind.amount;
    }
  }
  // Clamp speed so a full prowler party can't exceed 50% reduction from passives alone.
  totals.speedPct = Math.min(0.5, totals.speedPct);
  return totals;
}

function countBreeds(catIds) {
  const counts = {};
  for (const id of Object.keys(CAT_BREEDS)) counts[id] = 0;
  for (const id of catIds) {
    const cat = findCat(id);
    if (cat) counts[cat.breed] = (counts[cat.breed] || 0) + 1;
  }
  return counts;
}

function activeSynergies(catIds) {
  const counts = countBreeds(catIds);
  return SYNERGIES.filter(s => s.req(counts));
}

function partySynergyTotals(catIds) {
  const totals = { mit: 0, lootPct: 0, speedPct: 0, floorPct: 0, goldPct: 0, scoreBonus: 0 };
  for (const s of activeSynergies(catIds)) {
    for (const [k, v] of Object.entries(s.effects)) {
      totals[k] = (totals[k] || 0) + v;
    }
  }
  return totals;
}

// Sum active Challenge Boons into the same bonus shape. Boons persist across prestige;
// the player grinds challenges to stack these permanently.
function challengeBoonTotals() {
  const totals = { mit: 0, lootPct: 0, xpPct: 0, scoreBonus: 0 };
  const boons = gameState?.challengeBoons || {};
  for (const ch of CHALLENGES) {
    const level = boons[ch.id] || 0;
    if (level <= 0 || !ch.reward) continue;
    const kind = ch.reward.kind;
    totals[kind] = (totals[kind] || 0) + ch.reward.amount * level;
  }
  return totals;
}

// Mastery helpers — computed from slotMasteryXp via curve.
function slotMasteryLevel(slot) {
  let lvl = 0;
  let xp = (gameState?.slotMasteryXp?.[slot]) || 0;
  while (xp >= slotMasteryXpToNext(lvl + 1)) {
    xp -= slotMasteryXpToNext(lvl + 1);
    lvl++;
    if (lvl > 999) break; // sanity
  }
  return lvl;
}

function slotMasteryAffixBonus(slot) {
  return Math.floor(slotMasteryLevel(slot) / MASTERY_AFFIX_STEP);
}

// Party-wide mastery contributions: +loot chance per equipped slot, scaled by its mastery level.
// Affix amplifiers are applied per-item in effectiveStats(), not here.
function masteryPartyTotals(catIds) {
  let lootPct = 0;
  for (const slot of ITEM_SLOTS) {
    const lvl = slotMasteryLevel(slot);
    if (lvl <= 0) continue;
    const anyEquipped = catIds.some(id => {
      const cat = findCat(id);
      return !!(cat && cat.equipped[slot]);
    });
    if (anyEquipped) lootPct += lvl * MASTERY_LOOT_PER_LEVEL;
  }
  return { lootPct };
}

// Bestiary tier = floor(count / step). Each tier stacks one unit of its per-tier reward.
// bestiaryRewards[id] stores the highest tier already logged, so checkBestiary can detect
// new threshold crossings for log events. Guards for gameState being null during newGame().
function bestiaryTier(catId) {
  if (!gameState) return 0;
  const cat = BESTIARY.find(c => c.id === catId);
  if (!cat) return 0;
  return Math.floor(cat.count(gameState) / cat.step);
}
function bestiaryMaxTier(catId) {
  const cat = BESTIARY.find(c => c.id === catId);
  if (!cat) return 0;
  return Math.ceil(cat.total() / cat.step);
}
function bestiaryNextThreshold(catId) {
  const cat = BESTIARY.find(c => c.id === catId);
  if (!cat) return null;
  const count = cat.count(gameState);
  const maxTier = bestiaryMaxTier(catId);
  const curTier = bestiaryTier(catId);
  if (curTier >= maxTier) return null;
  return (curTier + 1) * cat.step;
}

// Per-tier bonus accessors.
function bestiaryGlobalLootPct() { return bestiaryTier("items")   * 0.005; }  // +0.5% per tier
function bestiaryGlobalGoldMul() { return 1 + bestiaryTier("tiers") * 0.01; } // +1% per tier
function bestiaryStrayBonus()    { return bestiaryTier("strays")  * 0.01; }   // +1% per tier
function bestiaryBreedStatBoost(){ return bestiaryTier("breeds"); }            // +1 to lowest stat per tier
function bestiaryDailyTreaty()   { return bestiaryTier("dailies"); }           // +1 treaty per tier
function bestiaryBossNineLives() { return bestiaryTier("bosses"); }            // +1 🌀 per tier

// Combined party bonuses from passives + synergies + challenge boons + mastery + bestiary
// + talents. One call site, one source of truth.
function partyBonuses(catIds) {
  const p = partyPassives(catIds);
  const s = partySynergyTotals(catIds);
  const b = challengeBoonTotals();
  const m = masteryPartyTotals(catIds);
  const t = partyTalentTotals(catIds);
  return {
    mit:         (p.mit || 0)         + (s.mit || 0)         + (b.mit || 0)         + (t.mit || 0),
    lootPct:     (p.lootPct || 0)     + (s.lootPct || 0)     + (b.lootPct || 0)     + (m.lootPct || 0)  + (t.lootPct || 0) + bestiaryGlobalLootPct() + eternalLootPct(),
    speedPct:    Math.min(0.5, (p.speedPct || 0) + (s.speedPct || 0) + (t.speedPct || 0)),
    floorPct:    (p.floorPct || 0)    + (s.floorPct || 0),
    xpPct:       (p.xpPct || 0)       + (s.xpPct || 0)       + (b.xpPct || 0)       + (t.xpPct || 0),
    rarityShift: (p.rarityShift || 0) + (s.rarityShift || 0) + (t.rarityShift || 0),
    goldPct:     (s.goldPct || 0)                             + (t.goldPct || 0),
    scoreBonus:  (s.scoreBonus || 0)  + (b.scoreBonus || 0)  + (t.scoreBonus || 0)
  };
}

// Shared mitigation pool: matching-element gear + Scrapper "Bulwark" bonus + Guardian Pact synergy.
function partyMitigation(catIds, neighborhoodId) {
  let total = 0;
  for (const catId of catIds) {
    const cat = findCat(catId);
    if (!cat) continue;
    for (const slot of ITEM_SLOTS) {
      const item = findItem(cat.equipped[slot]);
      if (!item) continue;
      if (item.affinity === neighborhoodId) {
        total += ELEMENT_BONUS_BY_RARITY[item.rarity] || 0;
      }
    }
  }
  total += partyBonuses(catIds).mit;
  return total;
}

// Active effects at this mission's tier (first N from the neighborhood's list).
function activeEffects(mission) {
  const hood = NEIGHBORHOODS[mission.neighborhoodId];
  if (!hood || !hood.effects) return [];
  return hood.effects.slice(0, mission.effectsActive || 0);
}

// Compute how mitigation spreads across effects and what the resulting DC penalty is.
// Returns per-effect remaining severity + totals for UI and resolution.
function missionEffectsSummary(catIds, mission) {
  const effects = activeEffects(mission);
  const totalSeverity = effects.reduce((s, e) => s + e.severity, 0);
  const mitigation = partyMitigation(catIds, mission.neighborhoodId);
  let pool = mitigation;
  // Spend pool against highest-severity effects first so matching gear always "hurts the biggest".
  const sorted = [...effects].sort((a, b) => b.severity - a.severity);
  const remainingBySorted = sorted.map(e => {
    const spent = Math.min(pool, e.severity);
    pool -= spent;
    return { ...e, mitigated: spent, remaining: e.severity - spent };
  });
  // Reindex back to the neighborhood's original order for display.
  const remaining = effects.map(e => remainingBySorted.find(r => r.id === e.id));
  let netPenalty = remaining.reduce((s, e) => s + e.remaining, 0);
  // Fighter "Immovable" talent (hazardReduction) trims the final severity floor-zero.
  const hazardReduction = partyTalentTotals(catIds).hazardReduction || 0;
  netPenalty = Math.max(0, netPenalty - hazardReduction);
  return {
    effects: remaining,
    totalSeverity,
    mitigation,
    netPenalty,
    effectiveDC: mission.difficulty + netPenalty
  };
}

function getBestEquippedRarity(cat) {
  let best = null;
  for (const slot of ITEM_SLOTS) {
    const item = findItem(cat.equipped[slot]);
    if (!item) continue;
    if (!best || RARITY_ORDER.indexOf(item.rarity) > RARITY_ORDER.indexOf(best)) {
      best = item.rarity;
    }
  }
  return best;
}

// --- Synthetic mission builders (daily / boss) --------------------------

function buildDailyMission(daily) {
  const base = MISSION_TIERS.find(t => t.tier === daily.tier);
  const mod  = DAILY_MODIFIERS.find(m => m.id === daily.modifierId);
  const hood = NEIGHBORHOODS[daily.neighborhoodId];
  if (!base || !mod || !hood) return null;
  return {
    id: daily.id,
    isDaily: true,
    dailyId: daily.id,
    modifier: mod,
    neighborhoodId: daily.neighborhoodId,
    tier: daily.tier,
    name: `Daily — T${daily.tier} ${hood.name}`,
    duration:      Math.floor(base.duration * (mod.durationMul || 1)),
    difficulty:    base.difficulty,
    effectsActive: base.effectsActive,
    goldRange:    [Math.floor(base.goldRange[0]  * (mod.goldMul || 1)), Math.floor(base.goldRange[1]  * (mod.goldMul || 1))],
    fishRange:    [Math.floor(base.fishRange[0]  * (mod.fishMul || 1)), Math.floor(base.fishRange[1]  * (mod.fishMul || 1))],
    treatyChance:  base.treatyChance,
    bonusTreaties: mod.bonusTreaties || 0,
    xpReward:      Math.floor(base.xpReward      * (mod.xpMul   || 1)),
    lootChance:    base.lootChance,
    lootRolls:     mod.lootRolls || 1,
    rarityShift:   mod.rarityShift || 0,
    rarityWeights: { ...base.rarityWeights },
    primaryChecks: [...hood.primaryChecks]
  };
}

// Build a synthetic mission from a base tier + hood + stacked modifiers.
// Returns a mission object compatible with startMission(catIds, mission, searchForStrays).
function buildChallengeMission(neighborhoodId, tier, modIds) {
  const base = MISSION_TIERS.find(t => t.tier === tier);
  const hood = NEIGHBORHOODS[neighborhoodId];
  if (!base || !hood) return null;
  // Clone base fields we'll mutate. rarityWeights cloned to avoid catalog aliasing.
  const mission = {
    id: `challenge-${neighborhoodId}-t${tier}-${Date.now()}`,
    isChallenge: true,
    neighborhoodId,
    tier,
    name: `Commission \u2014 T${tier} ${hood.name}`,
    primaryChecks: [...hood.primaryChecks],
    duration:      base.duration,
    difficulty:    base.difficulty,
    effectsActive: base.effectsActive,
    goldRange:    [...base.goldRange],
    fishRange:    [...base.fishRange],
    treatyChance:  base.treatyChance,
    bonusTreaties: 0,
    xpReward:      base.xpReward,
    lootChance:    base.lootChance,
    lootRolls:     1,
    rarityShift:   0,
    rarityWeights: { ...base.rarityWeights }
  };
  for (const id of modIds || []) {
    const mod = CHALLENGE_MODIFIERS.find(m => m.id === id);
    if (mod) mod.apply(mission, hood);
  }
  return mission;
}

function challengeCommissionCost(modIds) {
  const mods = modIds || [];
  return CHALLENGE_COMMISSION_BASE_COST + mods.reduce((s, id) => {
    const mod = CHALLENGE_MODIFIERS.find(m => m.id === id);
    return s + (mod ? mod.cost : 0);
  }, 0);
}

// Charges treaties and returns the built mission. Caller passes it to startMission.
function commissionChallenge(neighborhoodId, tier, modIds) {
  if (!isNeighborhoodUnlocked(neighborhoodId)) return { ok: false, reason: "Neighborhood locked." };
  if (!isTierUnlocked(tier)) return { ok: false, reason: "Tier locked." };
  const cost = challengeCommissionCost(modIds);
  if ((gameState.treaties || 0) < cost) return { ok: false, reason: `Not enough \uD83C\uDF80 (need ${cost}).` };
  const mission = buildChallengeMission(neighborhoodId, tier, modIds);
  if (!mission) return { ok: false, reason: "Invalid mission." };
  gameState.treaties -= cost;
  logEvent(`Commissioned T${tier} ${NEIGHBORHOODS[neighborhoodId].name} \u2014 ${cost}\uD83C\uDF80${modIds.length ? ` with ${modIds.length} modifier${modIds.length > 1 ? "s" : ""}` : ""}.`);
  requestSave();
  return { ok: true, mission, cost };
}

function buildBossMission(boss) {
  const hood = NEIGHBORHOODS[boss.neighborhoodId];
  if (!hood) return null;
  return {
    id: boss.id,
    isBoss: true,
    bossId: boss.id,
    neighborhoodId: boss.neighborhoodId,
    tier: 11,
    name: `Weekly Boss — ${hood.name}`,
    duration:      WEEKLY_BOSS_BASE.duration,
    difficulty:    WEEKLY_BOSS_BASE.difficulty,
    effectsActive: hood.effects.length, // stacks every hazard in the neighborhood
    goldRange:     [...WEEKLY_BOSS_BASE.goldRange],
    fishRange:     [...WEEKLY_BOSS_BASE.fishRange],
    treatyChance:  WEEKLY_BOSS_BASE.treatyChance,
    bonusTreaties: WEEKLY_BOSS_BASE.treatyGuaranteed,
    xpReward:      WEEKLY_BOSS_BASE.xpReward,
    lootChance:    1.0,
    lootRolls:     1,
    rarityWeights: { ...WEEKLY_BOSS_BASE.rarityWeights },
    primaryChecks: [...hood.primaryChecks],
    guaranteedLegendaries: WEEKLY_BOSS_BASE.guaranteedLegendaries,
    requiresFullParty:     WEEKLY_BOSS_BASE.requiresFullParty
  };
}

// --- Daily Challenges & Weekly Boss -------------------------------------

// Regenerates dailies if the stored dayKey is stale. One per unlocked neighborhood.
function refreshDailyChallenges() {
  const today = utcDayKey();
  const existing = (gameState.dailyChallenges || []);
  const haveValid = existing.length && existing[0].dayKey === today;
  if (haveValid) return;

  const hoods = unlockedNeighborhoodIds();
  const dailies = hoods.map(hoodId => {
    // Pick a mid-tier mission the player is likely able to attempt. Scale with highestTier.
    const maxTier = Math.max(3, Math.min(7, (gameState.highestTier || 1) + 1));
    const minTier = Math.max(1, maxTier - 3);
    const tier = minTier + Math.floor(Math.random() * (maxTier - minTier + 1));
    const mod  = choice(DAILY_MODIFIERS);
    return {
      id: `daily-${hoodId}-${today}`,
      neighborhoodId: hoodId,
      tier,
      dayKey: today,
      modifierId: mod.id,
      completed: false
    };
  });
  gameState.dailyChallenges = dailies;
}

function getDailyForHood(hoodId) {
  return (gameState.dailyChallenges || []).find(d => d.neighborhoodId === hoodId) || null;
}

// Regenerates the weekly boss if the stored weekKey is stale. Rotates through neighborhoods.
function refreshWeeklyBoss() {
  const thisWeek = utcWeekKey();
  if (gameState.weeklyBoss && gameState.weeklyBoss.weekKey === thisWeek) return;

  const hoods = unlockedNeighborhoodIds();
  if (!hoods.length) { gameState.weeklyBoss = null; return; }
  // Deterministic rotation: pick by week number.
  const match = thisWeek.match(/W(\d+)/);
  const weekIdx = match ? parseInt(match[1], 10) : 0;
  const hoodId = hoods[weekIdx % hoods.length];
  gameState.weeklyBoss = {
    id: `boss-${hoodId}-${thisWeek}`,
    neighborhoodId: hoodId,
    weekKey: thisWeek,
    completed: false
  };
}

// --- Neighborhood unlocks -----------------------------------------------

// Score each unlocked hood by the sum of the cat's effective stats on that hood's two
// primaryChecks, return the best match. Ties broken by insertion order (hood catalog).
// Returns the hood object, or null if no unlocked hoods exist.
function suggestedHoodForCat(cat) {
  if (!cat) return null;
  const eff = effectiveStats(cat);
  let best = null;
  let bestScore = -1;
  for (const hoodId of unlockedNeighborhoodIds()) {
    const hood = NEIGHBORHOODS[hoodId];
    if (!hood) continue;
    const score = (eff[hood.primaryChecks[0]] || 0) + (eff[hood.primaryChecks[1]] || 0);
    if (score > bestScore) { bestScore = score; best = hood; }
  }
  return best;
}

// Ms until the UTC day / ISO-ish week rolls over. Used for the subtle reset timers
// on daily and weekly cards — purely informational, not a call-to-action.
function msUntilDailyReset(ms) {
  ms = ms || Date.now();
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - ms;
}
function msUntilWeeklyReset(ms) {
  ms = ms || Date.now();
  const d = new Date(ms);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const daysSinceYearStart = Math.floor((ms - yearStart) / (24 * 60 * 60 * 1000));
  const nextWeekBoundary = yearStart + (Math.floor(daysSinceYearStart / 7) + 1) * 7 * 24 * 60 * 60 * 1000;
  return nextWeekBoundary - ms;
}

function isNeighborhoodUnlocked(hoodOrId) {
  const hood = typeof hoodOrId === "string" ? NEIGHBORHOODS[hoodOrId] : hoodOrId;
  if (!hood) return false;
  if (!hood.requiresPrestige) return true;
  return (gameState.prestigeCount || 0) >= hood.requiresPrestige;
}

function unlockedNeighborhoodIds() {
  return NEIGHBORHOOD_IDS.filter(id => isNeighborhoodUnlocked(id));
}

// --- Tier unlocks & mission listing -------------------------------------

function isTierUnlocked(tier) {
  const tierDef = MISSION_TIERS.find(t => t.tier === tier);
  if (!tierDef) return false;
  if (tierDef.requiresPrestige && (gameState.prestigeCount || 0) < tierDef.requiresPrestige) return false;
  if (tierDef.requiresClubLevel && (gameState.clubLevel || 1) < tierDef.requiresClubLevel) return false;
  if (tierDef.requiresAchievement && !gameState.achievements?.[tierDef.requiresAchievement]?.claimed) return false;
  const needed = TIER_UNLOCK_GOLD[tier - 1] || 0;
  return (gameState.cumulativeGold || 0) >= needed;
}

// Return a human-readable list of unmet gates for a given tier.
function tierLockReasons(tier) {
  const tierDef = MISSION_TIERS.find(t => t.tier === tier);
  if (!tierDef) return [];
  const reasons = [];
  const needed = TIER_UNLOCK_GOLD[tier - 1] || 0;
  if ((gameState.cumulativeGold || 0) < needed) {
    reasons.push(`${needed}\uD83D\uDCB0 total earned`);
  }
  if (tierDef.requiresClubLevel && (gameState.clubLevel || 1) < tierDef.requiresClubLevel) {
    reasons.push(`Club Level ${tierDef.requiresClubLevel}`);
  }
  if (tierDef.requiresAchievement && !gameState.achievements?.[tierDef.requiresAchievement]?.claimed) {
    const ach = ACHIEVEMENTS.find(a => a.id === tierDef.requiresAchievement);
    reasons.push(`Achievement: ${ach?.name || tierDef.requiresAchievement}`);
  }
  if (tierDef.requiresPrestige && (gameState.prestigeCount || 0) < tierDef.requiresPrestige) {
    reasons.push(`Cat Nap \u00D7 ${tierDef.requiresPrestige}`);
  }
  return reasons;
}

function getUnlockedMissions(neighborhoodId) {
  return MISSION_TIERS
    .filter(t => isTierUnlocked(t.tier))
    .map(t => getMission(neighborhoodId, t.tier));
}

function getAllMissions(neighborhoodId) {
  return MISSION_TIERS.map(t => getMission(neighborhoodId, t.tier));
}

// --- Multi-cat mission mechanic -----------------------------------------

function partyScore(catIds, mission) {
  // For each stat check: best cat's value + 25% of each other cat's value.
  // Plus any flat score bonus from synergies (e.g. Pack Tactics).
  // Plus a +STAR_CHECK_BONUS if the current Star Sign's stat matches the check.
  // Neighborhood hazards are handled by adjusting effective DC via missionEffectsSummary.
  const cats = catIds.map(findCat).filter(Boolean);
  if (!cats.length) return 0;
  const star = currentStarSign();
  let total = 0;
  for (const stat of mission.primaryChecks) {
    const values = cats.map(c => effectiveStats(c)[stat]).sort((a, b) => b - a);
    let check = values[0];
    for (let i = 1; i < values.length; i++) check += 0.25 * values[i];
    if (star && star.stat === stat) check += STAR_CHECK_BONUS;
    total += check;
  }
  total += partyBonuses(catIds).scoreBonus;
  return Math.round(total);
}

// --- Challenges --------------------------------------------------------

function startChallenge(challengeId) {
  const ch = CHALLENGES.find(c => c.id === challengeId);
  if (!ch) return { ok: false, reason: "Unknown challenge." };
  if (gameState.activeChallenge) return { ok: false, reason: "A challenge is already active." };
  gameState.activeChallenge = { id: ch.id, startedAt: Date.now(), missionsCompleted: 0, hoodLock: null };
  logEvent(`Challenge started: ${ch.name}.`);
  requestSave();
  return { ok: true };
}

function abandonChallenge() {
  if (!gameState.activeChallenge) return { ok: false, reason: "No active challenge." };
  const ch = CHALLENGES.find(c => c.id === gameState.activeChallenge.id);
  gameState.activeChallenge = null;
  logEvent(`Challenge abandoned: ${ch?.name || "challenge"}. Progress reset.`);
  requestSave();
  return { ok: true };
}

// Validate that a mission start satisfies the active challenge's restriction.
// catIds and mission are already the final candidates at call time.
function validateChallenge(catIds, mission) {
  const active = gameState.activeChallenge;
  if (!active) return { ok: true };
  const ch = CHALLENGES.find(c => c.id === active.id);
  if (!ch) return { ok: true };
  const cats = catIds.map(findCat).filter(Boolean);

  switch (ch.restriction) {
    case "monoclass": {
      const breeds = new Set(cats.map(c => c.breed));
      if (breeds.size > 1) return { ok: false, reason: `${ch.name}: all cats must share a class.` };
      return { ok: true };
    }
    case "nogear": {
      const geared = cats.find(c => ITEM_SLOTS.some(s => c.equipped[s]));
      if (geared) return { ok: false, reason: `${ch.name}: unequip ${geared.name} (and any other cat).` };
      return { ok: true };
    }
    case "pairbond": {
      if (catIds.length > 2) return { ok: false, reason: `${ch.name}: party cap is 2.` };
      return { ok: true };
    }
    case "homebody": {
      if (!active.hoodLock) return { ok: true }; // first mission sets the lock
      if (mission.neighborhoodId !== active.hoodLock) {
        const hood = NEIGHBORHOODS[active.hoodLock];
        return { ok: false, reason: `${ch.name}: all missions must be in ${hood?.name || active.hoodLock}.` };
      }
      return { ok: true };
    }
  }
  return { ok: true };
}

// Count the current mission toward challenge progress, and award the Boon on completion.
function recordChallengeProgress(active, mission, outcome) {
  const ch = gameState.activeChallenge
    ? CHALLENGES.find(c => c.id === gameState.activeChallenge.id)
    : null;
  if (!ch || outcome === "fail") return;
  // Homebody: first mission locks the hood.
  if (ch.restriction === "homebody" && !gameState.activeChallenge.hoodLock) {
    gameState.activeChallenge.hoodLock = mission.neighborhoodId;
  }
  if (mission.tier < (ch.goalMinTier || 1)) return;
  gameState.activeChallenge.missionsCompleted++;
  if (gameState.activeChallenge.missionsCompleted >= ch.goalCount) {
    gameState.challengeBoons[ch.id] = (gameState.challengeBoons[ch.id] || 0) + 1;
    const level = gameState.challengeBoons[ch.id];
    logEvent(`\u{1F3C6} Challenge complete: ${ch.name} \u2014 Boon now Lv ${level} (${ch.reward.label}).`);
    gameState.activeChallenge = null;
  }
}

// --- Mastery XP ---------------------------------------------------------

// Grant XP to each slot that had an equipped item among the party for this mission.
function grantSlotMastery(catIds, outcomeMul) {
  for (const slot of ITEM_SLOTS) {
    let equippedCount = 0;
    for (const catId of catIds) {
      const cat = findCat(catId);
      if (cat && cat.equipped[slot]) equippedCount++;
    }
    if (!equippedCount) continue;
    const before = slotMasteryLevel(slot);
    const gain = Math.max(1, Math.floor(MASTERY_XP_PER_EQUIPPED * equippedCount * outcomeMul));
    gameState.slotMasteryXp[slot] = (gameState.slotMasteryXp[slot] || 0) + gain;
    const after = slotMasteryLevel(slot);
    if (after > before) {
      logEvent(`\u{1F9E4} ${slot[0].toUpperCase() + slot.slice(1)} Mastery reached Lv ${after}.`);
    }
  }
}

// --- Bestiary -----------------------------------------------------------

function itemTemplateKey(item) {
  return `${item.type}_${item.affinity}_${item.rarity}`;
}

function recordBreedSeen(breedId) {
  gameState.bestiary = gameState.bestiary || {};
  gameState.bestiary.breedsSeen = gameState.bestiary.breedsSeen || {};
  gameState.bestiary.breedsSeen[breedId] = (gameState.bestiary.breedsSeen[breedId] || 0) + 1;
  checkBestiary();
}

function recordItemFound(item) {
  if (!item) return;
  gameState.bestiary = gameState.bestiary || {};
  gameState.bestiary.itemTemplates = gameState.bestiary.itemTemplates || {};
  const key = itemTemplateKey(item);
  gameState.bestiary.itemTemplates[key] = (gameState.bestiary.itemTemplates[key] || 0) + 1;
  checkBestiary();
}

function recordHoodTierCleared(neighborhoodId, tier) {
  gameState.bestiary = gameState.bestiary || {};
  gameState.bestiary.hoodTiersCleared = gameState.bestiary.hoodTiersCleared || {};
  const key = `${neighborhoodId}-t${tier}`;
  const wasNew = !gameState.bestiary.hoodTiersCleared[key];
  gameState.bestiary.hoodTiersCleared[key] = true;
  // First-time clear of a minigame's gate hood-tier fires a one-shot discovery log.
  if (wasNew) {
    if (key === `${MINIGAME_GATES.garden.hoodId}-t${MINIGAME_GATES.garden.tier}`) {
      logEvent("\uD83C\uDF3F The Park's gardeners lend you a trowel. \u2014 Catnip Garden unlocked!");
    }
    if (key === `${MINIGAME_GATES.fishing.hoodId}-t${MINIGAME_GATES.fishing.tier}`) {
      logEvent("\uD83C\uDFA3 A kindly angler leaves you a spare rod. \u2014 Fishing Hole unlocked!");
    }
    if (key === `${MINIGAME_GATES.stargazing.hoodId}-t${MINIGAME_GATES.stargazing.tier}`) {
      logEvent("\u2728 From a high tile, the constellations wake. \u2014 Stargazing unlocked!");
    }
  }
  checkBestiary();
}

// Detect new tier crossings for each bestiary category and log them. The stored value is
// the highest tier already announced, so repeat calls are idempotent until progress advances.
function checkBestiary() {
  gameState.bestiaryRewards = gameState.bestiaryRewards || {};
  for (const cat of BESTIARY) {
    const tier = bestiaryTier(cat.id);
    // Legacy saves may have stored a boolean here; coerce to number.
    const lastLogged = Number(gameState.bestiaryRewards[cat.id]) || 0;
    if (tier > lastLogged) {
      gameState.bestiaryRewards[cat.id] = tier;
      const maxTier = bestiaryMaxTier(cat.id);
      const milestone = tier >= maxTier ? " (MAX)" : "";
      logEvent(`\u{1F4DA} ${cat.label} \u2014 Tier ${tier}${milestone}: ${cat.tierLabel(tier)}.`);
    }
  }
}

// ============================================================================
// Tier-2 minigames: Fishing · Garden · Stargazing
// Each is thematically tied to a neighborhood and unlocked by clearing a specific
// tier there. Derived live from bestiary.hoodTiersCleared (no separate flag state).
// ============================================================================

const MINIGAME_GATES = {
  garden:     { hoodId: "park",     tier: 2, label: "Clear T2 Park to unlock the Garden." },
  fishing:    { hoodId: "lake",     tier: 2, label: "Clear T2 Lake to unlock the Fishing Hole." },
  stargazing: { hoodId: "rooftops", tier: 3, label: "Clear T3 Rooftops to unlock Stargazing." }
};

function isMinigameUnlocked(id) {
  const gate = MINIGAME_GATES[id];
  if (!gate) return true;
  const key = `${gate.hoodId}-t${gate.tier}`;
  return !!(gameState?.bestiary?.hoodTiersCleared?.[key]);
}
function isGardenUnlocked()     { return isMinigameUnlocked("garden"); }
function isFishingUnlocked()    { return isMinigameUnlocked("fishing"); }
function isStargazingUnlocked() { return isMinigameUnlocked("stargazing"); }

// Passive XP rates for stationed cats. Modest compared to missions; a cat fishing for
// 24h gathers ~mid-tier-mission XP, which is reasonable for hands-off progression.
const STATION_XP_PER_CATCH   = 5;
const STATION_XP_PER_HARVEST = 50;
const STATION_XP_PER_DAY     = 100;

// --- Station assignment -------------------------------------------------

const STATION_LABELS = {
  fishing:    "Fishing Hole",
  garden:     "Catnip Garden",
  stargazing: "Stargazing perch"
};

function stationLabel(id) { return STATION_LABELS[id] || id; }

function getStationSave(stationId) {
  if (stationId === "fishing")    return gameState.fishing;
  if (stationId === "garden")     return gameState.garden;
  if (stationId === "stargazing") return gameState.stargazing;
  return null;
}

function getStationCatId(stationId) {
  return getStationSave(stationId)?.assignedCatId || null;
}

function assignCatToStation(stationId, catId) {
  if (!MINIGAME_GATES[stationId]) return { ok: false, reason: "Unknown station." };
  if (!isMinigameUnlocked(stationId)) return { ok: false, reason: MINIGAME_GATES[stationId].label };
  const cat = findCat(catId);
  if (!cat) return { ok: false, reason: "No such cat." };
  if (cat.status === "mission") return { ok: false, reason: `${cat.name} is on a mission.` };
  if (cat.status === "stationed" && cat.station === stationId) return { ok: false, reason: "Already assigned here." };
  // Swap: if the cat is at another station, unassign them from there first.
  if (cat.status === "stationed") unassignStation(cat.station);
  // If another cat is at this station, kick them out.
  const existing = getStationCatId(stationId);
  if (existing && existing !== catId) unassignStation(stationId);
  cat.status = "stationed";
  cat.station = stationId;
  getStationSave(stationId).assignedCatId = catId;
  logEvent(`${cat.name} takes up a post at the ${stationLabel(stationId)}.`);
  requestSave();
  return { ok: true };
}

function unassignStation(stationId) {
  const save = getStationSave(stationId);
  if (!save) return { ok: false, reason: "Unknown station." };
  const catId = save.assignedCatId;
  save.assignedCatId = null;
  if (catId) {
    const cat = findCat(catId);
    if (cat) {
      cat.status = "idle";
      cat.station = null;
      logEvent(`${cat.name} returns from the ${stationLabel(stationId)}.`);
    }
  }
  requestSave();
  return { ok: true };
}

// --- Stargazing ---------------------------------------------------------

// Rotate to today's sign if stale. Uses a deterministic hash of the UTC day key
// so rolling back the clock produces the same sign, and it doesn't matter when
// the tick fires during the day.
function refreshStarSign() {
  if (!gameState) return;
  if (!isStargazingUnlocked()) return; // no sign rolls before the Rooftops teach you
  // If a cat holds the perch AND a sign already exists, they keep it — no auto-rotate.
  // If no sign is set yet, fall through so the initial roll happens (the cat can then pick).
  if (gameState.stargazing?.assignedCatId && gameState.stargazing.signId) return;
  const today = utcDayKey();
  if (gameState.stargazing && gameState.stargazing.dayKey === today && gameState.stargazing.signId) return;
  const digits = today.replace(/-/g, "");
  const idx = (parseInt(digits, 10) || 0) % STAR_SIGNS.length;
  // Preserve assignedCatId/lastXpDay fields when replacing the stargazing state.
  gameState.stargazing = { ...(gameState.stargazing || {}), signId: STAR_SIGNS[idx].id, dayKey: today };
  logEvent(`\u2728 Tonight's sign: ${STAR_SIGNS[idx].name}. ${STAR_SIGNS[idx].flavor}`);
}

// With a cat assigned, the player can freely switch signs (no treaty cost). The active
// sign holds until replaced or the cat is unassigned.
function setStarSign(signId) {
  if (!isStargazingUnlocked()) return { ok: false, reason: MINIGAME_GATES.stargazing.label };
  if (!gameState.stargazing?.assignedCatId) return { ok: false, reason: "Assign a cat to the Stargazing perch to pick signs freely." };
  const sign = STAR_SIGNS.find(s => s.id === signId);
  if (!sign) return { ok: false, reason: "Unknown sign." };
  gameState.stargazing.signId = sign.id;
  gameState.stargazing.dayKey = utcDayKey();
  const cat = findCat(gameState.stargazing.assignedCatId);
  logEvent(`${cat ? cat.name : "Someone"} points to ${sign.name} \u2014 +${STAR_CHECK_BONUS} ${STAT_LABELS[sign.stat]} on all checks.`);
  requestSave();
  return { ok: true };
}

// Dynasty: retired cats in the Lounge passively train active (non-mission) cats.
// Each lounge cat contributes (BASE + warmHearth-perk-level) XP per hour, per active cat.
// Granularity is 1 minute — the accumulator waits until at least 1 XP/cat is due before
// flushing, so early ticks don't log-spam.
function tickLoungeTrickle(now) {
  if (!gameState.loungeCats?.length) return;
  if (!gameState.cats?.length) return;
  if (!gameState.lastLoungeTrickle) gameState.lastLoungeTrickle = now;
  const elapsedMs = now - gameState.lastLoungeTrickle;
  if (elapsedMs < 60 * 1000) return; // only flush every minute
  const ratePerHour = (LOUNGE_TRICKLE_XP_PER_CAT_PER_HOUR + eternalWarmHearth()) * gameState.loungeCats.length;
  const xpPerCat = Math.floor(ratePerHour * elapsedMs / (60 * 60 * 1000));
  if (xpPerCat < 1) return;
  let trained = 0;
  for (const cat of gameState.cats) {
    if (cat.status === "mission") continue; // mission cats earn mission XP instead
    grantXp(cat, xpPerCat);
    trained++;
  }
  gameState.lastLoungeTrickle = now;
  // Only log substantive batches to avoid noise.
  if (xpPerCat >= 10 && trained > 0) {
    logEvent(`\u{1F3E1} Lounge wisdom: +${xpPerCat}xp to ${trained} idle cat${trained > 1 ? "s" : ""}.`);
  }
}

// Daily tick for the stargazing cat: grant XP once per UTC day rollover while assigned.
function tickStargazing(now) {
  if (!isStargazingUnlocked()) return;
  const cat = findCat(gameState.stargazing?.assignedCatId);
  if (!cat) return;
  const today = utcDayKey(now);
  if (gameState.stargazing.lastXpDay && gameState.stargazing.lastXpDay !== today) {
    grantXp(cat, STATION_XP_PER_DAY);
  }
  gameState.stargazing.lastXpDay = today;
}

// Null before unlock so partyScore doesn't give a stargazing bonus on locked runs.
function currentStarSign() {
  if (!isStargazingUnlocked()) return null;
  if (!gameState?.stargazing?.signId) return null;
  return STAR_SIGNS.find(s => s.id === gameState.stargazing.signId) || null;
}

function rerollStarSign() {
  if (!isStargazingUnlocked()) return { ok: false, reason: MINIGAME_GATES.stargazing.label };
  if (!canAfford(STAR_REROLL_COST)) return { ok: false, reason: "Not enough \uD83C\uDF80." };
  payCost(STAR_REROLL_COST);
  const cur = currentStarSign();
  const others = STAR_SIGNS.filter(s => !cur || s.id !== cur.id);
  const next = choice(others);
  gameState.stargazing.signId = next.id;
  logEvent(`Stars shift: ${next.name} rises. ${next.flavor}`);
  requestSave();
  return { ok: true };
}

// --- Fishing ------------------------------------------------------------

function fishingDuration() {
  const rod = gameState?.fishing?.upgrades?.rod || 0;
  let dur = FISHING_BASE_DURATION * Math.pow(0.8, rod);
  // Assigned cat's DEX shortens cast time, capped at 30% reduction from the cat alone.
  const cat = findCat(gameState?.fishing?.assignedCatId);
  if (cat) {
    const dexBonus = Math.min(0.3, Math.max(0, effectiveStats(cat).dex - 5) * 0.01);
    dur *= (1 - dexBonus);
  }
  return Math.floor(dur);
}

function fishingBaitBonus() {
  return gameState?.fishing?.upgrades?.bait || 0;
}

// One place to build a cast record. Fixes the prior bug where auto-caster re-casts
// lacked a biteAt (so the HOOK! button never appeared on follow-up casts).
function createFishingCast(startedAt) {
  startedAt = startedAt || Date.now();
  const dur = fishingDuration();
  const biteFrac = FISHING_BITE_START_FRAC + Math.random() * (FISHING_BITE_END_FRAC - FISHING_BITE_START_FRAC);
  return {
    startedAt,
    durationMs: dur,
    biteAt: startedAt + Math.floor(dur * biteFrac)
  };
}

function castFishingLine() {
  if (!isFishingUnlocked()) return { ok: false, reason: MINIGAME_GATES.fishing.label };
  if (!gameState.fishing) return { ok: false, reason: "Fishing unavailable." };
  if (gameState.fishing.cast) return { ok: false, reason: "Line already in the water." };
  gameState.fishing.cast = createFishingCast();
  requestSave();
  return { ok: true };
}

// Which phase of a cast we're in, for UI state and click validation.
function fishingBiteState(now) {
  const cast = gameState.fishing?.cast;
  if (!cast) return "none";
  now = now || Date.now();
  const biteAt = cast.biteAt || 0;
  if (now < biteAt)                                   return "waiting";
  if (now < biteAt + FISHING_BITE_WINDOW_MS)          return "biting";
  return "missed";
}

// Player clicked HOOK! during the bite window — resolve immediately with a rarity boost.
// Clicks outside the window bounce politely; the line keeps its normal timer.
function hookFishingBite() {
  const cast = gameState.fishing?.cast;
  if (!cast) return { ok: false, reason: "No line cast." };
  const state = fishingBiteState();
  if (state === "waiting") return { ok: false, reason: "Too early \u2014 bobber is still." };
  if (state === "missed")  return { ok: false, reason: "Too late \u2014 the fish got away." };
  if (state !== "biting")  return { ok: false, reason: "Nothing to hook." };
  const res = resolveFishingCast({ rarityShift: FISHING_BITE_RARITY_SHIFT, hooked: true });
  // Auto-caster chain respects the early finish: re-cast right away.
  if (gameState.fishing.upgrades.auto) castFishingLine();
  requestSave();
  return { ok: true, reward: res };
}

// Resolve a finished cast. Returns the yielded reward description for logging/toast.
// opts.rarityShift moves weight from common tiers into rarer tiers for the roll.
// opts.hooked tags the log line so the player sees their active play rewarded.
function resolveFishingCast(opts) {
  opts = opts || {};
  const cast = gameState.fishing?.cast;
  if (!cast) return null;
  // Clone reward table so we can redistribute weight without mutating the catalog.
  const rewards = FISHING_REWARDS.map(r => ({ ...r }));
  // Combine the hook bonus (if any) with the assigned cat's WIS — each point above 5
  // adds a quarter shift level so a smart fisher-cat noticeably skews the reward table.
  let shift = opts.rarityShift || 0;
  const cat = findCat(gameState.fishing?.assignedCatId);
  if (cat) shift += Math.max(0, effectiveStats(cat).wis - 5) * 0.25;
  if (shift > 0) {
    // Each shift level moves 15 weight from the smallest-fish tier into bigger / rare tiers.
    // Split skews the bonus toward mid-rare catches so epic relics stay *epic*:
    //   60% big fish, 32% treaty, 8% relic. Keep weights fractional — the roll handles floats.
    const taken = Math.min(rewards[0].weight, shift * 15);
    rewards[0].weight -= taken;
    rewards[2].weight += taken * 0.60; // big fish
    rewards[3].weight += taken * 0.32; // treaty
    rewards[4].weight += taken * 0.08; // relic
  }
  const totalW = rewards.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * totalW;
  let reward = rewards[0];
  for (const r of rewards) {
    roll -= r.weight;
    if (roll <= 0) { reward = r; break; }
  }
  let summary = reward.note;
  if (reward.kind === "fish") {
    const amt = randInt(reward.min, reward.max) + fishingBaitBonus();
    gameState.fishes = (gameState.fishes || 0) + amt;
    summary += ` +${amt}\uD83D\uDC1F`;
  } else if (reward.kind === "treaty") {
    gameState.treaties = (gameState.treaties || 0) + (reward.amount || 1);
    summary += ` +${reward.amount}\uD83C\uDF80`;
  } else if (reward.kind === "relic") {
    const item = generateItem(reward.rarity || "epic", {});
    gameState.inventory.push(item);
    recordItemFound(item);
    summary += ` ${item.name}`;
  }
  gameState.fishing.cast = null;
  gameState.fishing.totalCaught = (gameState.fishing.totalCaught || 0) + 1;
  const prefix = opts.hooked ? "\uD83C\uDFA3 Hooked! " : "\uD83C\uDFA3 ";
  logEvent(`${prefix}${summary}`);
  // Passive XP for the assigned fisher-cat.
  if (cat) grantXp(cat, STATION_XP_PER_CATCH);
  return { reward, summary, hooked: !!opts.hooked };
}

// Called each tick. Auto-resolves a finished cast. Chains into the next cast when either
// the Auto-Caster upgrade is owned OR a cat is assigned to the station.
function tickFishing(now) {
  if (!gameState.fishing) return;
  let guard = 200; // sanity
  while (guard-- > 0) {
    const cast = gameState.fishing.cast;
    if (!cast) break;
    if ((cast.startedAt + cast.durationMs) > now) break;
    const finishedAt = cast.startedAt + cast.durationMs;
    resolveFishingCast();
    const auto = gameState.fishing.upgrades.auto || !!gameState.fishing.assignedCatId;
    if (!auto) break;
    // Anchor the re-cast at the previous finish time so long offline catch-ups chain cleanly.
    gameState.fishing.cast = createFishingCast(finishedAt);
  }
}

function buyFishingUpgrade(id) {
  if (!isFishingUnlocked()) return { ok: false, reason: MINIGAME_GATES.fishing.label };
  const up = FISHING_UPGRADES.find(u => u.id === id);
  if (!up) return { ok: false, reason: "Unknown upgrade." };
  const lvl = gameState.fishing.upgrades[id] || 0;
  if (lvl >= up.max) return { ok: false, reason: "Maxed out." };
  const cost = up.costFn(lvl);
  if (!canAfford(cost)) return { ok: false, reason: "Can't afford." };
  payCost(cost);
  gameState.fishing.upgrades[id] = lvl + 1;
  logEvent(`Fishing upgrade: ${up.name} \u2192 ${lvl + 1}.`);
  requestSave();
  return { ok: true };
}

// --- Catnip Garden ------------------------------------------------------

function availableSeeds() {
  return GARDEN_SEEDS.filter(s => !s.requiresPrestige || (gameState.prestigeCount || 0) >= s.requiresPrestige);
}

function plantSeed(plotIdx, seedId) {
  if (!isGardenUnlocked()) return { ok: false, reason: MINIGAME_GATES.garden.label };
  if (!gameState.garden) return { ok: false, reason: "Garden unavailable." };
  if (plotIdx < 0 || plotIdx >= GARDEN_PLOTS) return { ok: false, reason: "Bad plot." };
  if (gameState.garden.plots[plotIdx]) return { ok: false, reason: "Plot occupied." };
  const seed = GARDEN_SEEDS.find(s => s.id === seedId);
  if (!seed) return { ok: false, reason: "Unknown seed." };
  if (seed.requiresPrestige && (gameState.prestigeCount || 0) < seed.requiresPrestige) {
    return { ok: false, reason: `Requires Prestige ${seed.requiresPrestige}.` };
  }
  if (!canAfford(seed.cost)) return { ok: false, reason: "Can't afford seed." };
  payCost(seed.cost);
  const now = Date.now();
  gameState.garden.plots[plotIdx] = { seedId, plantedAt: now, finishedAt: now + seed.growMs };
  logEvent(`\uD83C\uDF31 Planted ${seed.name} in plot ${plotIdx + 1}.`);
  requestSave();
  return { ok: true };
}

function harvestPlot(plotIdx) {
  const plot = gameState.garden?.plots?.[plotIdx];
  if (!plot) return { ok: false, reason: "Empty plot." };
  if (Date.now() < plot.finishedAt) return { ok: false, reason: "Not ready yet." };
  const seed = GARDEN_SEEDS.find(s => s.id === plot.seedId);
  if (!seed) { gameState.garden.plots[plotIdx] = null; return { ok: false, reason: "Lost seed." }; }
  // Assigned gardener-cat's INT biases the yield roll toward the seed's rarest yield.
  // Each point above 5 moves 2 weight from the commonest yield to the rarest.
  const gardener = findCat(gameState.garden?.assignedCatId);
  const yields = seed.yields.map(y => ({ ...y }));
  if (gardener && yields.length > 1) {
    const intBonus = Math.max(0, effectiveStats(gardener).int - 5);
    if (intBonus > 0) {
      const take = Math.min(yields[0].weight, intBonus * 2);
      yields[0].weight -= take;
      yields[yields.length - 1].weight += take;
    }
  }
  const totalW = yields.reduce((s, y) => s + y.weight, 0);
  let roll = Math.random() * totalW;
  let y = yields[0];
  for (const opt of yields) {
    roll -= opt.weight;
    if (roll <= 0) { y = opt; break; }
  }
  // Apply yield.
  if      (y.kind === "fishes")      gameState.fishes    = (gameState.fishes    || 0) + y.amount;
  else if (y.kind === "treaties")    gameState.treaties  = (gameState.treaties  || 0) + y.amount;
  else if (y.kind === "nineLives")   gameState.nineLives = (gameState.nineLives || 0) + y.amount;
  else if (y.kind === "clubXp")      grantClubXp(y.amount);
  else if (y.kind === "strayBonus")  gameState.shop.pendingStrayBonus = (gameState.shop.pendingStrayBonus || 0) + y.amount;
  else if (y.kind === "rarityShift") gameState.pendingRarityShift = (gameState.pendingRarityShift || 0) + y.amount;
  gameState.garden.plots[plotIdx] = null;
  logEvent(`\uD83C\uDF3F Harvested: ${y.note}`);
  if (gardener) grantXp(gardener, STATION_XP_PER_HARVEST);
  requestSave();
  return { ok: true, yield: y };
}

// Tick for the garden: if a cat is assigned, auto-harvest ready plots and (if autoPlant
// is on + fishes available) auto-plant catnip in empty plots. Called from the main tick().
function tickGarden(now) {
  if (!gameState.garden) return;
  if (!gameState.garden.assignedCatId) return;
  // Auto-harvest any ready plots first so newly-empty plots are replant candidates.
  for (let i = 0; i < gameState.garden.plots.length; i++) {
    const p = gameState.garden.plots[i];
    if (p && p.finishedAt <= now) harvestPlot(i);
  }
  // Auto-plant catnip in empty plots when affordable and the toggle is on.
  if (gameState.garden.autoPlant) {
    const catnip = GARDEN_SEEDS.find(s => s.id === "catnip");
    if (catnip) {
      for (let i = 0; i < gameState.garden.plots.length; i++) {
        if (gameState.garden.plots[i]) continue;
        if (!canAfford(catnip.cost)) break; // stop once we run out of fishes
        plantSeed(i, "catnip");
      }
    }
  }
}

// startMission accepts two call shapes:
//   startMission(catIds, neighborhoodId, tier, searchForStrays)    — regular tier mission
//   startMission(catIds, missionObject, searchForStrays)            — synthetic mission (daily/boss)
function startMission(catIds, missionOrNbId, tierOrSearch, maybeSearch) {
  if (!Array.isArray(catIds) || !catIds.length) return { ok: false, reason: "Pick at least one cat." };

  let mission, searchForStrays;
  if (typeof missionOrNbId === "string") {
    mission = getMission(missionOrNbId, tierOrSearch);
    searchForStrays = maybeSearch;
    if (!mission) return { ok: false, reason: "Unknown mission." };
    if (!isTierUnlocked(tierOrSearch)) return { ok: false, reason: "Tier locked." };
  } else {
    mission = missionOrNbId;
    searchForStrays = tierOrSearch;
    if (!mission) return { ok: false, reason: "Unknown mission." };
  }
  const neighborhoodId = mission.neighborhoodId;
  const tier = mission.tier;

  if (mission.requiresFullParty && catIds.length < partyMax()) {
    return { ok: false, reason: `Requires a full party of ${partyMax()}.` };
  }
  if (catIds.length > partyMax()) return { ok: false, reason: `Max party size is ${partyMax()}.` };

  const cats = catIds.map(findCat);
  if (cats.some(c => !c)) return { ok: false, reason: "Missing cat." };
  if (cats.some(c => c.status !== "idle")) return { ok: false, reason: "Some cats are busy." };

  // Challenge restriction check. Must come after cats are resolved so we can inspect gear/breeds.
  const chOk = validateChallenge(catIds, mission);
  if (!chOk.ok) return { ok: false, reason: chOk.reason };

  // Duration shortens by best DEX + Prowler passive (+ any synergy speed). Combined floored at 35%.
  const bestDex = Math.max(...cats.map(c => effectiveStats(c).dex));
  const dexBonus = Math.max(0, Math.min(0.5, (bestDex - 5) * 0.02));
  const speedPct = partyBonuses(catIds).speedPct;
  const durationMul = Math.max(0.35, (1 - dexBonus) * (1 - speedPct));
  const duration = Math.floor(mission.duration * durationMul);

  // Lock in stray consumables at mission start — but only if actually searching,
  // so players don't waste buffs on no-stray runs when the club is full.
  let lockedSummons = 0;
  let lockedBonus = 0;
  if (searchForStrays && gameState.cats.length < clubMax()) {
    if (gameState.shop?.pendingStraySummons > 0) {
      lockedSummons = 1;
      gameState.shop.pendingStraySummons--;
    }
    if (gameState.shop?.pendingStrayBonus > 0) {
      lockedBonus = gameState.shop.pendingStrayBonus;
      gameState.shop.pendingStrayBonus = 0;
    }
  }
  // Garden rarity-shift buff: consumed unconditionally on mission start so it always has effect.
  let lockedRarityShift = 0;
  if ((gameState.pendingRarityShift || 0) > 0) {
    lockedRarityShift = gameState.pendingRarityShift;
    gameState.pendingRarityShift = 0;
  }

  const active = {
    id: uid(),
    missionKey: mission.id,
    mission: { ...mission, primaryChecks: [...mission.primaryChecks] }, // cached for resolve
    neighborhoodId,
    tier,
    catIds: [...catIds],
    startedAt: Date.now(),
    durationMs: duration,
    searchForStrays: !!searchForStrays,
    straySummoned: lockedSummons > 0,
    strayBonusChance: lockedBonus,
    rarityShiftBonus: lockedRarityShift,
    dailyId: mission.dailyId || null,
    bossId:  mission.bossId  || null
  };
  for (const c of cats) {
    c.status = "mission";
    c.missionId = active.id;
  }
  gameState.missions.push(active);
  gameState.lastParty = [...catIds];
  // Pack Leader achievement flag: set the first time a 3+ cat party departs.
  if (catIds.length >= 3) {
    gameState.achievementFlags = gameState.achievementFlags || {};
    gameState.achievementFlags.ranThreeCatMission = true;
  }
  const hood = NEIGHBORHOODS[neighborhoodId];
  const names = cats.map(c => c.name).join(", ");
  logEvent(`${names} set off for T${tier} ${hood.name}.`);
  checkAchievements();
  saveStateNow();
  return { ok: true, mission: active };
}

function resolveMission(active) {
  // Prefer the cached mission (dailies/bosses carry modifier-applied values there); fall back to lookup.
  const mission = active.mission || getMission(active.neighborhoodId, active.tier);
  const cats = active.catIds.map(findCat).filter(Boolean);
  if (!mission || !cats.length) {
    gameState.missions = gameState.missions.filter(m => m.id !== active.id);
    return null;
  }

  const score = partyScore(active.catIds, mission);
  const effectsSummary = missionEffectsSummary(active.catIds, mission);
  const margin = score - effectsSummary.effectiveDC;

  const bonuses = partyBonuses(active.catIds);

  let outcome, goldMul, xpMul, lootMul;
  if (margin >= 6) { outcome = "crit";    goldMul = 1.5; xpMul = 1.5; lootMul = 1.5; }
  else if (margin >= 0) { outcome = "success"; goldMul = 1.0; xpMul = 1.0; lootMul = 1.0; }
  else {
    outcome = "fail";
    const bestCon = Math.max(...cats.map(c => effectiveStats(c).con));
    const conFloor = Math.min(0.75, 0.2 + Math.max(0, bestCon - 5) * 0.03);
    // Purrist "Tending" adds flat % to failure floor. Base cap 0.9, Sanctuary talent raises it.
    const talents = partyTalentTotals(active.catIds);
    const floorCap = 0.9 + (talents.floorCapRaise || 0);
    const floor = Math.min(floorCap, conFloor + bonuses.floorPct);
    goldMul = floor; xpMul = floor; lootMul = floor * 0.5;
  }

  const bestCha = Math.max(...cats.map(c => effectiveStats(c).cha));
  const chaBonus = 1 + Math.max(0, bestCha - 5) * 0.03;

  // Party-size reward scaling: bigger party splits the effort but brings back more.
  const partySizeBonus = 1 + (cats.length - 1) * 0.15; // 1.00 / 1.15 / 1.30 / 1.45
  // Full Spectrum synergy adds to gold as well.
  const goldSynergyMul = 1 + bonuses.goldPct;

  const rawGold = randInt(mission.goldRange[0], mission.goldRange[1]);
  const gold = Math.max(1, Math.floor(rawGold * goldMul * chaBonus * partySizeBonus * goldSynergyMul * bestiaryGlobalGoldMul() * eternalGoldMul()));
  const xpPerCat = Math.max(1, Math.floor(mission.xpReward * xpMul * (1 + bonuses.xpPct) * eternalXpMul()));

  // Fishes: small count per mission, scaled by outcome and party size. Ranger Pathfinder
  // talent bumps the multiplier for its party.
  const talentTotals = partyTalentTotals(active.catIds);
  const rawFish = randInt(mission.fishRange[0], mission.fishRange[1]);
  const fishes = Math.max(0, Math.floor(rawFish * goldMul * partySizeBonus * (1 + (talentTotals.fishPct || 0))));

  // Treaties: rare drop, only meaningful at higher tiers. Plus any daily/boss guaranteed bonus.
  let treaties = 0;
  if (outcome !== "fail" && Math.random() < mission.treatyChance * partySizeBonus) {
    treaties = 1 + (outcome === "crit" ? 1 : 0);
  }
  if (outcome !== "fail") treaties += (mission.bonusTreaties || 0);

  const items = [];
  const bestWis = Math.max(...cats.map(c => effectiveStats(c).wis));
  const lootBonusMul = 1 + bonuses.lootPct;
  const lootRolls = Math.max(1, mission.lootRolls || 1);
  const combinedRarityShift = (bonuses.rarityShift || 0) + (mission.rarityShift || 0) + (active.rarityShiftBonus || 0);
  for (let i = 0; i < cats.length; i++) {
    for (let r = 0; r < lootRolls; r++) {
      if (Math.random() < mission.lootChance * lootMul * lootBonusMul) {
        const item = rollLoot(mission, { wis: bestWis, int: effectiveStats(cats[i]).int, rarityShift: combinedRarityShift });
        if (item) {
          items.push(item);
          if (item.rarity === "legendary") {
            gameState.achievementFlags = gameState.achievementFlags || {};
            gameState.achievementFlags.sawLegendary = true;
            // Ranger "Apex Predator" talent grants +1 treaty per legendary.
            if (talentTotals.apexPredator) gameState.treaties = (gameState.treaties || 0) + 1;
          }
        }
      }
    }
  }
  // Weekly Boss: guarantee a set number of legendary drops on success/crit.
  if (mission.guaranteedLegendaries && outcome !== "fail") {
    for (let g = 0; g < mission.guaranteedLegendaries; g++) {
      const legendary = generateItem("legendary", { rarityShift: combinedRarityShift });
      if (legendary) {
        items.push(legendary);
        gameState.achievementFlags = gameState.achievementFlags || {};
        gameState.achievementFlags.sawLegendary = true;
        if (talentTotals.apexPredator) gameState.treaties = (gameState.treaties || 0) + 1;
      }
    }
  }

  gameState.gold += gold;
  gameState.fishes += fishes;
  gameState.treaties += treaties;
  gameState.cumulativeGold = (gameState.cumulativeGold || 0) + gold;
  // Track the highest tier cleared this run (fuels Nine Lives formula).
  if (outcome !== "fail" && mission.tier > (gameState.highestTier || 0)) {
    gameState.highestTier = mission.tier;
  }
  // Auto-sell commons bonus: if the shop upgrade is active, common drops convert to 10g.
  // Every dropped item also counts toward the bestiary's item-template set regardless of auto-sell.
  for (const item of items) {
    recordItemFound(item);
    if (gameState.shop?.autoSellCommons && item.rarity === "common") {
      const v = 10;
      gameState.gold += v;
      gameState.cumulativeGold += v;
    } else {
      gameState.inventory.push(item);
    }
  }
  for (const c of cats) grantXp(c, xpPerCat);

  gameState.missions = gameState.missions.filter(m => m.id !== active.id);
  for (const c of cats) { c.status = "idle"; c.missionId = null; }

  // Mark daily / boss completions on non-failure outcomes. Also feed the bestiary counters
  // and apply their tiered rewards (extra treaties per daily, extra 🌀 per boss).
  // The tier is read BEFORE incrementing the counter, so the bonus from the Nth clear scales
  // with what you'd already achieved — past clears "pay into" future ones.
  if (active.dailyId && outcome !== "fail") {
    const d = (gameState.dailyChallenges || []).find(x => x.id === active.dailyId);
    if (d && !d.completed) {
      d.completed = true;
      const bonusTreaties = bestiaryDailyTreaty();
      if (bonusTreaties > 0) gameState.treaties = (gameState.treaties || 0) + bonusTreaties;
      gameState.bestiary.dailiesCompleted = (gameState.bestiary.dailiesCompleted || 0) + 1;
      checkBestiary();
    }
  }
  if (active.bossId && outcome !== "fail") {
    if (gameState.weeklyBoss && gameState.weeklyBoss.id === active.bossId && !gameState.weeklyBoss.completed) {
      gameState.weeklyBoss.completed = true;
      const bonusNineLives = bestiaryBossNineLives();
      if (bonusNineLives > 0) gameState.nineLives = (gameState.nineLives || 0) + bonusNineLives;
      gameState.bestiary.bossesDefeated = (gameState.bestiary.bossesDefeated || 0) + 1;
      checkBestiary();
    }
  }

  // Bestiary: track per-tier clears (hood + tier). Hook mastery XP + challenge progress.
  if (outcome !== "fail") {
    recordHoodTierCleared(active.neighborhoodId, mission.tier);
  }
  const masteryMul = outcome === "crit" ? 1.5 : outcome === "success" ? 1.0 : 0.5;
  grantSlotMastery(active.catIds, masteryMul);
  recordChallengeProgress(active, mission, outcome);

  // Club XP: 5% of each cat's xpReward contribution feeds the club pool.
  grantClubXp(Math.max(1, Math.floor(xpPerCat * cats.length * 0.05)));

  // Stray offer: guaranteed if a Summons was locked in; else roll base+tier+consumable bonus.
  let strayOffer = null;
  if (gameState.cats.length < clubMax()) {
    if (active.straySummoned) {
      strayOffer = rollCat();
    } else if (active.searchForStrays) {
      const strayChance = STRAY_BASE_CHANCE + (mission.tier - 1) * STRAY_TIER_BONUS + (active.strayBonusChance || 0) + bestiaryStrayBonus() + eternalStrayPct();
      if (Math.random() < strayChance) strayOffer = rollCat();
    }
  }

  const hood = NEIGHBORHOODS[active.neighborhoodId];
  const verb = outcome === "crit" ? "triumph at" : outcome === "success" ? "return from" : "limp back from";
  const lootTxt = items.length ? `, ${items.length} loot` : "";
  const fishTxt = fishes ? `, +${fishes}🐟` : "";
  const treatyTxt = treaties ? `, +${treaties}🎀` : "";

  // Hazard feedback: identify the worst unmitigated hazard (if any).
  const topUnmitigated = [...effectsSummary.effects]
    .filter(e => e.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)[0] || null;

  let hazardTail = "";
  if (outcome === "fail" && topUnmitigated) {
    hazardTail = ` — ${topUnmitigated.name} (+${topUnmitigated.remaining}) overwhelmed them.`;
  } else if (effectsSummary.netPenalty > 0) {
    hazardTail = ` (hazards +${effectsSummary.netPenalty} DC)`;
  }

  logEvent(`${cats.map(c => c.name).join(", ")} ${verb} T${mission.tier} ${hood.name} (+${gold}💰, +${xpPerCat}xp each${fishTxt}${treatyTxt}${lootTxt})${hazardTail}`);

  checkAchievements();

  // Quest lifecycle: flush synchronously so a resolved mission's rewards are never lost.
  saveStateNow();

  return {
    missionKey: mission.id,
    neighborhoodId: active.neighborhoodId,
    tier: mission.tier,
    catNames: cats.map(c => c.name),
    outcome,
    score,
    difficulty: mission.difficulty,
    effectiveDC: effectsSummary.effectiveDC,
    netPenalty: effectsSummary.netPenalty,
    topUnmitigated,
    gold,
    fishes,
    treaties,
    xp: xpPerCat,
    items,
    strayOffer
  };
}

function rollLoot(mission, stats) {
  const weights = { ...mission.rarityWeights };
  const wisShift = Math.max(0, (stats.wis || 0) - 5);
  const trackerShift = Math.max(0, stats.rarityShift || 0);
  const move = wisShift * 1.0 + trackerShift;
  weights.common    = Math.max(0, (weights.common    || 0) - move);
  weights.rare      =             (weights.rare      || 0) + move * 0.5;
  weights.epic      =             (weights.epic      || 0) + move * 0.4;
  weights.legendary =             (weights.legendary || 0) + move * 0.1;

  const total = RARITY_ORDER.reduce((s, r) => s + (weights[r] || 0), 0);
  let roll = Math.random() * total;
  let rarity = "common";
  for (const r of RARITY_ORDER) {
    roll -= weights[r] || 0;
    if (roll <= 0) { rarity = r; break; }
  }
  return generateItem(rarity, stats);
}

function generateItem(rarity, stats) {
  const tier = RARITY_TIERS[rarity];
  const typeId = choice(Object.keys(ITEM_TYPES));
  const typeName = choice(ITEM_TYPES[typeId]);
  const adjective = choice(tier.adjectives);

  let numAffixes = tier.numAffixes;
  if (stats && rarity !== "legendary" && Math.random() < Math.max(0, (stats.int || 0) - 5) * 0.03) {
    numAffixes = Math.min(2, numAffixes + 1);
  }

  const pool = [...STATS];
  const affixStats = [];
  for (let i = 0; i < numAffixes; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    affixStats.push(pool.splice(idx, 1)[0]);
  }
  const bonus = {};
  for (const s of affixStats) bonus[s] = tier.bonusValue;

  const affinity = choice(NEIGHBORHOOD_IDS);
  const suffix = choice(STAT_SUFFIXES[affixStats[0]]);
  const name = `${adjective} ${typeName} ${suffix}`;

  return { id: uid(), type: typeId, rarity, name, bonus, affinity };
}

function grantXp(cat, amount) {
  cat.xp += amount;
  while (cat.level < LEVEL_CAP && cat.xp >= xpToNext(cat.level)) {
    cat.xp -= xpToNext(cat.level);
    cat.level++;

    // Per-level auto-bump of a breed-favored stat.
    const breed = CAT_BREEDS[cat.breed];
    const pool = [...breed.primaries, ...breed.secondaries];
    let target = pickLowestUncapped(cat, pool);
    if (!target) target = pickLowestUncapped(cat, STATS);
    if (target) cat.stats[target]++;

    // Every 5th level: queue a player-driven stat choice AND a talent point.
    if (cat.level % 5 === 0) {
      cat.pendingStatChoices = (cat.pendingStatChoices || 0) + 1;
      cat.pendingTalentPoints = (cat.pendingTalentPoints || 0) + 1;
      logEvent(`${cat.name} reached level ${cat.level} — stat choice + talent point available.`);
    } else {
      logEvent(`${cat.name} reached level ${cat.level}.`);
    }
  }
}

// --- Talents ---------------------------------------------------------

// Returns the class's tree for a cat.
function talentTreeFor(cat) {
  if (!cat) return [];
  return TALENT_TREES[cat.breed] || [];
}

// Index of the next pickable node (the first unpicked node in linear order). -1 if maxed.
function nextTalentIdx(cat) {
  const tree = talentTreeFor(cat);
  for (let i = 0; i < tree.length; i++) {
    if (!cat.talents?.[tree[i].id]) return i;
  }
  return -1;
}

// Pick a talent. Enforces linear order and available points; applies stat talents instantly.
function pickTalent(catId, talentId) {
  const cat = findCat(catId);
  if (!cat) return { ok: false, reason: "No such cat." };
  if ((cat.pendingTalentPoints || 0) < 1) return { ok: false, reason: "No talent points to spend." };
  const tree = talentTreeFor(cat);
  const idx = tree.findIndex(n => n.id === talentId);
  if (idx === -1) return { ok: false, reason: "Unknown talent." };
  if (cat.talents?.[talentId]) return { ok: false, reason: "Already picked." };
  // Linear-tree guard: every earlier node must be picked first.
  for (let i = 0; i < idx; i++) {
    if (!cat.talents[tree[i].id]) return { ok: false, reason: `Requires ${tree[i].name} first.` };
  }
  cat.talents = cat.talents || {};
  cat.talents[talentId] = true;
  cat.pendingTalentPoints--;
  const node = tree[idx];
  // Instant-stat talents mutate baseStats permanently (bypasses the 12 cap per game rules).
  if (node.stat) {
    cat.baseStats[node.stat.stat] = (cat.baseStats[node.stat.stat] || 0) + node.stat.amount;
    cat.stats[node.stat.stat]     = (cat.stats[node.stat.stat]     || 0) + node.stat.amount;
  }
  logEvent(`${cat.name} learned ${node.name}.`);
  requestSave();
  return { ok: true };
}

// Sum talent mission-bonus fields across a party for mission math.
function partyTalentTotals(catIds) {
  const totals = { mit: 0, lootPct: 0, speedPct: 0, xpPct: 0, scoreBonus: 0, rarityShift: 0, goldPct: 0, fishPct: 0, hazardReduction: 0, floorCapRaise: 0, apexPredator: false };
  for (const id of catIds) {
    const cat = findCat(id);
    if (!cat) continue;
    const tree = talentTreeFor(cat);
    for (const node of tree) {
      if (!cat.talents?.[node.id]) continue;
      if (!node.missionBonus) continue;
      const mb = node.missionBonus;
      for (const k of Object.keys(totals)) {
        if (mb[k] === true) totals[k] = true;
        else if (typeof mb[k] === "number") totals[k] += mb[k];
      }
    }
  }
  return totals;
}

function spendStatChoice(catId, stat) {
  const cat = findCat(catId);
  if (!cat) return false;
  if (!cat.pendingStatChoices || cat.pendingStatChoices <= 0) return false;
  if (!STATS.includes(stat)) return false;
  if (cat.stats[stat] >= BASE_STAT_CAP) return false;
  cat.stats[stat]++;
  cat.pendingStatChoices--;
  logEvent(`${cat.name} trained ${STAT_LABELS[stat]} to ${cat.stats[stat]}.`);
  requestSave();
  return true;
}

function pickLowestUncapped(cat, pool) {
  let best = null;
  for (const s of pool) {
    if (cat.stats[s] >= BASE_STAT_CAP) continue;
    if (!best || cat.stats[s] < cat.stats[best]) best = s;
  }
  return best;
}

// --- Inventory / roster -------------------------------------------------

function equipItem(catId, itemId) {
  const cat = findCat(catId);
  const item = findItem(itemId);
  if (!cat || !item) return false;
  for (const c of gameState.cats) {
    if (c.equipped[item.type] === itemId) c.equipped[item.type] = null;
  }
  cat.equipped[item.type] = itemId;
  requestSave();
  return true;
}

function unequipItem(catId, slot) {
  const cat = findCat(catId);
  if (!cat) return false;
  cat.equipped[slot] = null;
  requestSave();
  return true;
}

function isItemEquipped(itemId) {
  for (const c of gameState.cats) {
    for (const slot of ITEM_SLOTS) if (c.equipped[slot] === itemId) return true;
  }
  return false;
}

// Bulk sell: predicate(item) => bool. Returns { count, value }.
function sellMatching(predicate) {
  const victims = gameState.inventory.filter(i => predicate(i) && !isItemEquipped(i.id));
  let total = 0;
  for (const item of victims) {
    const v = Math.max(1, RARITY_TIERS[item.rarity].bonusValue * 10);
    total += v;
  }
  const ids = new Set(victims.map(v => v.id));
  gameState.inventory = gameState.inventory.filter(i => !ids.has(i.id));
  if (victims.length) {
    gameState.gold += total;
    gameState.cumulativeGold = (gameState.cumulativeGold || 0) + total;
    logEvent(`Sold ${victims.length} item${victims.length > 1 ? "s" : ""} for ${total}g.`);
    requestSave();
  }
  return { count: victims.length, value: total };
}

function sellItem(itemId) {
  const item = findItem(itemId);
  if (!item) return false;
  for (const c of gameState.cats) {
    for (const slot of ITEM_SLOTS) {
      if (c.equipped[slot] === itemId) c.equipped[slot] = null;
    }
  }
  const value = Math.max(1, RARITY_TIERS[item.rarity].bonusValue * 10);
  gameState.gold += value;
  gameState.cumulativeGold = (gameState.cumulativeGold || 0) + value;
  gameState.inventory = gameState.inventory.filter(i => i.id !== itemId);
  logEvent(`Sold ${item.name} for ${value}g.`);
  requestSave();
  return true;
}

// Retire a cat: gear returns to inventory (already there since it's shared),
// the cat is removed entirely. Equip slots are cleared so items free up.
function retireCat(catId) {
  const cat = findCat(catId);
  if (!cat) return { ok: false, reason: "No such cat." };
  if (cat.status === "mission") return { ok: false, reason: "Cat is on a mission." };
  if (cat.status === "stationed") return { ok: false, reason: `Unassign from the ${stationLabel(cat.station)} first.` };
  for (const slot of ITEM_SLOTS) cat.equipped[slot] = null;
  // Snapshot for the Cat Lounge gallery.
  (gameState.loungeCats = gameState.loungeCats || []).unshift({
    id: cat.id,
    name: cat.name,
    breed: cat.breed,
    palette: { ...cat.palette },
    finalLevel: cat.level,
    finalStats: { ...cat.stats },
    retiredAt: Date.now()
  });
  gameState.cats = gameState.cats.filter(c => c.id !== catId);
  logEvent(`${cat.name} retired to the Cat Lounge. Happy mousing.`);
  checkAchievements();
  requestSave();
  return { ok: true };
}

// --- Club Shop ----------------------------------------------------------

// Effective cost factors in the Merchant club perk (20% off consumables).
function effectiveShopCost(cost) {
  const mul = gameState?.clubPerks?.merchant ? 0.8 : 1;
  return {
    gold:     Math.ceil((cost.gold     || 0) * mul),
    fishes:   Math.ceil((cost.fishes   || 0) * mul),
    treaties: Math.ceil((cost.treaties || 0) * mul)
  };
}

function canAfford(cost) {
  const c = effectiveShopCost(cost);
  if (c.gold     > gameState.gold)     return false;
  if (c.fishes   > gameState.fishes)   return false;
  if (c.treaties > gameState.treaties) return false;
  return true;
}

function payCost(cost) {
  const c = effectiveShopCost(cost);
  gameState.gold     -= c.gold;
  gameState.fishes   -= c.fishes;
  gameState.treaties -= c.treaties;
}

function formatCost(cost) {
  const c = effectiveShopCost(cost);
  const parts = [];
  if (c.gold)     parts.push(`${c.gold}\uD83D\uDCB0`);
  if (c.fishes)   parts.push(`${c.fishes}\uD83D\uDC1F`);
  if (c.treaties) parts.push(`${c.treaties}\uD83C\uDF80`);
  return parts.join(" ");
}

function shopItemAvailable(item) {
  if (item.oneTime && item.id === "autosell" && gameState.shop.autoSellCommons) return false;
  return true;
}

function buyAutosell() {
  const item = SHOP_ITEMS.find(i => i.id === "autosell");
  if (gameState.shop.autoSellCommons) return { ok: false, reason: "Already unlocked." };
  if (!canAfford(item.cost)) return { ok: false, reason: "Not enough moneys." };
  payCost(item.cost);
  gameState.shop.autoSellCommons = true;
  logEvent("Auto-sell Commons unlocked.");
  requestSave();
  return { ok: true };
}

function buyStraySummons() {
  const item = SHOP_ITEMS.find(i => i.id === "summons");
  if (!canAfford(item.cost)) return { ok: false, reason: "Not enough treaties." };
  payCost(item.cost);
  gameState.shop.pendingStraySummons++;
  logEvent(`Stray Summons stashed. Total pending: ${gameState.shop.pendingStraySummons}.`);
  requestSave();
  return { ok: true };
}

function buyStrayConsumable(shopItemId) {
  const shopItem = SHOP_ITEMS.find(i => i.id === shopItemId);
  if (!shopItem || !shopItem.strayBonus) return { ok: false, reason: "Not a stray consumable." };
  if (!canAfford(shopItem.cost)) return { ok: false, reason: "Not enough fishes." };
  payCost(shopItem.cost);
  gameState.shop.pendingStrayBonus = (gameState.shop.pendingStrayBonus || 0) + shopItem.strayBonus;
  logEvent(`${shopItem.name} stashed. Next mission stray bonus: +${Math.round(gameState.shop.pendingStrayBonus * 100)}%.`);
  requestSave();
  return { ok: true };
}

function buyTrainingTin(catId) {
  const item = SHOP_ITEMS.find(i => i.id === "training");
  const cat = findCat(catId);
  if (!cat) return { ok: false, reason: "No such cat." };
  if (!canAfford(item.cost)) return { ok: false, reason: "Not enough fishes." };
  payCost(item.cost);
  grantXp(cat, 500);
  logEvent(`${cat.name} savored a Training Tin (+500 xp).`);
  requestSave();
  return { ok: true };
}

function buyElementReroll(itemId) {
  const shopItem = SHOP_ITEMS.find(i => i.id === "reroll");
  const loot = findItem(itemId);
  if (!loot) return { ok: false, reason: "No such item." };
  if (!canAfford(shopItem.cost)) return { ok: false, reason: "Not enough fishes." };
  payCost(shopItem.cost);
  const options = NEIGHBORHOOD_IDS.filter(id => id !== loot.affinity);
  loot.affinity = choice(options);
  const hood = NEIGHBORHOODS[loot.affinity];
  logEvent(`${loot.name} retagged to ${hood.icon} ${hood.name}.`);
  requestSave();
  return { ok: true };
}

// Stat Tonic grants a pending stat choice on the cat (reuses the level-up modal).
function buyStatTonic(catId) {
  const shopItem = SHOP_ITEMS.find(i => i.id === "tonic");
  const cat = findCat(catId);
  if (!cat) return { ok: false, reason: "No such cat." };
  if (!canAfford(shopItem.cost)) return { ok: false, reason: "Not enough treaties." };
  // Require at least one stat under cap.
  if (STATS.every(s => cat.stats[s] >= BASE_STAT_CAP)) return { ok: false, reason: "All stats at cap." };
  payCost(shopItem.cost);
  cat.pendingStatChoices = (cat.pendingStatChoices || 0) + 1;
  logEvent(`${cat.name} drank a Stat Tonic. Choose a stat to train.`);
  requestSave();
  return { ok: true };
}

function buyKittenFormula(catId, newBreedId) {
  const shopItem = SHOP_ITEMS.find(i => i.id === "kitten");
  const cat = findCat(catId);
  if (!cat) return { ok: false, reason: "No such cat." };
  if (cat.status !== "idle") return { ok: false, reason: "Cat is on a mission." };
  if (!CAT_BREEDS[newBreedId]) return { ok: false, reason: "Unknown class." };
  if (!canAfford(shopItem.cost)) return { ok: false, reason: "Not enough treaties." };
  payCost(shopItem.cost);
  const breed = CAT_BREEDS[newBreedId];
  const oldLabel = CAT_BREEDS[cat.breed].classLabel;
  cat.breed = newBreedId;
  cat.baseStats = rollBaseStats(breed);
  cat.stats = { ...cat.baseStats };
  cat.level = 1;
  cat.xp = 0;
  cat.pendingStatChoices = 0;
  cat.palette = {
    fur:    hexShift(breed.palette.fur,    breed.paletteVariance.fur),
    accent: hexShift(breed.palette.accent, breed.paletteVariance.accent),
    eyes:   hexShift(breed.palette.eyes,   breed.paletteVariance.eyes)
  };
  logEvent(`${cat.name} drank Kitten Formula. ${oldLabel} \u2192 ${breed.classLabel} (reset to Lv 1).`);
  requestSave();
  return { ok: true };
}

// Rename a cat. Keeps it sensible: trim, clamp to 1-24 chars, reject empty.
function renameCat(catId, newName) {
  const cat = findCat(catId);
  if (!cat) return { ok: false, reason: "No such cat." };
  const trimmed = String(newName || "").trim().slice(0, 24);
  if (!trimmed) return { ok: false, reason: "Name can't be empty." };
  if (trimmed === cat.name) return { ok: true, unchanged: true };
  const oldName = cat.name;
  cat.name = trimmed;
  logEvent(`${oldName} is now called ${trimmed}.`);
  requestSave();
  return { ok: true };
}

function acceptStray(strayCat) {
  if (gameState.cats.length >= clubMax()) return false;
  gameState.cats.push(strayCat);
  logEvent(`${strayCat.name} the ${CAT_BREEDS[strayCat.breed].classLabel} joined the club.`);
  recordBreedSeen(strayCat.breed);
  gameState.bestiary.straysAccepted = (gameState.bestiary.straysAccepted || 0) + 1;
  checkBestiary();
  requestSave();
  return true;
}

// --- Club Level & Achievements ------------------------------------------

// Each mission contributes a fraction of its xpReward per cat to the club's XP pool.
function grantClubXp(amount) {
  gameState.clubXp = (gameState.clubXp || 0) + amount;
  while (gameState.clubXp >= clubXpToNext(gameState.clubLevel || 1)) {
    gameState.clubXp -= clubXpToNext(gameState.clubLevel || 1);
    gameState.clubLevel = (gameState.clubLevel || 1) + 1;
    logEvent(`\u{1F393} Club reached Level ${gameState.clubLevel}!`);
  }
}

function buyClubPerk(perkId) {
  const perk = CLUB_PERKS.find(p => p.id === perkId);
  if (!perk) return { ok: false, reason: "Unknown perk." };
  if (perk.owned && perk.owned(gameState)) return { ok: false, reason: "Already owned." };
  if (perk.requiresClubLevel && (gameState.clubLevel || 1) < perk.requiresClubLevel) {
    return { ok: false, reason: `Requires Club Level ${perk.requiresClubLevel}.` };
  }
  if ((gameState.nineLives || 0) < perk.cost) return { ok: false, reason: "Not enough \uD83C\uDF00." };
  gameState.nineLives -= perk.cost;
  perk.apply(gameState);
  logEvent(`Club Perk unlocked: ${perk.name}.`);
  saveStateNow();
  return { ok: true };
}

// Evaluate achievements; any that pass their check for the first time get auto-claimed,
// reward granted, log entry posted. Called after meaningful state mutations.
function checkAchievements() {
  gameState.achievements = gameState.achievements || {};
  for (const ach of ACHIEVEMENTS) {
    if (gameState.achievements[ach.id]?.claimed) continue;
    if (ach.check(gameState)) {
      gameState.achievements[ach.id] = { claimed: true, at: Date.now() };
      const r = ach.reward || {};
      if (r.gold)      gameState.gold      = (gameState.gold || 0)      + r.gold;
      if (r.fishes)    gameState.fishes    = (gameState.fishes || 0)    + r.fishes;
      if (r.treaties)  gameState.treaties  = (gameState.treaties || 0)  + r.treaties;
      if (r.nineLives) gameState.nineLives = (gameState.nineLives || 0) + r.nineLives;
      // Party-IV unlock is inherent: partyMax() reads achievements.packLeader.claimed directly.
      logEvent(`\uD83C\uDFC6 Achievement: ${ach.name} \u2014 ${r.note || ""}`);
    }
  }
}

// --- Prestige / Cat Nap --------------------------------------------------

function toRoman(n) {
  const romans = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return romans[n] || `+${n}`;
}

// Live preview of the Nine Lives that would be earned by ascending now.
function nineLivesPreview() {
  const base      = Math.floor((gameState.cumulativeGold || 0) / 5000);
  const tierBonus = 2 * Math.max(0, (gameState.highestTier || 0) - 4);
  return base + tierBonus;
}

// Prestige: keep one chosen cat (with gear), retire the rest, reset run state,
// award 🌀 Nine Lives, and bump the kept cat's Veteran level (+1 to every base stat).
function prestige(keepCatId) {
  const kept = findCat(keepCatId);
  if (!kept) return { ok: false, reason: "Pick a cat to carry forward." };
  if (kept.status === "mission") return { ok: false, reason: "Kept cat is on a mission." };
  if (gameState.missions.length) return { ok: false, reason: "Wait for all missions to finish first." };
  // Station assignments reset on prestige (minigames reset anyway); clear the kept cat's
  // station fields so they start the next run truly idle.
  if (kept.status === "stationed") {
    kept.status = "idle";
    kept.station = null;
  }

  const earned = nineLivesPreview();

  // Pluck kept cat's equipped items out of inventory.
  const keptItemIds = new Set(Object.values(kept.equipped).filter(Boolean));
  const keptItems   = gameState.inventory.filter(i => keptItemIds.has(i.id));

  // Retire everyone else into the lounge (stackable across lifetimes).
  for (const c of gameState.cats) {
    if (c.id === kept.id) continue;
    gameState.loungeCats.unshift({
      id: c.id, name: c.name, breed: c.breed, palette: { ...c.palette },
      finalLevel: c.level, finalStats: { ...c.stats }, retiredAt: Date.now()
    });
  }

  // Veteran +1 on kept cat (stacks each prestige, bypasses the 12 base cap).
  // Big Heart Eternal Perk adds its level (up to +3) on top of the base +1.
  kept.veteranLevel = (kept.veteranLevel || 0) + 1;
  const statBumps = 1 + eternalBigHeart();
  for (const s of STATS) {
    kept.baseStats[s] = (kept.baseStats[s] || 0) + statBumps;
    kept.stats[s]     = (kept.stats[s]     || 0) + statBumps;
  }

  const persistents = {
    nineLives:        (gameState.nineLives || 0) + earned,
    prestigeCount:    (gameState.prestigeCount || 0) + 1,
    eternalPerks:     gameState.eternalPerks,
    loungeCats:       gameState.loungeCats,
    clubXp:           gameState.clubXp,
    clubLevel:        gameState.clubLevel,
    clubPerks:        gameState.clubPerks,
    achievements:     gameState.achievements,
    achievementFlags: gameState.achievementFlags,
    // Long-horizon meta — carried across every Cat Nap.
    challengeBoons:   gameState.challengeBoons,
    slotMasteryXp:    gameState.slotMasteryXp,
    bestiary:         gameState.bestiary,
    bestiaryRewards:  gameState.bestiaryRewards,
    // Onboarding flags persist across prestige — a Cat Nap shouldn't re-show the tutorial.
    tutorialSeen:     gameState.tutorialSeen,
    uiAutoOpened:     gameState.uiAutoOpened
  };
  const fresh = freshRunShell(persistents, kept, persistents.eternalPerks.headStartGold || 0);
  fresh.inventory = keptItems;
  fresh.log.unshift({ t: Date.now(), msg: `+${earned} 🌀 Nine Lives earned.` });
  fresh.log.unshift({ t: Date.now(), msg: `Cat Nap ${persistents.prestigeCount}. ${kept.name} returns at Veteran ${toRoman(kept.veteranLevel)}.` });

  gameState = fresh;
  checkAchievements();
  saveStateNow();
  return { ok: true, earned, veteranLevel: kept.veteranLevel };
}

// Perk cost may be a static number (legacy) or a function(state). Single call site lives here.
function eternalPerkCost(perk) {
  return typeof perk.cost === "function" ? perk.cost(gameState) : perk.cost;
}

function buyEternalPerk(perkId) {
  const perk = ETERNAL_PERKS.find(p => p.id === perkId);
  if (!perk) return { ok: false, reason: "Unknown perk." };
  if (perk.owned && perk.owned(gameState) && !perk.repeatable) return { ok: false, reason: "Already unlocked." };
  if (perk.available && !perk.available(gameState)) return { ok: false, reason: "Maxed out." };
  const cost = eternalPerkCost(perk);
  if ((gameState.nineLives || 0) < cost) return { ok: false, reason: "Not enough 🌀 Nine Lives." };
  gameState.nineLives -= cost;
  perk.apply(gameState);
  const lvl = perk.level ? perk.level(gameState) : null;
  const lvlTxt = lvl && perk.maxLevel ? ` (Lv ${lvl}/${perk.maxLevel})` : "";
  logEvent(`Eternal Perk: ${perk.name}${lvlTxt}.`);
  saveStateNow();
  return { ok: true };
}

// --- Eternal Perk effect accessors ---------------------------------------
// Read like `eternalGoldMul()` at the right hook points; never read raw eternalPerks counts
// outside this file, so effects can be retuned here without hunting every call site.
function eternalGoldMul()   { return 1 + ((gameState?.eternalPerks?.gildedPaw     || 0) * 0.02); }
function eternalXpMul()     { return 1 + ((gameState?.eternalPerks?.scholarlyPurr || 0) * 0.02); }
function eternalLootPct()   { return    ((gameState?.eternalPerks?.luckyWhiskers || 0) * 0.01); }
function eternalStrayPct()  { return    ((gameState?.eternalPerks?.openDoor      || 0) * 0.02); }
function eternalBigHeart()  { return    (gameState?.eternalPerks?.bigHeart       || 0); }
function eternalWarmHearth(){ return    (gameState?.eternalPerks?.warmHearth     || 0); }

// --- Tick ----------------------------------------------------------------

function tick() {
  const now = Date.now();
  // Daily rollover: refresh star sign before computing anything that reads it.
  refreshStarSign();
  const due = gameState.missions
    .filter(m => (m.startedAt + m.durationMs) <= now)
    .sort((a, b) => (a.startedAt + a.durationMs) - (b.startedAt + b.durationMs));
  const resolved = [];
  for (const m of due) {
    const r = resolveMission(m);
    if (r) resolved.push(r);
  }
  // Resolve any finished fishing cast and chain recasts if Auto-Caster is on.
  tickFishing(now);
  // Auto-plant + auto-harvest for the garden if a cat is assigned.
  tickGarden(now);
  // Grant daily XP to any stargazing cat.
  tickStargazing(now);
  // Dynasty: lounge cats trickle XP to all idle/stationed cats.
  tickLoungeTrickle(now);
  gameState.lastTick = now;
  return resolved;
}

function catchUpOffline() {
  const now = Date.now();
  const elapsed = Math.max(0, now - (gameState.lastSaved || now));
  if (elapsed <= 0) return { elapsed: 0, resolved: [] };
  // Long Nap club perk doubles the offline catch-up window.
  const cap = gameState?.clubPerks?.longnap ? MAX_OFFLINE_MS * 2 : MAX_OFFLINE_MS;
  const clamped = Math.min(elapsed, cap);
  const resolved = tick();
  return { elapsed: clamped, resolved };
}
