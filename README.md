# Cat Adventure Club

A semi-idle browser game about adventuring cats. Send your cats on timed expeditions across themed neighborhoods, loot gear, level them up, and prestige via the "Cat Nap" ascension loop. Vanilla HTML/CSS/JS — no build step, no framework.

**Status:** `v0.3.0-alpha` — shared with friends for feedback.

## ▶️ Play now

**[latentnyc.github.io/CatAC](https://latentnyc.github.io/CatAC/)**

Or clone the repo and open [`index.html`](./index.html) in any modern browser. Your save lives in `localStorage`; no server, no signup, no telemetry.

A brief first-run tutorial covers the basics. Panels on the right unfold as you unlock them.

## What's in it

- **6 cat classes** with unique passives, 5-node talent trees, and active abilities (Scrapper, Mystic, Prowler, Purrist, Yowler, Tracker)
- **6 neighborhoods** with elemental themes and environmental hazards: Park, Lake, Rooftops, Bakery, Subway (prestige 1), and The Dreaming (prestige 3)
- **10 mission tiers** gated by gold → club level → achievements → prestige
- **3 station minigames** — Fishing (with a WoW-style bite window), Catnip Garden, Stargazing — cats can be assigned to each
- **Cat Nap prestige** with a multi-Veteran stable (up to 4 kept cats per nap), 13 Eternal Perks, and stacking Challenge Boons
- **Patrons** — three meta-factions at prestige 3 that reshape your run's playstyle (Baker / Librarian / Night Market)
- **Active abilities** — one per class, charges scale with Veteran level
- **Research tree** — 15 nodes across 4 tiers, real-time passive progression (unlocks at Club Level 5)
- **Plus**: Bestiary, Gear Mastery, Synergies, Cat Bonds, Gear Sets, Golden Mouse events, 32 Achievements, Daily Challenges, Weekly Boss, Challenge Commissions

~80–120 hours of content for an optimal player. Infinite grind tails on research, perks, and bestiary completion.

## Tech

Vanilla JS loaded in script-tag order. No bundler, no dependencies.

```
index.html       # shell + layout
style.css        # ~1900 lines, everything styled here
js/data.js       # static catalogs: breeds, hoods, tiers, perks, etc.
js/state.js      # localStorage save/load + offline catch-up
js/game.js       # tick, missions, economy, prestige
js/render.js     # drawCat (canvas) + DOM panels + modals
js/main.js       # bootstrap + requestAnimationFrame loop
```

`colors_and_type.css` and the `assets/` folder come from the design system — see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) if you want to theme or skin the UI.

## Save data

Stored under the key `catgame.v3` in `localStorage`. Open Settings (bottom of the right column) to export/import JSON, or to wipe and start fresh. Offline progression caps at 24h by default, 48h with the Long Nap Club Perk.

## Feedback

Alpha build — bugs and balance thoughts welcome.

- **🐛 Issues:** [github.com/latentnyc/CatAC/issues](https://github.com/latentnyc/CatAC/issues)
- **📦 Releases:** [github.com/latentnyc/CatAC/releases](https://github.com/latentnyc/CatAC/releases)

In-game: there's a 🐛 **Feedback** link in the top bar that goes straight to the issues page.

## License

[MIT](./LICENSE). Fork it, remix it, ship your own cat game — everything here is borrowed from every idle game that came before, and the least I can do is pass it on.
