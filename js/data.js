// =============================================================
// data.js — Static definitions for Cat Adventure Club
// =============================================================

const SAVE_KEY = "catgame.v3";
const SAVE_VERSION = 3;
const MAX_OFFLINE_MS = 24 * 60 * 60 * 1000;

const LEVEL_CAP = 25;
const BASE_STAT_CAP = 12;
// Caps for perk-gated progression.
const MAX_CLUB_CAP  = 16;   // absolute max after all Club Slot perks purchased
const MAX_PARTY_CAP = 4;    // absolute max after Party Slot IV
const INITIAL_PARTY_MAX = 2; // first run starts with duo missions; 3rd/4th via Club Level + Achievement
const INITIAL_CLUB_MAX  = 4; // first run starts with a tiny club

// Dynamic accessors — all code should call these instead of reading constants.
// Party cap unions three unlock sources: Eternal Perks (base), Club Perk, Achievement.
function partyMax() {
  let n = (gameState?.eternalPerks?.partyMax) || INITIAL_PARTY_MAX;
  if (gameState?.clubPerks?.party3)                         n = Math.max(n, 3);
  if (gameState?.achievements?.packLeader?.claimed)         n = Math.max(n, 4);
  return Math.min(MAX_PARTY_CAP, n);
}
function clubMax()  { return (gameState?.eternalPerks?.clubMax)  || INITIAL_CLUB_MAX; }

const STRAY_BASE_CHANCE = 0.03;  // per mission — intentionally low; bumped by consumables
const STRAY_TIER_BONUS  = 0.002; // per tier above 1

// Cat Bonds — cats that run this many missions together gain a Bond. Bonded pairs in the same
// party each give a small party-score + loot bump (additive per bonded pair).
const BOND_THRESHOLD      = 10;
const BOND_SCORE_BONUS    = 3;
const BOND_LOOT_PCT_BONUS = 0.02;

// Golden Mouse — rare random events that fire on mission resolve. Player picks one of a few
// choices (or passes). Low chance, non-irritating: never interrupts, always meaningful.
const GOLDEN_MOUSE_CHANCE = 0.06; // 6% per non-failed resolve (first sighting ~within ~15 missions)
const GOLDEN_MOUSE_CHOICES = [
  { id: "chase",   label: "Chase",   desc: "Spend 3\uD83D\uDC1F for +2 rarity shift on the next mission.", cost: { fishes: 3 }, apply: () => { gameState.pendingRarityShift = (gameState.pendingRarityShift || 0) + 2; logEvent("\u{1F9C0} You chased the mouse! +2 rarity shift next mission."); } },
  { id: "pounce",  label: "Pounce",  desc: "Spend 2\uD83C\uDF80 for +10\uD83C\uDF80 immediately (risky gamble).", cost: { treaties: 2 }, apply: () => { gameState.treaties = (gameState.treaties || 0) + 10; logEvent("\u{1F9C0} You pounced! +10\uD83C\uDF80."); } },
  { id: "admire",  label: "Admire",  desc: "Watch it pass. Gain +1\uD83C\uDF80 as a keepsake.", cost: {}, apply: () => { gameState.treaties = (gameState.treaties || 0) + 1; logEvent("\u{1F9C0} The mouse glitters and is gone. +1\uD83C\uDF80."); } }
];

// Each equipped item with a matching-element tag adds this to the mission success score.
const ELEMENT_BONUS_BY_RARITY = { common: 1, rare: 1, epic: 2, legendary: 3 };

const STATS = ["str", "dex", "con", "int", "wis", "cha"];
const STAT_LABELS = {
  str: "STR", dex: "DEX", con: "CON",
  int: "INT", wis: "WIS", cha: "CHA"
};

const RARITY_ORDER = ["common", "rare", "epic", "legendary"];
const RARITY_TIERS = {
  common:    { color: "#B8B8B8", adjectives: ["Plain", "Simple", "Worn"],            bonusValue: 1, numAffixes: 1 },
  rare:      { color: "#4AA3FF", adjectives: ["Fine", "Sturdy", "Polished"],         bonusValue: 2, numAffixes: 1 },
  epic:      { color: "#B04AFF", adjectives: ["Ancient", "Enchanted", "Masterwork"], bonusValue: 4, numAffixes: 2 },
  legendary: { color: "#FFB347", adjectives: ["Mythic", "Eternal", "Divine"],        bonusValue: 6, numAffixes: 2 }
};

const STAT_SUFFIXES = {
  str: ["of Mauling", "of the Bear", "of Pouncing"],
  dex: ["of Whispers", "of the Shadow", "of Silence"],
  con: ["of Endurance", "of the Oak", "of Nine Lives"],
  int: ["of Insight", "of the Sage", "of Cunning"],
  wis: ["of Perception", "of the Owl", "of the Moon"],
  cha: ["of Charm", "of the Courtier", "of Silken Purrs"]
};

const ITEM_TYPES = {
  collar: ["Collar", "Choker", "Bell"],
  toy:    ["Feather", "Rattle", "Mouse", "Wand"],
  treat:  ["Tuna", "Catnip", "Biscuit", "Jerky"],
  relic:  ["Amulet", "Charm", "Talisman", "Sigil"]
};
const ITEM_SLOTS = ["collar", "toy", "treat", "relic"];

const CAT_NAMES = [
  "Whiskers", "Mittens", "Shadow", "Luna", "Oliver", "Ginger", "Felix", "Smokey",
  "Patches", "Biscuit", "Pepper", "Jinx", "Momo", "Coco", "Salem", "Bella",
  "Tofu", "Pudding", "Oreo", "Boba", "Pickle", "Noodle", "Mochi", "Sushi",
  "Mango", "Ziggy", "Peanut", "Clover", "Waffle", "Marble", "Basil", "Fig",
  "Caper", "Juniper", "Sage", "Olive", "Hazel", "Fennel", "Saffron", "Ember"
];

const CAT_BREEDS = {
  fighter: {
    id: "fighter", name: "Maine Brawler", classLabel: "Scrapper", icon: "\u2694",
    blurb: "Tough frontline tabby. STR & CON primary.",
    passive: { kind: "mit",       amount: 2,    label: "Bulwark",  desc: "+2 mitigation per Scrapper" },
    primaries:   ["str", "con"],
    secondaries: ["wis"],
    palette:         { fur: "#C4956C", accent: "#8B6F47", eyes: "#4A9A5E" },
    paletteVariance: { fur: 18, accent: 14, eyes: 20 }
  },
  mage: {
    id: "mage", name: "Whiskered Sage", classLabel: "Mystic", icon: "\u273F",
    blurb: "Arcane long-hair. INT & WIS primary.",
    passive: { kind: "lootPct",   amount: 0.03, label: "Insight",  desc: "+3% loot chance per Mystic" },
    primaries:   ["int", "wis"],
    secondaries: ["cha"],
    palette:         { fur: "#E8E2D5", accent: "#B8B0A0", eyes: "#7B3FBF" },
    paletteVariance: { fur: 20, accent: 18, eyes: 30 }
  },
  rogue: {
    id: "rogue", name: "Shadowpaw", classLabel: "Prowler", icon: "\u2756",
    blurb: "Sleek and silent. DEX & CHA primary.",
    passive: { kind: "speedPct",  amount: 0.08, label: "Quickfoot",desc: "-8% mission duration per Prowler" },
    primaries:   ["dex", "cha"],
    secondaries: ["int"],
    palette:         { fur: "#3B3B42", accent: "#1F1F24", eyes: "#F7D84B" },
    paletteVariance: { fur: 14, accent: 10, eyes: 20 }
  },
  cleric: {
    id: "cleric", name: "Ragdoll Shepherd", classLabel: "Purrist", icon: "\u271A",
    blurb: "Compassionate guardian. WIS & CHA primary.",
    passive: { kind: "floorPct",  amount: 0.08, label: "Tending",  desc: "+8% failure floor per Purrist" },
    primaries:   ["wis", "cha"],
    secondaries: ["con"],
    palette:         { fur: "#F2E8DC", accent: "#5C4B3E", eyes: "#4A8AC7" },
    paletteVariance: { fur: 16, accent: 20, eyes: 20 }
  },
  bard: {
    id: "bard", name: "Silken Diplomat", classLabel: "Yowler", icon: "\u266A",
    blurb: "Persuasive showcat. CHA & INT primary.",
    passive: { kind: "xpPct",     amount: 0.05, label: "Encore",   desc: "+5% mission XP per Yowler" },
    primaries:   ["cha", "int"],
    secondaries: ["wis"],
    palette:         { fur: "#B88A5B", accent: "#523A24", eyes: "#5AB6C4" },
    paletteVariance: { fur: 16, accent: 14, eyes: 18 }
  },
  ranger: {
    id: "ranger", name: "Alley Sleuth", classLabel: "Tracker", icon: "\u2726",
    blurb: "Quiet hunter. DEX & WIS primary.",
    passive: { kind: "rarityShift", amount: 3, label: "Scout",     desc: "+3 rarity-shift per Tracker (boosts epic+ drops)" },
    primaries:   ["dex", "wis"],
    secondaries: ["con"],
    palette:         { fur: "#8C9B79", accent: "#3C4533", eyes: "#D89E4A" },
    paletteVariance: { fur: 20, accent: 14, eyes: 22 }
  }
};

