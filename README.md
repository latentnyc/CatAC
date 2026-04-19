# Cat Adventure Club

A semi-idle browser game about adventuring cats. Send your cats on timed expeditions across themed neighborhoods, loot gear, level them up, and prestige via the "Cat Nap" ascension loop. Vanilla HTML/CSS/JS — no build step, no framework.

**Status:** `v0.4.2` — shared with friends for feedback.

## ▶️ Play now

**[latentnyc.github.io/CatAC](https://latentnyc.github.io/CatAC/)**

Or clone the repo and open [`index.html`](./index.html) in any modern browser. Your save lives in `localStorage`; no server, no signup, no telemetry.

A brief first-run tutorial covers the basics. Panels on the right unfold as you unlock them.

## What's in it

### Core loop
- **6 cat classes** with unique passives, 5-node talent trees, and one active ability each (Scrapper, Mystic, Prowler, Purrist, Yowler, Tracker)
- **6 neighborhoods** with elemental themes and environmental hazards: Park, Lake, Rooftops, Bakery, Subway (prestige 1), and The Dreaming (prestige 3)
- **10 mission tiers** gated by gold → club level → achievements → prestige
- **Gear system** — 4 slots × 4 rarities with elemental-affinity mitigation and 2/4-piece set bonuses

### Stations (per-neighborhood idle mechanics)
- **🎣 Fishing Hole** — cast, wait, HOOK! a WoW-style bite window for active-play bonus catches
- **🌿 Catnip Garden** — plant seeds, harvest real-time yields that buff your next mission
- **🌙 Stargazing** — daily rotating stat sign, or assign a cat to hold a chosen sign

Each station can have one cat assigned for passive XP + stat-scaled bonuses.

### Meta-progression
- **Cat Nap prestige** with multi-Veteran stable (up to 4 kept cats per nap via the Cherished Companion Eternal Perk)
- **13 Eternal Perks** bought with 🌀 Nine Lives, persistent across every run
- **🎭 Patrons** — three meta-factions at prestige 3 that reshape your run's playstyle (Baker / Librarian / Night Market)
- **📚 Research tree** — 15 nodes across 4 tiers, real-time passive progression (unlocks at Club Level 5)
- **⚔️ Challenges** — opt-in restrictions (mono-class, no-gear, pair-bond, home-body) that stack permanent Boons
- **📖 Bestiary** — 6 tiered collection categories with per-tier permanent bonuses
- **🧤 Gear Mastery** — per-slot XP that permanently boosts equipped-item affixes

### Content + events
- **Daily Challenges** — one per hood per UTC day, rotating modifiers
- **Weekly Boss** — 48h, guaranteed legendaries, hood rotates weekly
- **Commission** — spend 🎀 to design a one-shot mission with stacked modifiers
- **💞 Cat Bonds** — cats that run 10+ successful missions together gain score + loot bonuses
- **🐁 Golden Mouse** — rare post-mission events with three branching choices
- **34 Achievements** covering breadth + late-game depth

### Quality of life
- 🎒 **Party loadout presets** — 3 named 4-cat configs in the mission picker
- ⚙️ **Bulk equip best** — one-click gear optimizer per cat
- 📋 **Mission queue** — chain different missions with the same party
- 🔁 **Auto-repeat** — loop the same mission; "come home" button to cancel mid-chain
- ⌨️ **Keyboard shortcuts** — `1-6` for hood tabs, `Enter` confirms modals, `Esc` closes
- 📊 **Stats dashboard** — lifetime totals: playtime, missions run, crit rate, legendaries found, and more
- 💾 **Save export/import** + emergency reset in Settings

**~100–150 hours of content** for an optimal player. Infinite grind tails on research, perks, and bestiary completion.

## Tech

Vanilla JS loaded in script-tag order. No bundler, no dependencies.

```
index.html       # shell + layout + cache-busted script tags
style.css        # ~2000 lines, everything styled here
js/data.js       # static catalogs: breeds, hoods, tiers, perks, talents, patrons, research, etc.
js/state.js      # localStorage save/load + offline catch-up + load-time reconciliation
js/game.js       # tick, missions, economy, prestige, all game logic
js/render.js     # drawCat (canvas) + DOM panels + modals + event wiring
js/main.js       # bootstrap + requestAnimationFrame loop
```

`colors_and_type.css` and the `assets/` folder come from the design system — see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) if you want to theme or skin the UI.

## Save data

Stored under the key `catgame.v3` in `localStorage`. Open **⚙️ Settings** (bottom of the right column) to export/import JSON, or to wipe and start fresh. Offline progression caps at 24h by default, 48h with the Long Nap Club Perk.

## Feedback

Alpha build — bugs, balance thoughts, and suggestions all welcome.

- **🐛 Issues:** [github.com/latentnyc/CatAC/issues](https://github.com/latentnyc/CatAC/issues)
- **📦 Releases:** [github.com/latentnyc/CatAC/releases](https://github.com/latentnyc/CatAC/releases)

In-game: there's a 🐛 **Feedback** link in the top bar that goes straight to the issues page.

## License

[MIT](./LICENSE). Fork it, remix it, ship your own cat game — everything here is borrowed from every idle game that came before, and the least I can do is pass it on.
