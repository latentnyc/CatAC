# Cat Adventure Club

A semi-idle browser game about adventuring cats. Send your cats on timed expeditions across themed neighborhoods, loot gear, level them up, and prestige via the "Cat Nap" ascension loop. Vanilla HTML/CSS/JS — no build step, no framework.

**Status:** `v0.1.0-alpha` — shared with friends for feedback.

## Play

Open [`index.html`](./index.html) in any modern browser. Your save lives in `localStorage`; no server, no signup, no telemetry.

A brief first-run tutorial covers the basics. Panels on the right unfold as you unlock them.

## What's in it

- **6 cat classes** with unique passives (Scrapper, Mystic, Prowler, Purrist, Yowler, Tracker)
- **5 neighborhoods** (Park, Lake, Rooftops, Bakery, and The Dreaming at prestige 3) with elemental themes and environmental hazards
- **10 mission tiers** gated by gold → club level → achievements → prestige
- **3 station minigames** — Fishing (with a WoW-style bite window), Catnip Garden, Stargazing — unlocked by hood-tier clears
- **Cat Nap prestige** with 8 Eternal Perks and stacking challenge boons
- **Bestiary, Mastery, Synergies, Achievements, Daily Challenges, Weekly Boss, Challenge Commissions**, …

~60–80 hours of content for an optimal player; ~120 to completionist.

## Tech

Vanilla JS loaded in script-tag order. No bundler, no dependencies.

```
index.html       # shell + layout
style.css        # ~1500 lines, everything styled here
js/data.js       # static catalogs: breeds, hoods, tiers, perks, etc.
js/state.js      # localStorage save/load + offline catch-up
js/game.js       # tick, missions, economy, prestige
js/render.js     # drawCat (canvas) + DOM panels + modals
js/main.js       # bootstrap + requestAnimationFrame loop
```

`colors_and_type.css` and the `assets/` folder come from the design system — see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) if you want to theme or skin the UI.

## Save data

Stored under the key `catgame.v3` in `localStorage`. Open Settings (bottom of the right column) to export/import JSON, or to wipe and start fresh.

## Feedback

This is an alpha. Found a bug, have a balance thought, or noticed a dead end? Open an issue — see the "Build" section in Settings for the link.

## License

[MIT](./LICENSE). Fork it, remix it, ship your own cat game — everything here is borrowed from every idle game that came before, and the least I can do is pass it on.