// Four elemental neighborhoods. Each has 5 environmental "effects" that add to effective DC
// when active; matching-element gear contributes to a shared mitigation pool that offsets them.
// Higher-tier missions activate more of the list.
const NEIGHBORHOODS = {
  park: {
    id: "park", name: "The Park", element: "earth", icon: "\uD83C\uDF33",
    color: "#6fb86b",
    primaryChecks: ["str", "con"],
    flavor: "Shady oaks, bold squirrels, muddy paws.",
    effects: [
      { id: "muddy",     name: "Muddy Paws",          severity: 3,  desc: "Progress slows in the wet grass." },
      { id: "squirrels", name: "Bold Squirrels",      severity: 4,  desc: "They dart out at the worst moments." },
      { id: "brambles",  name: "Dense Brambles",      severity: 6,  desc: "Fur snags on thorns." },
      { id: "dogs",      name: "Territorial Dogs",    severity: 8,  desc: "Park dogs don't share their turf." },
      { id: "oakspirit", name: "Ancient Oak Spirits", severity: 10, desc: "Something old watches from the canopy." }
    ]
  },
  lake: {
    id: "lake", name: "The Lake", element: "water", icon: "\uD83C\uDF0A",
    color: "#57a8d3",
    primaryChecks: ["int", "wis"],
    flavor: "Quiet docks, koi drifting in lantern light.",
    effects: [
      { id: "chill",    name: "Chilly Water",     severity: 3,  desc: "Wet paws; slower reactions." },
      { id: "slippery", name: "Slippery Docks",   severity: 4,  desc: "One misstep and you're swimming." },
      { id: "glare",    name: "Lantern Glare",    severity: 6,  desc: "Human light ruins night vision." },
      { id: "currents", name: "Deep Currents",    severity: 8,  desc: "The koi swim where the deep things are." },
      { id: "drowned",  name: "The Drowned",      severity: 10, desc: "Something in the reeds remembers you." }
    ]
  },
  rooftops: {
    id: "rooftops", name: "The Rooftops", element: "air", icon: "\uD83C\uDF06",
    color: "#b89ce8",
    primaryChecks: ["dex", "cha"],
    flavor: "Starlight, chimney pots, daring leaps.",
    effects: [
      { id: "gusts",    name: "Gusty Winds",    severity: 3,  desc: "A sudden gust unbalances a leap." },
      { id: "slanted",  name: "Slanted Tiles",  severity: 4,  desc: "Footing is rarely flat." },
      { id: "owls",     name: "Owl Patrols",    severity: 6,  desc: "Great horned owls consider cats prey." },
      { id: "smoke",    name: "Chimney Smoke",  severity: 8,  desc: "Acrid fumes burn the eyes." },
      { id: "vertigo",  name: "Vertigo",        severity: 10, desc: "The ground is very, very far below." }
    ]
  },
  bakery: {
    id: "bakery", name: "The Bakery", element: "fire", icon: "\uD83D\uDD25",
    color: "#e89660",
    primaryChecks: ["str", "dex"],
    flavor: "Warm ovens, tempting scraps, bold mice.",
    effects: [
      { id: "hotfloor", name: "Hot Flagstones",  severity: 3,  desc: "Paws step quick or not at all." },
      { id: "scraps",   name: "Tempting Scraps", severity: 4,  desc: "Cats lose focus for pastries." },
      { id: "steam",    name: "Steam Bursts",    severity: 6,  desc: "Sudden hisses from unknown vents." },
      { id: "flares",   name: "Oven Flares",     severity: 8,  desc: "Damage at the bakery comes fast and hot." },
      { id: "cook",     name: "The Head Cook",   severity: 10, desc: "A broom has your name on it." }
    ]
  },
  subway: {
    id: "subway", name: "The Subway", element: "metal", icon: "\u{1F687}",
    color: "#8a8a9e",
    primaryChecks: ["dex", "con"],
    flavor: "Tunnels, third-rail arcs, strangers in long coats.",
    requiresPrestige: 1,
    effects: [
      { id: "tunnelwind", name: "Tunnel Wind",      severity: 3,  desc: "Hot gusts push paws off-balance." },
      { id: "crowds",     name: "Rush Hour Crowds", severity: 4,  desc: "Commuters step without looking down." },
      { id: "thirdrail",  name: "Third Rail",       severity: 6,  desc: "The hum is deadly and close." },
      { id: "conductor",  name: "Lost Conductor",   severity: 8,  desc: "Someone calls from a train that isn't here." },
      { id: "deepline",   name: "The Deep Line",    severity: 10, desc: "Not every station is on the map." }
    ]
  },
  dreaming: {
    id: "dreaming", name: "The Dreaming", element: "spirit", icon: "\u{1F319}\u{2728}",
    color: "#b890d1",
    primaryChecks: ["wis", "cha"],
    flavor: "Somewhere between the pillow and the hearth, cats travel.",
    requiresPrestige: 3,
    effects: [
      { id: "fog",       name: "Drifting Fog",       severity: 3,  desc: "Memory of the path fades." },
      { id: "whisper",   name: "Whispering Toys",    severity: 5,  desc: "Old stuffed things remember." },
      { id: "nightcall", name: "The Night-Post Meow",severity: 7,  desc: "A call from nothing, answered by something." },
      { id: "mirror",    name: "Mirror Maze",        severity: 9,  desc: "Which cat is the real cat?" },
      { id: "tiger",     name: "The Sleeping Tiger", severity: 11, desc: "Don't wake her." }
    ]
  }
};
const NEIGHBORHOOD_IDS = Object.keys(NEIGHBORHOODS);

// Shared tier definitions. Each tier can be run in any unlocked neighborhood.
// difficulty = target success score. Party score formula: best cat + 25% of each other cat, per check, then summed.
const MISSION_TIERS = [
  { tier: 1, effectsActive: 1, duration:         60 * 1000, difficulty:  12, goldRange: [   5,    15], fishRange: [ 0,  1], treatyChance: 0,    xpReward:   20, lootChance: 0.60, rarityWeights: { common: 80, rare: 18, epic:  2, legendary: 0 } },
  { tier: 2, effectsActive: 2, duration:     3 * 60 * 1000, difficulty:  20, goldRange: [  12,    30], fishRange: [ 0,  1], treatyChance: 0,    xpReward:   45, lootChance: 0.65, rarityWeights: { common: 70, rare: 25, epic:  5, legendary: 0 } },
  { tier: 3, effectsActive: 2, duration:    10 * 60 * 1000, difficulty:  30, goldRange: [  30,    75], fishRange: [ 1,  2], treatyChance: 0.05, xpReward:   95, lootChance: 0.70, rarityWeights: { common: 55, rare: 33, epic: 11, legendary: 1 } },
  { tier: 4, effectsActive: 3, duration:    30 * 60 * 1000, difficulty:  40, goldRange: [  80,   200], fishRange: [ 2,  3], treatyChance: 0.10, xpReward:  200, lootChance: 0.75, rarityWeights: { common: 45, rare: 35, epic: 17, legendary: 3 } },
  { tier: 5, effectsActive: 3, duration:    60 * 60 * 1000, difficulty:  48, goldRange: [ 200,   500], fishRange: [ 3,  5], treatyChance: 0.18, xpReward:  420, lootChance: 0.80, rarityWeights: { common: 35, rare: 38, epic: 22, legendary: 5 } },
  // Tiers 6-10 are system-gated on top of the gold threshold — Club Level / Achievement / Prestige.
  { tier: 6, effectsActive: 4, duration: 3 * 60 * 60 * 1000,difficulty:  54, goldRange: [ 500,  1200], fishRange: [ 5,  8], treatyChance: 0.28, xpReward:  900, lootChance: 0.85, rarityWeights: { common: 25, rare: 40, epic: 27, legendary: 8 },
    requiresClubLevel: 4 },
  { tier: 7, effectsActive: 4, duration: 6 * 60 * 60 * 1000,difficulty:  58, goldRange: [1100,  2500], fishRange: [ 8, 12], treatyChance: 0.42, xpReward: 1800, lootChance: 0.90, rarityWeights: { common: 15, rare: 38, epic: 34, legendary: 13 },
    requiresAchievement: "packLeader" },
  { tier: 8, effectsActive: 5, duration: 12* 60 * 60 * 1000,difficulty:  62, goldRange: [2400,  5500], fishRange: [12, 18], treatyChance: 0.60, xpReward: 3600, lootChance: 0.95, rarityWeights: { common: 10, rare: 32, epic: 38, legendary: 20 },
    requiresPrestige: 1 },
  { tier: 9, effectsActive: 5, duration: 24* 60 * 60 * 1000,difficulty:  72, goldRange: [5500, 12000], fishRange: [18, 28], treatyChance: 0.80, xpReward: 7000, lootChance: 0.97, rarityWeights: { common:  5, rare: 25, epic: 40, legendary: 30 },
    requiresPrestige: 2 },
  { tier:10, effectsActive: 5, duration: 48* 60 * 60 * 1000,difficulty:  82, goldRange:[12000, 28000], fishRange: [30, 45], treatyChance: 0.95, xpReward:14000, lootChance: 0.99, rarityWeights: { common:  2, rare: 15, epic: 40, legendary: 43 },
    requiresPrestige: 3, requiresClubLevel: 7 }
];

// Gold thresholds at which the next tier unlocks (shared across all neighborhoods).
const TIER_UNLOCK_GOLD = [0, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000];

// Daily Challenges — one per unlocked neighborhood per 24h. A random modifier warps the mission
// numbers (gold, fish, xp, duration, loot rolls). Completions reset at the day boundary.
const DAILY_MODIFIERS = [
  { id: "generous",    label: "Generous",    desc: "+100% gold",    goldMul: 2.0 },
  { id: "bountiful",   label: "Bountiful",   desc: "+100% fish",    fishMul: 2.0 },
  { id: "treats",      label: "Treat Run",   desc: "+2 guaranteed treaties", bonusTreaties: 2 },
  { id: "experienced", label: "Experienced", desc: "+50% XP",       xpMul: 1.5 },
  { id: "hasty",       label: "Hasty",       desc: "-30% duration", durationMul: 0.7 },
  { id: "lucky",       label: "Lucky",       desc: "+2 rarity shift + double loot", rarityShift: 2, lootRolls: 2 }
];

// Challenge Neighborhoods — player commissions a one-shot mission with stacked modifiers.
// Each modifier has a treaty cost; base commission is 1🎀 + sum of modifier costs.
// Composable with tier + hood to create bespoke risk/reward setups.
const CHALLENGE_COMMISSION_BASE_COST = 1;
const CHALLENGE_MODIFIERS = [
  { id: "fortune",   label: "Fortune",   desc: "+50% gold",            cost: 1, apply: m => { m.goldRange = m.goldRange.map(v => Math.floor(v * 1.5)); } },
  { id: "abundance", label: "Abundance", desc: "+50% fish",            cost: 1, apply: m => { m.fishRange = m.fishRange.map(v => Math.floor(v * 1.5)); } },
  { id: "windfall",  label: "Windfall",  desc: "+2 guaranteed treaties", cost: 2, apply: m => { m.bonusTreaties = (m.bonusTreaties || 0) + 2; } },
  { id: "prestige",  label: "Prestige",  desc: "+100% XP",             cost: 2, apply: m => { m.xpReward = Math.floor(m.xpReward * 2); } },
  { id: "haste",     label: "Haste",     desc: "-50% duration",        cost: 2, apply: m => { m.duration = Math.floor(m.duration * 0.5); } },
  { id: "gleam",     label: "Gleam",     desc: "+3 rarity shift",      cost: 2, apply: m => { m.rarityShift = (m.rarityShift || 0) + 3; } },
  { id: "jackpot",   label: "Jackpot",   desc: "Double loot rolls",    cost: 3, apply: m => { m.lootRolls = Math.max(m.lootRolls || 1, 2); } },
  { id: "pressure",  label: "Pressure",  desc: "Every hazard active (harder)", cost: 0, apply: (m, hood) => { m.effectsActive = hood.effects.length; } }
];

// Weekly Boss — one per week in a rotating neighborhood. Stacks ALL 5 hazards of that 'hood,
// requires a full 4-cat party, 48h duration, guaranteed 2 legendaries + treaties.
const WEEKLY_BOSS_BASE = {
  duration: 48 * 60 * 60 * 1000,
  difficulty: 78,
  goldRange: [8000, 16000],
  fishRange: [20, 35],
  treatyChance: 1.0,
  treatyGuaranteed: 5,
  xpReward: 5000,
  rarityWeights: { common: 0, rare: 10, epic: 40, legendary: 50 },
  guaranteedLegendaries: 2,
  requiresFullParty: true
};

function utcDayKey(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function utcWeekKey(ms = Date.now()) {
  // ISO-like week: year + floor(day-of-year / 7). Rotates Mondays roughly.
  const d = new Date(ms);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const days = Math.floor((ms - start) / (24 * 60 * 60 * 1000));
  return `${d.getUTCFullYear()}-W${String(Math.floor(days / 7)).padStart(2, "0")}`;
}

// Eternal Perks — purchased with Nine Lives (🌀), persist across prestiges.
// Ascension path does NOT grant party slots (those come from Club Level + Achievements);
// it grants meta currency (🌀), club capacity, starting-gold, and assorted meta modifiers.
//
// cost may be a number (fixed) or a function (scales with current level). Use
// `eternalPerkCost(perk)` at call sites — never read perk.cost directly.
// `level(s)` returns the current stack level for repeatable perks (for UI display).
const ETERNAL_PERKS = [
  { id: "clubSlot", name: "Extra Club Slot",  cost: 2,  icon: "\u{1F408}",
    desc: "+1 permanent club capacity.",
    repeatable: true,
    level: s => Math.max(0, (s.eternalPerks.clubMax || INITIAL_CLUB_MAX) - INITIAL_CLUB_MAX),
    maxLevel: MAX_CLUB_CAP - INITIAL_CLUB_MAX,
    owned: s => s.eternalPerks.clubMax >= MAX_CLUB_CAP,
    available: s => s.eternalPerks.clubMax < MAX_CLUB_CAP,
    apply: s => { s.eternalPerks.clubMax = Math.min(MAX_CLUB_CAP, s.eternalPerks.clubMax + 1); } },
  { id: "headStart",name: "Head Start Stash", cost: 3,  icon: "\u{1F4B0}",
    desc: "New runs start with +200\u{1F4B0}.",
    repeatable: true,
    level: s => Math.floor((s.eternalPerks.headStartGold || 0) / 200),
    maxLevel: 5,
    owned: s => (s.eternalPerks.headStartGold || 0) >= 1000,
    available: s => (s.eternalPerks.headStartGold || 0) < 1000,
    apply: s => { s.eternalPerks.headStartGold = (s.eternalPerks.headStartGold || 0) + 200; } },

  // --- New in Tier 3a: repeatable % bonuses that stack into meaningful power curves ---
  { id: "gildedPaw", name: "Gilded Paw",  icon: "\u{1F4B5}",
    desc: "+2% gold on every mission. Stacks \u00D7 5.",
    repeatable: true, maxLevel: 5,
    level: s => s.eternalPerks.gildedPaw || 0,
    cost:  s => 2 + (s.eternalPerks.gildedPaw || 0),
    owned: s => (s.eternalPerks.gildedPaw || 0) >= 5,
    available: s => (s.eternalPerks.gildedPaw || 0) < 5,
    apply: s => { s.eternalPerks.gildedPaw = (s.eternalPerks.gildedPaw || 0) + 1; } },
  { id: "scholarlyPurr", name: "Scholarly Purr", icon: "\uD83D\uDCDA",
    desc: "+2% mission XP. Stacks \u00D7 5.",
    repeatable: true, maxLevel: 5,
    level: s => s.eternalPerks.scholarlyPurr || 0,
    cost:  s => 2 + (s.eternalPerks.scholarlyPurr || 0),
    owned: s => (s.eternalPerks.scholarlyPurr || 0) >= 5,
    available: s => (s.eternalPerks.scholarlyPurr || 0) < 5,
    apply: s => { s.eternalPerks.scholarlyPurr = (s.eternalPerks.scholarlyPurr || 0) + 1; } },
  { id: "luckyWhiskers", name: "Lucky Whiskers", icon: "\u{1F340}",
    desc: "+1% global loot chance. Stacks \u00D7 5.",
    repeatable: true, maxLevel: 5,
    level: s => s.eternalPerks.luckyWhiskers || 0,
    cost:  s => 3 + (s.eternalPerks.luckyWhiskers || 0),
    owned: s => (s.eternalPerks.luckyWhiskers || 0) >= 5,
    available: s => (s.eternalPerks.luckyWhiskers || 0) < 5,
    apply: s => { s.eternalPerks.luckyWhiskers = (s.eternalPerks.luckyWhiskers || 0) + 1; } },
  { id: "openDoor", name: "Open Door", icon: "\uD83D\uDEAA",
    desc: "+2% base stray-offer chance. Stacks \u00D7 5.",
    repeatable: true, maxLevel: 5,
    level: s => s.eternalPerks.openDoor || 0,
    cost:  s => 3 + (s.eternalPerks.openDoor || 0),
    owned: s => (s.eternalPerks.openDoor || 0) >= 5,
    available: s => (s.eternalPerks.openDoor || 0) < 5,
    apply: s => { s.eternalPerks.openDoor = (s.eternalPerks.openDoor || 0) + 1; } },
  { id: "bigHeart", name: "Big Heart", icon: "\u2764\uFE0F",
    desc: "Each Veteran level grants +1 extra base stat. Stacks \u00D7 3.",
    repeatable: true, maxLevel: 3,
    level: s => s.eternalPerks.bigHeart || 0,
    cost:  s => 4 + 2 * (s.eternalPerks.bigHeart || 0),
    owned: s => (s.eternalPerks.bigHeart || 0) >= 3,
    available: s => (s.eternalPerks.bigHeart || 0) < 3,
    apply: s => { s.eternalPerks.bigHeart = (s.eternalPerks.bigHeart || 0) + 1; } },
  { id: "warmHearth", name: "Warm Hearth", icon: "\uD83D\uDD25",
    desc: "Lounge cats grant +1 extra XP/hr per lounge cat to idle cats. Stacks \u00D7 5.",
    repeatable: true, maxLevel: 5,
    level: s => s.eternalPerks.warmHearth || 0,
    cost:  s => 3 + (s.eternalPerks.warmHearth || 0),
    owned: s => (s.eternalPerks.warmHearth || 0) >= 5,
    available: s => (s.eternalPerks.warmHearth || 0) < 5,
    apply: s => { s.eternalPerks.warmHearth = (s.eternalPerks.warmHearth || 0) + 1; } },
  { id: "cherished", name: "Cherished Companion", icon: "\u{1F3DB}\uFE0F",
    desc: "Keep one extra cat during Cat Nap. Stacks \u00D7 3 (max 4 kept per nap).",
    repeatable: true, maxLevel: 3,
    level: s => s.eternalPerks.cherished || 0,
    cost:  s => 5 + 2 * (s.eternalPerks.cherished || 0),
    owned: s => (s.eternalPerks.cherished || 0) >= 3,
    available: s => (s.eternalPerks.cherished || 0) < 3,
    apply: s => { s.eternalPerks.cherished = (s.eternalPerks.cherished || 0) + 1; } }
];

// How many cats the player can keep on Cat Nap. Base 1, up to 4 with full Cherished Companion.
function catNapKeepCount() {
  return 1 + (gameState?.eternalPerks?.cherished || 0);
}

// Base trickle rate; scaled by warmHearth perk + lounge population.
const LOUNGE_TRICKLE_XP_PER_CAT_PER_HOUR = 2;

// Club Level — earned XP from mission rewards; each level grants a Perk Point to spend on CLUB_PERKS.
// Persistent across prestiges (it's the "player's club" that outlives individual cats).
function clubXpToNext(level) { return Math.floor(80 * Math.pow(level, 1.55)); }

const CLUB_PERKS = [
  { id: "party3",  name: "Third Seat", cost: 4, icon: "\u2605",
    desc: "Missions accept up to 3 cats.",
    requiresClubLevel: 3,
    owned:     s => !!s.clubPerks?.party3,
    apply:     s => { s.clubPerks = s.clubPerks || {}; s.clubPerks.party3 = true; } },
  { id: "longnap", name: "Long Nap",   cost: 2, icon: "\u{1F319}",
    desc: "Offline catch-up cap raised to 48 hours.",
    requiresClubLevel: 2,
    owned:     s => !!s.clubPerks?.longnap,
    apply:     s => { s.clubPerks = s.clubPerks || {}; s.clubPerks.longnap = true; } },
  { id: "merchant",name: "Merchant",   cost: 3, icon: "\u{1F4B0}",
    desc: "Club Shop consumables cost 20% less.",
    requiresClubLevel: 4,
    owned:     s => !!s.clubPerks?.merchant,
    apply:     s => { s.clubPerks = s.clubPerks || {}; s.clubPerks.merchant = true; } }
];

// Achievements — trigger-based milestones that grant a reward once, the first time their check passes.
// "Pack Leader" is the designated unlock for Party Slot IV.
const ACHIEVEMENTS = [
  { id: "firstMission", name: "First Steps",
    desc: "Finish your first mission.",
    reward: { gold: 25, note: "+25\u{1F4B0}" },
    check: s => (s.cumulativeGold || 0) > 0 },
  { id: "firstLegendary", name: "Big Catch",
    desc: "Find your first legendary item.",
    reward: { fishes: 8, note: "+8\uD83D\uDC1F" },
    check: s => !!(s.achievementFlags?.sawLegendary) },
  { id: "firstRetire", name: "Gold Watch",
    desc: "Send a cat to the Lounge for a well-earned retirement.",
    reward: { treaties: 1, note: "+1\uD83C\uDF80" },
    check: s => (s.loungeCats || []).length > 0 },
  { id: "firstPrestige", name: "Nine Tails",
    desc: "Take your first Cat Nap (prestige).",
    reward: { nineLives: 2, note: "+2\uD83C\uDF00" },
    check: s => (s.prestigeCount || 0) >= 1 },
  { id: "packLeader", name: "Pack Leader",
    desc: "Send a 3-cat party on a mission \u2014 unlocks the fourth party slot.",
    reward: { unlockPartyIV: true, note: "Unlocks Party Slot IV" },
    check: s => !!(s.achievementFlags?.ranThreeCatMission) },
  { id: "veteranIII", name: "Elder Cat",
    desc: "Have a cat reach Veteran III or beyond.",
    reward: { treaties: 3, note: "+3\uD83C\uDF80" },
    check: s => (s.cats || []).some(c => (c.veteranLevel || 0) >= 3) },

  // v0.2 expansion — breadth across every system.
  { id: "fullClub", name: "A Proper Club",
    desc: "Fill all 16 club slots at once.",
    reward: { treaties: 2, note: "+2\uD83C\uDF80" },
    check: s => (s.cats || []).length >= 16 },
  { id: "allHoods", name: "Neighborhood Patrol",
    desc: "Clear at least one mission in every unlocked neighborhood.",
    reward: { fishes: 20, note: "+20\uD83D\uDC1F" },
    check: s => {
      const cleared = s.bestiary?.hoodTiersCleared || {};
      const unlocked = NEIGHBORHOOD_IDS.filter(id => !NEIGHBORHOODS[id].requiresPrestige || (s.prestigeCount || 0) >= NEIGHBORHOODS[id].requiresPrestige);
      return unlocked.every(hid => Object.keys(cleared).some(k => k.startsWith(hid + "-")));
    } },
  { id: "t5all", name: "Seasoned Adventurer",
    desc: "Clear a T5 mission in all 4 base neighborhoods.",
    reward: { treaties: 4, note: "+4\uD83C\uDF80" },
    check: s => ["park", "lake", "rooftops", "bakery"].every(hid => s.bestiary?.hoodTiersCleared?.[hid + "-t5"]) },
  { id: "firstHook", name: "Nice Grab",
    desc: "Hook a fishing bite successfully.",
    reward: { fishes: 10, note: "+10\uD83D\uDC1F" },
    check: s => (s.achievementFlags?.hookedOnce) === true },
  { id: "fisher100", name: "Lake Regular",
    desc: "Catch 100 fishing results (any rarity).",
    reward: { treaties: 2, note: "+2\uD83C\uDF80" },
    check: s => (s.fishing?.totalCaught || 0) >= 100 },
  { id: "gardener", name: "Green Paws",
    desc: "Harvest 25 garden plots.",
    reward: { fishes: 15, note: "+15\uD83D\uDC1F" },
    check: s => (s.achievementFlags?.plotsHarvested || 0) >= 25 },
  { id: "firstBond", name: "Hearts in Sync",
    desc: "Form your first Cat Bond.",
    reward: { fishes: 12, note: "+12\uD83D\uDC1F" },
    check: s => Object.values(s.catBonds || {}).some(n => n >= BOND_THRESHOLD) },
  { id: "fullTalent", name: "Class Master",
    desc: "Max every node in a cat's talent tree.",
    reward: { treaties: 3, note: "+3\uD83C\uDF80" },
    check: s => (s.cats || []).some(c => {
      const tree = TALENT_TREES[c.breed] || [];
      return tree.length > 0 && tree.every(n => c.talents?.[n.id]);
    }) },
  { id: "firstChallenge", name: "Boon Hunter",
    desc: "Complete a Challenge and earn a Boon.",
    reward: { nineLives: 1, note: "+1\uD83C\uDF00" },
    check: s => Object.values(s.challengeBoons || {}).some(n => n > 0) },
  { id: "commissionFive", name: "Commissioner",
    desc: "Commission 5 custom missions.",
    reward: { treaties: 2, note: "+2\uD83C\uDF80" },
    check: s => (s.achievementFlags?.commissionsFiled || 0) >= 5 },
  { id: "firstBoss", name: "Regicide",
    desc: "Defeat a Weekly Boss.",
    reward: { nineLives: 2, note: "+2\uD83C\uDF00" },
    check: s => (s.bestiary?.bossesDefeated || 0) >= 1 },
  { id: "nineLives100", name: "Well-Napped",
    desc: "Accumulate 100 Nine Lives over your lifetime.",
    reward: { treaties: 5, note: "+5\uD83C\uDF80" },
    check: s => (s.achievementFlags?.lifetimeNineLives || 0) >= 100 },
  { id: "goldenMouser", name: "Mouser",
    desc: "Encounter the Golden Mouse.",
    reward: { fishes: 10, note: "+10\uD83D\uDC1F" },
    check: s => (s.achievementFlags?.mouseSeen) === true },

  // v0.4 expansion — late-game depth + breadth across all systems.
  { id: "goldHoarder", name: "Gold Hoarder",
    desc: "Have 100,000\uD83D\uDCB0 at once.",
    reward: { treaties: 3, note: "+3\uD83C\uDF80" },
    check: s => (s.gold || 0) >= 100000 },
  { id: "fishMagnate", name: "Fish Magnate",
    desc: "Have 500\uD83D\uDC1F at once.",
    reward: { treaties: 2, note: "+2\uD83C\uDF80" },
    check: s => (s.fishes || 0) >= 500 },
  { id: "treatyTrove", name: "Treaty Trove",
    desc: "Have 50\uD83C\uDF80 at once.",
    reward: { nineLives: 1, note: "+1\uD83C\uDF00" },
    check: s => (s.treaties || 0) >= 50 },
  { id: "veteranV", name: "Legend",
    desc: "Own a Veteran V or higher cat.",
    reward: { nineLives: 3, note: "+3\uD83C\uDF00" },
    check: s => (s.cats || []).some(c => (c.veteranLevel || 0) >= 5) },
  { id: "prestigeV", name: "Five Naps",
    desc: "Complete 5 Cat Naps.",
    reward: { nineLives: 3, note: "+3\uD83C\uDF00" },
    check: s => (s.prestigeCount || 0) >= 5 },
  { id: "patronPledged", name: "Faction Chosen",
    desc: "Pledge to a Patron.",
    reward: { nineLives: 2, note: "+2\uD83C\uDF00" },
    check: s => !!s.patronId },
  { id: "researchStarted", name: "Scholar",
    desc: "Complete 5 Research nodes.",
    reward: { fishes: 50, note: "+50\uD83D\uDC1F" },
    check: s => Object.keys(s.research?.completed || {}).length >= 5 },
  { id: "researchSage", name: "Sage",
    desc: "Complete 10 Research nodes.",
    reward: { treaties: 5, note: "+5\uD83C\uDF80" },
    check: s => Object.keys(s.research?.completed || {}).length >= 10 },
  { id: "pinnacle", name: "Pinnacle",
    desc: "Complete every Research node.",
    reward: { nineLives: 10, note: "+10\uD83C\uDF00" },
    check: s => Object.keys(s.research?.completed || {}).length >= RESEARCH_NODES.length },
  { id: "bondNetwork", name: "Friendships",
    desc: "Form 5 different Cat Bonds.",
    reward: { treaties: 3, note: "+3\uD83C\uDF80" },
    check: s => Object.values(s.catBonds || {}).filter(n => n >= BOND_THRESHOLD).length >= 5 },
  { id: "talentMaster", name: "Class Master",
    desc: "Max every talent on three different cats.",
    reward: { treaties: 4, note: "+4\uD83C\uDF80" },
    check: s => {
      let count = 0;
      for (const c of (s.cats || [])) {
        const tree = TALENT_TREES[c.breed] || [];
        if (tree.length > 0 && tree.every(n => c.talents?.[n.id])) count++;
      }
      return count >= 3;
    } },
  { id: "spectrumClub", name: "Full Spectrum Club",
    desc: "Have every class represented in the club at once.",
    reward: { treaties: 3, note: "+3\uD83C\uDF80" },
    check: s => {
      const breeds = new Set((s.cats || []).map(c => c.breed));
      return Object.keys(CAT_BREEDS).every(id => breeds.has(id));
    } },
  { id: "tier10", name: "The Summit",
    desc: "Clear a T10 mission in any neighborhood.",
    reward: { nineLives: 5, note: "+5\uD83C\uDF00" },
    check: s => Object.keys(s.bestiary?.hoodTiersCleared || {}).some(k => k.endsWith("-t10")) },
  { id: "loungeFull", name: "Full House",
    desc: "Retire 25 cats to the Cat Lounge.",
    reward: { treaties: 3, note: "+3\uD83C\uDF80" },
    check: s => (s.loungeCats || []).length >= 25 },
  { id: "shopSpree", name: "Regular Customer",
    desc: "Buy 25 consumables from the Club Shop.",
    reward: { fishes: 30, note: "+30\uD83D\uDC1F" },
    check: s => (s.stats?.consumablesBought || 0) >= 25 }
];

// Party synergies — conditional bonuses that activate when specific class combos are present.
// Each synergy is evaluated at party-selection time and contributes to one or more totals.
const SYNERGIES = [
  {
    id: "guardian", name: "Guardian Pact", icon: "\uD83D\uDEE1\uFE0F",
    req: c => c.fighter > 0 && c.cleric > 0,
    effects: { mit: 3 },
    desc: "Scrapper + Purrist in the party: +3 mitigation."
  },
  {
    id: "arcane",   name: "Arcane Thief",  icon: "\uD83C\uDFAD",
    req: c => c.mage > 0 && c.rogue > 0,
    effects: { lootPct: 0.05 },
    desc: "Mystic + Prowler in the party: +5% loot chance."
  },
  {
    id: "spectrum", name: "Full Spectrum", icon: "\uD83C\uDF08",
    req: c => c.fighter > 0 && c.mage > 0 && c.rogue > 0 && c.cleric > 0,
    effects: { goldPct: 0.15 },
    desc: "One of every class present: +15% gold reward."
  },
  {
    id: "pack",     name: "Pack Tactics",  icon: "\uD83D\uDC3E",
    req: c => Object.values(c).some(n => n >= 2),
    effects: { scoreBonus: 3 },
    desc: "2+ of the same class: +3 to party score."
  }
];

// Active class abilities — one per class, keyed by breed id. Cats have 1 + veteranLevel
// charges per run, consumed on use. Activation is opt-in in the mission picker; the effect
// is applied at mission start (duration changes) or resolve (everything else).
const ACTIVE_ABILITIES = {
  fighter: { id: "bastion",     name: "Bastion",      icon: "\uD83D\uDEE1\uFE0F",
    desc: "+5 mitigation on this mission.", effect: { missionMit: 5 } },
  mage:    { id: "arcaneSight", name: "Arcane Sight", icon: "\uD83D\uDD2E",
    desc: "+50% loot chance on this mission.", effect: { lootMul: 1.5 } },
  rogue:   { id: "dash",        name: "Dash",         icon: "\uD83D\uDCA8",
    desc: "\u221230% mission duration.", effect: { durationMul: 0.7 } },
  cleric:  { id: "sanctuary",   name: "Sanctuary",    icon: "\u271D\uFE0F",
    desc: "Failure floor cap raised to 1.00 (no reward penalty on fail).", effect: { floorCapOverride: 1.0 } },
  bard:    { id: "aria",        name: "Aria",         icon: "\uD83C\uDFB6",
    desc: "+50% XP on this mission.", effect: { xpMul: 1.5 } },
  ranger:  { id: "hunt",        name: "Hunt",         icon: "\uD83C\uDFF9",
    desc: "+5 rarity shift on this mission.", effect: { rarityShift: 5 } }
};

// Talent Trees — per-class 5-node linear trees. Cats earn 1 talent point at levels 5, 10, 15,
// 20, 25 (five total, enough to max one tree by level cap). Each node has ONE shape:
//   - stat: { stat: "str", amount: 2 } — applied immediately on pick (permanent base-stat bump)
//   - passiveKind: amplifies the cat's breed passive by amount (e.g. Bulwark II adds +1 mit
//     on top of the base passive amount, per cat with the talent)
//   - missionBonus: conditional bonus applied while this cat is in the party. Fields:
//       mit, lootPct, speedPct, xpPct, scoreBonus, rarityShift, goldPct, fishPct,
//       hazardReduction (flat hazard severity off), floorCapRaise (fail-floor cap delta),
//       apexPredator (flag: +1 treaty per legendary drop).
// Picking is linear — node N requires nodes 1..N-1 already picked.
const TALENT_POINT_LEVELS = [5, 10, 15, 20, 25];
const TALENT_TREES = {
  fighter: [
    { id: "brace",      name: "Brace",           desc: "+1 CON base stat.",                                          stat: { stat: "con", amount: 1 } },
    { id: "bulwark2",   name: "Bulwark II",      desc: "Your Bulwark passive contributes +1 extra mitigation.",       passiveKind: { kind: "mit", amount: 1 } },
    { id: "ironpaw",    name: "Iron Paw",        desc: "+2 STR base stat.",                                          stat: { stat: "str", amount: 2 } },
    { id: "reflective", name: "Reflective Hide", desc: "Matching-hood gear grants +1 extra mitigation on your missions.", missionBonus: { mit: 1 } },
    { id: "immovable",  name: "Immovable",       desc: "Reduce hazard severity by 2 on your missions.",               missionBonus: { hazardReduction: 2 } }
  ],
  mage: [
    { id: "insight2",   name: "Insight II",      desc: "Your Insight passive contributes +2% extra loot chance.",    passiveKind: { kind: "lootPct", amount: 0.02 } },
    { id: "scholar",    name: "Scholar",         desc: "+2 INT base stat.",                                          stat: { stat: "int", amount: 2 } },
    { id: "foresight",  name: "Foresight",       desc: "+3 party score on your missions.",                           missionBonus: { scoreBonus: 3 } },
    { id: "runic",      name: "Runic Weave",     desc: "+1 rarity shift on loot rolls from your missions.",          missionBonus: { rarityShift: 1 } },
    { id: "arcane",     name: "Arcane Mastery",  desc: "+10% XP on your missions.",                                  missionBonus: { xpPct: 0.10 } }
  ],
  rogue: [
    { id: "quickfoot2", name: "Quickfoot II",    desc: "Your Quickfoot passive contributes -4% extra duration.",     passiveKind: { kind: "speedPct", amount: 0.04 } },
    { id: "swift",      name: "Swift",           desc: "+2 DEX base stat.",                                          stat: { stat: "dex", amount: 2 } },
    { id: "shadowstep", name: "Shadowstep",      desc: "-5% mission duration on your missions.",                      missionBonus: { speedPct: 0.05 } },
    { id: "sleight",    name: "Sleight",         desc: "+5% loot chance on your missions.",                          missionBonus: { lootPct: 0.05 } },
    { id: "ghost",      name: "Ghost",           desc: "+5 party score on your missions.",                            missionBonus: { scoreBonus: 5 } }
  ],
  cleric: [
    { id: "tending2",   name: "Tending II",      desc: "Your Tending passive contributes +4% extra failure floor.",   passiveKind: { kind: "floorPct", amount: 0.04 } },
    { id: "mend",       name: "Mend",            desc: "+2 WIS base stat.",                                          stat: { stat: "wis", amount: 2 } },
    { id: "watchful",   name: "Watchful",        desc: "+1 CON base stat.",                                          stat: { stat: "con", amount: 1 } },
    { id: "sanctuary",  name: "Sanctuary",       desc: "Failure floor cap raised to 0.95 on your missions.",          missionBonus: { floorCapRaise: 0.05 } },
    { id: "guardian",   name: "Guardian",        desc: "+3 mitigation on your missions.",                             missionBonus: { mit: 3 } }
  ],
  bard: [
    { id: "encore2",    name: "Encore II",       desc: "Your Encore passive contributes +3% extra mission XP.",      passiveKind: { kind: "xpPct", amount: 0.03 } },
    { id: "winsome",    name: "Winsome",         desc: "+2 CHA base stat.",                                          stat: { stat: "cha", amount: 2 } },
    { id: "silken",     name: "Silken Tongue",   desc: "+5% gold on your missions.",                                 missionBonus: { goldPct: 0.05 } },
    { id: "benediction",name: "Benediction",     desc: "+5% extra XP on your missions (stacks with Encore).",         missionBonus: { xpPct: 0.05 } },
    { id: "diva",       name: "Diva",            desc: "+3 party score on your missions.",                            missionBonus: { scoreBonus: 3 } }
  ],
  ranger: [
    { id: "scout2",     name: "Scout II",        desc: "Your Scout passive contributes +2 extra rarity shift.",       passiveKind: { kind: "rarityShift", amount: 2 } },
    { id: "keenEye",    name: "Keen Eye",        desc: "+2 WIS base stat.",                                          stat: { stat: "wis", amount: 2 } },
    { id: "softStep",   name: "Soft Step",       desc: "+1 DEX base stat.",                                          stat: { stat: "dex", amount: 1 } },
    { id: "pathfinder", name: "Pathfinder",      desc: "+10% fish reward on your missions.",                         missionBonus: { fishPct: 0.10 } },
    { id: "apex",       name: "Apex Predator",   desc: "Each legendary drop on your missions also grants +1\uD83C\uDF80.", missionBonus: { apexPredator: true } }
  ]
};

// Research Tree — passive progression paid with 🐟 + real time. Each node takes a duration,
// costs resources, and grants a permanent effect on completion. Only ONE node researches at
// a time. Completed nodes persist across prestige. Unlocks at Club Level 5.
//
// Effect shape documented at bottom — keep each node's effect field to known keys so the
// researchTotals() aggregator can pick them up without special cases.
const RESEARCH_UNLOCK_CLUB_LEVEL = 5;
const RESEARCH_NODES = [
  // ---- Tier 1: Foundations (no prereqs) ----
  { id: "literacy",  name: "Basic Literacy",    icon: "\uD83D\uDCD6",
    desc: "Cats learn to read. +3% mission XP permanently.",
    tier: 1, prereq: [], cost: { fishes: 30 },    duration:      10 * 60 * 1000,
    effect: { xpMul: 1.03 } },
  { id: "carto",     name: "Cartography",       icon: "\uD83D\uDDFA\uFE0F",
    desc: "Better maps mean better commissions. +3% mission gold.",
    tier: 1, prereq: [], cost: { fishes: 50 },    duration:      20 * 60 * 1000,
    effect: { goldMul: 1.03 } },
  { id: "herbalism", name: "Herbalism",         icon: "\uD83C\uDF31",
    desc: "Herbs rewarded properly. Garden harvests yield double quantity.",
    tier: 1, prereq: [], cost: { fishes: 80 },    duration:      30 * 60 * 1000,
    effect: { gardenQuantityMul: 2 } },

  // ---- Tier 2: Intermediate ----
  { id: "pack",      name: "Pack Behavior",     icon: "\uD83D\uDC3E",
    desc: "Studied group dynamics. +1 party score per cat in the party.",
    tier: 2, prereq: ["literacy"], cost: { fishes: 120 }, duration: 60 * 60 * 1000,
    effect: { scorePerCat: 1 } },
  { id: "booking",   name: "Bookkeeping",       icon: "\uD83D\uDCD2",
    desc: "Meticulous ledgers. +3% mission gold (stacks).",
    tier: 2, prereq: ["carto"], cost: { fishes: 180 }, duration: 90 * 60 * 1000,
    effect: { goldMul: 1.03 } },
  { id: "naming",    name: "Naming Theory",     icon: "\uD83D\uDCDD",
    desc: "Knowing one's name gives power. New strays start at Level 2.",
    tier: 2, prereq: ["herbalism"], cost: { fishes: 200 }, duration: 2 * 60 * 60 * 1000,
    effect: { strayStartLevel: 2 } },
  { id: "stars",     name: "Constellation Study", icon: "\u2728",
    desc: "The sky favors the attentive. +1 rarity shift on every mission.",
    tier: 2, prereq: ["literacy"], cost: { fishes: 220, treaties: 1 }, duration: 2 * 60 * 60 * 1000,
    effect: { rarityShift: 1 } },

  // ---- Tier 3: Advanced ----
  { id: "logistics", name: "Efficient Logistics", icon: "\u26A1",
    desc: "No wasted paws. \u22125% mission duration on all runs.",
    tier: 3, prereq: ["pack"], cost: { fishes: 350 }, duration: 3 * 60 * 60 * 1000,
    effect: { durationMul: 0.95 } },
  { id: "archaeo",   name: "Archaeology",       icon: "\u{1F3FA}",
    desc: "Old bones tell stories. +2% global loot chance.",
    tier: 3, prereq: ["booking", "naming"], cost: { fishes: 500 }, duration: 4 * 60 * 60 * 1000,
    effect: { lootPct: 0.02 } },
  { id: "alchemy",   name: "Alchemy",           icon: "\u269B\uFE0F",
    desc: "Brews are bigger. Stray consumables (Catnip Pouch, Tuna Lure) give double bonus.",
    tier: 3, prereq: ["herbalism"], cost: { fishes: 600, treaties: 2 }, duration: 5 * 60 * 60 * 1000,
    effect: { strayConsumableMul: 2 } },
  { id: "esoterica", name: "Esoterica",         icon: "\uD83D\uDD2E",
    desc: "Hidden patterns revealed. +3% global loot chance.",
    tier: 3, prereq: ["stars"], cost: { fishes: 800 }, duration: 6 * 60 * 60 * 1000,
    effect: { lootPct: 0.03 } },

  // ---- Tier 4: Grand ----
  { id: "grand",     name: "Grand Workings",    icon: "\u{1F3DB}\uFE0F",
    desc: "The club hums with learned purpose. +1 mitigation on every mission.",
    tier: 4, prereq: ["logistics", "archaeo"], cost: { fishes: 1200, treaties: 3 }, duration: 10 * 60 * 60 * 1000,
    effect: { mitFlat: 1 } },
  { id: "tongues",   name: "Ancient Tongues",   icon: "\uD83D\uDDBD\uFE0F",
    desc: "Cats whisper older words. New strays gain +1 to every base stat.",
    tier: 4, prereq: ["alchemy", "esoterica"], cost: { fishes: 1500, treaties: 5 }, duration: 12 * 60 * 60 * 1000,
    effect: { strayStatBonus: 1 } },
  { id: "pinnacle",  name: "Pinnacle of Cat Thought", icon: "\uD83D\uDC51",
    desc: "A capstone of theory: +10% XP, +5% gold, +5% loot chance.",
    tier: 4, prereq: ["grand", "tongues"], cost: { fishes: 3000, treaties: 10 }, duration: 24 * 60 * 60 * 1000,
    effect: { xpMul: 1.10, goldMul: 1.05, lootPct: 0.05 } }
];

// Effect keys consumed by researchTotals() in game.js:
//   xpMul, goldMul, durationMul   — multiplicative (default 1.0)
//   lootPct, mitFlat, rarityShift, scorePerCat — additive (default 0)
//   strayStartLevel               — max of all completions (default 1)
//   strayStatBonus, strayConsumableMul, gardenQuantityMul — additive/flat

// Patrons — meta-factions picked at prestige 3+. Each warps the whole game's math in a
// distinct direction. First pick is free; swapping costs PATRON_SWAP_COST Nine Lives.
// Effects are read in partyMitigation, resolveMission, effectiveShopCost, stray roll, etc.,
// via the accessors in game.js. Keep each patron's net power roughly equal — trades, not buffs.
const PATRON_REQUIRES_PRESTIGE = 3;
const PATRON_SWAP_COST = 10;
const PATRONS = [
  {
    id: "baker", name: "The Baker", icon: "\uD83E\uDD50", color: "#e89660",
    flavor: "Warmth is the only answer. Bread made with love, and love made with bread.",
    summary: [
      "+100% mitigation from Bakery-affinity gear",
      "\u221250% mitigation from Lake-affinity gear",
      "\u221210% shop consumable cost"
    ],
    effects: {
      mitMulByHood: { bakery: 2.0, lake: 0.5 },
      shopDiscount: 0.10
    }
  },
  {
    id: "librarian", name: "The Librarian", icon: "\uD83D\uDCDA", color: "#7c5cff",
    flavor: "Knowledge is the better coin. The ledger forgives nothing, but it forgets less.",
    summary: [
      "+25% mission XP",
      "\u221215% mission gold",
      "+15% chance for an extra affix on loot rolls"
    ],
    effects: {
      xpMul: 1.25,
      goldMul: 0.85,
      extraAffixChance: 0.15
    }
  },
  {
    id: "nightMarket", name: "The Night Market", icon: "\uD83C\uDF19", color: "#b890d1",
    flavor: "Bargains for those who know where to look. Quiet meetings behind quiet doors.",
    summary: [
      "\u221250% shop consumable cost (stacks with Merchant)",
      "+5% base stray-offer chance",
      "Daily & Weekly boss gold/fish/treaty rewards halved"
    ],
    effects: {
      shopDiscount: 0.50,
      strayPct: 0.05,
      bossDailyCurrencyMul: 0.5
    }
  }
];

// Challenges — opt-in restricted runs. Complete the goal count of successful missions
// under the restriction to stack a "Boon" that permanently adds to partyBonuses.
// Abandoning resets progress for the current attempt; boons already earned persist.
// Restrictions are enforced at startMission() time.
const CHALLENGES = [
  { id: "monoclass", name: "One True Calling", icon: "\u2697\uFE0F",
    desc: "Every party member must share the same class.",
    goal: "Win 10 missions while restricted.", goalCount: 10, goalMinTier: 1,
    restriction: "monoclass",
    reward: { kind: "lootPct", amount: 0.03, label: "+3% loot chance" } },
  { id: "nogear", name: "Bare Paws", icon: "\uD83D\uDC3E",
    desc: "No cat may have gear equipped when the mission starts.",
    goal: "Win 8 missions while restricted.", goalCount: 8, goalMinTier: 1,
    restriction: "nogear",
    reward: { kind: "xpPct", amount: 0.05, label: "+5% mission XP" } },
  { id: "pairbond", name: "Dynamic Duo", icon: "\u2764\uFE0F",
    desc: "Parties are capped at 2 cats for all missions.",
    goal: "Win 10 missions while restricted.", goalCount: 10, goalMinTier: 1,
    restriction: "pairbond",
    reward: { kind: "scoreBonus", amount: 3, label: "+3 to party score" } },
  { id: "homebody", name: "Stay-at-Home", icon: "\uD83C\uDFE0",
    desc: "All missions must take place in the neighborhood of your first mission.",
    goal: "Win 6 missions at T3+.", goalCount: 6, goalMinTier: 3,
    restriction: "homebody",
    reward: { kind: "mit", amount: 2, label: "+2 mitigation" } }
];

// Mastery — per-gear-slot long-horizon progression. Each slot accrues XP whenever any
// cat in a resolving mission has that slot equipped. Levels grant affix amplifiers +
// loot-chance contribution. Persists across prestige.
function slotMasteryXpToNext(level) { return Math.floor(80 * Math.pow(level, 1.6)); }
const MASTERY_AFFIX_STEP = 5;   // every +5 levels grants +1 to affix bonuses in-slot
const MASTERY_LOOT_PER_LEVEL = 0.005; // +0.5% loot chance per level, when something is equipped in the slot
const MASTERY_XP_PER_EQUIPPED = 10;  // per equipped item among the party, per success

// Bestiary — collection log with *tiered* rewards. Each entry reaches a new Tier every
// `step` items counted; the tier multiplies a per-tier effect. Progress persists across
// prestige. Max tier = ceil(total / step).
const BESTIARY = [
  { id: "breeds",  label: "Breeds Discovered",       icon: "\uD83D\uDC08",
    total: () => Object.keys(CAT_BREEDS).length,
    count: s => Object.keys(s.bestiary?.breedsSeen || {}).length,
    step: 2,
    tierLabel: t => `+${t} to the lowest starting stat on new strays` },
  { id: "tiers",   label: "Neighborhoods Mastered",  icon: "\uD83D\uDDFA\uFE0F",
    total: () => NEIGHBORHOOD_IDS.length * MISSION_TIERS.length,
    count: s => Object.keys(s.bestiary?.hoodTiersCleared || {}).length,
    step: 6,
    tierLabel: t => `+${t}% gold on every mission` },
  { id: "items",   label: "Items Collected",         icon: "\uD83D\uDCE6",
    total: () => ITEM_SLOTS.length * NEIGHBORHOOD_IDS.length * RARITY_ORDER.length,
    count: s => Object.keys(s.bestiary?.itemTemplates || {}).length,
    step: 10,
    tierLabel: t => `+${(t * 0.5).toFixed(1)}% global loot chance` },
  { id: "bosses",  label: "Weekly Bosses Defeated",  icon: "\uD83D\uDC3A",
    total: () => 10,
    count: s => s.bestiary?.bossesDefeated || 0,
    step: 1,
    tierLabel: t => `Future boss clears grant +${t}\uD83C\uDF00` },
  { id: "dailies", label: "Daily Callings Completed", icon: "\uD83D\uDCC5",
    total: () => 30,
    count: s => s.bestiary?.dailiesCompleted || 0,
    step: 5,
    tierLabel: t => `Future daily clears grant +${t}\uD83C\uDF80` },
  { id: "strays",  label: "Strays Welcomed",         icon: "\uD83D\uDC3E",
    total: () => 20,
    count: s => s.bestiary?.straysAccepted || 0,
    step: 4,
    tierLabel: t => `+${t}% base stray-offer chance` }
];

// ============================================================================
// Tier-2 minigames: Fishing Hole · Catnip Garden · Stargazing
// ============================================================================

// --- Fishing Hole (Lake) ----------------------------------------------------
// Cast a line, wait out a timer, reel in fish/treaties/rare items. Upgrades reduce
// cast time and boost rewards. Auto-caster chains casts while idle/offline.
const FISHING_BASE_DURATION = 60 * 1000;
// WoW-style bite: a brief window somewhere in the cast during which clicking HOOK! resolves
// immediately with a rarity-shifted reward roll. Missing the window still resolves on the
// normal timer — idle is fine, active play is rewarded.
const FISHING_BITE_WINDOW_MS    = 2500;
const FISHING_BITE_START_FRAC   = 0.40;
const FISHING_BITE_END_FRAC     = 0.80;
const FISHING_BITE_RARITY_SHIFT = 2;
const FISHING_REWARDS = [
  { weight: 60, kind: "fish",   min: 1, max: 2,  note: "A small fish." },
  { weight: 25, kind: "fish",   min: 3, max: 5,  note: "A decent catch!" },
  { weight: 10, kind: "fish",   min: 8, max: 15, note: "A big one!" },
  { weight:  4, kind: "treaty", amount: 1,       note: "A lake treasure!" },
  { weight:  1, kind: "relic",  rarity: "epic",  note: "You hooked something ancient..." }
];
const FISHING_UPGRADES = [
  { id: "rod",  name: "Sharper Rod", icon: "\uD83C\uDFA3",
    desc: "-20% cast time per level.", max: 3,
    costFn: lvl => ({ fishes: 10 + lvl * 10 }) },
  { id: "bait", name: "Shiny Bait",  icon: "\u2728",
    desc: "+1 fish per catch per level.", max: 5,
    costFn: lvl => ({ fishes: 15 + lvl * 10 }) },
  { id: "auto", name: "Auto-Caster", icon: "\uD83E\uDD16",
    desc: "Line re-casts itself after every catch.", max: 1,
    costFn: () => ({ treaties: 5 }) }
];

// --- Catnip Garden (Park) ---------------------------------------------------
// Four plots. Plant a seed, wait real time, harvest for mission buffs / currency.
// Yields are weighted random within the seed's yield table.
const GARDEN_PLOTS = 4;
const GARDEN_SEEDS = [
  { id: "catnip", name: "Catnip Seed", icon: "\uD83C\uDF3F",
    cost: { fishes: 3 },
    growMs: 10 * 60 * 1000,
    yields: [
      { weight: 55, kind: "strayBonus",  amount: 0.25, note: "Potent catnip: +25% stray chance on next mission." },
      { weight: 30, kind: "fishes",      amount: 5,    note: "Juicy leaves: +5\uD83D\uDC1F." },
      { weight: 15, kind: "rarityShift", amount: 2,    note: "Mystical catnip: +2 rarity shift on next mission." }
    ]
  },
  { id: "moonflower", name: "Moonflower", icon: "\uD83C\uDF3C",
    cost: { treaties: 1 },
    requiresPrestige: 1,
    growMs: 30 * 60 * 1000,
    yields: [
      { weight: 50, kind: "treaties",  amount: 2,   note: "Moon petals: +2\uD83C\uDF80." },
      { weight: 30, kind: "clubXp",    amount: 100, note: "Hum of moonlight: +100 Club XP." },
      { weight: 20, kind: "nineLives", amount: 1,   note: "A drifting spirit: +1\uD83C\uDF00." }
    ]
  }
];

// --- Stargazing (The Dreaming) ----------------------------------------------
// One sign per UTC day. Adds a flat bonus to every mission check against that stat.
// Player can spend treaties to rotate to a different sign immediately.
const STAR_SIGNS = [
  { id: "hunter",   name: "The Hunter",   glyph: "\u2191", stat: "str", flavor: "Strength waxes under the Hunter." },
  { id: "dancer",   name: "The Dancer",   glyph: "\u21AA", stat: "dex", flavor: "Grace flows under the Dancer." },
  { id: "oak",      name: "The Oak",      glyph: "\u2234", stat: "con", flavor: "Endurance roots deep under the Oak." },
  { id: "scholar",  name: "The Scholar",  glyph: "\u263C", stat: "int", flavor: "Mind sharpens under the Scholar." },
  { id: "owl",      name: "The Owl",      glyph: "\u263D", stat: "wis", flavor: "Insight opens under the Owl." },
  { id: "courtier", name: "The Courtier", glyph: "\u2698", stat: "cha", flavor: "Presence bright under the Courtier." }
];
const STAR_CHECK_BONUS = 3;  // added to the matching stat check during partyScore
const STAR_REROLL_COST = { treaties: 2 };

const SHOP_ITEMS = [
  { id: "autosell",  name: "Auto-sell Commons",  icon: "\uD83E\uDDF9",
    cost: { gold: 500 }, oneTime: true,
    desc: "Common drops auto-convert to 10\uD83D\uDCB0 instead of filling inventory." },
  { id: "training",  name: "Training Tin",       icon: "\uD83E\uDD6B",
    cost: { fishes: 10 }, target: "cat",
    desc: "+500 xp to a chosen cat." },
  { id: "reroll",    name: "Element Reroll",     icon: "\uD83C\uDFB2",
    cost: { fishes: 15 }, target: "item",
    desc: "Reroll the element tag on a chosen item." },
  { id: "catnip",    name: "Catnip Pouch",       icon: "\uD83C\uDF3F",
    cost: { fishes: 4 }, stackable: true, consumable: true, strayBonus: 0.25,
    desc: "+25% stray-offer chance on your next search. Carries over across missions until a stray appears." },
  { id: "tuna",      name: "Tuna Lure",          icon: "\uD83C\uDF63",
    cost: { fishes: 10 }, stackable: true, consumable: true, strayBonus: 0.50,
    desc: "+50% stray-offer chance on your next search. Carries over across missions until a stray appears." },
  { id: "summons",   name: "Stray Summons",      icon: "\uD83C\uDFAB",
    cost: { treaties: 3 }, stackable: true, consumable: true,
    desc: "Single-use. Your next mission is guaranteed to offer a stray." },
  { id: "tonic",     name: "Stat Tonic",         icon: "\uD83D\uDC8E",
    cost: { treaties: 8 }, target: "cat",
    desc: "+1 to any one stat on a chosen cat (up to base cap 12)." },
  { id: "kitten",    name: "Kitten Formula",     icon: "\uD83C\uDF7C",
    cost: { treaties: 10 }, target: "cat-breed",
    desc: "Reroll a cat's class and stats. Name and gear stay; level resets to 1." }
];

function getMissionId(neighborhoodId, tier) {
  return `${neighborhoodId}-t${tier}`;
}

function getMission(neighborhoodId, tier) {
  const tierDef = MISSION_TIERS.find(t => t.tier === tier);
  const hood = NEIGHBORHOODS[neighborhoodId];
  if (!tierDef || !hood) return null;
  return {
    id: getMissionId(neighborhoodId, tier),
    neighborhoodId,
    tier,
    name: `T${tier} ${hood.name}`,
    ...tierDef,
    primaryChecks: hood.primaryChecks
  };
}

function xpToNext(level) {
  return Math.floor(50 * Math.pow(level, 1.6));
}
