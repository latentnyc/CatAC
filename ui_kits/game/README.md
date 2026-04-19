# Cat Adventure Club — Game UI Kit

A pixel-accurate recreation of the in-game interface, factored into small React components.

## Files

- `index.html` — click-thru demo. Loads all JSX via Babel.
- `style.css` — the game's original CSS, copied verbatim from `CatGame/style.css`. Source of truth for tokens, layout, rarity borders, hazard rows, toasts.
- `kit-extras.css` — tiny supplementary styles for the demo shell only (fixed top bar offset, column wrappers, hood-flavor ribbon). Do not merge into production.
- `TopBar.jsx` — fixed top bar: 🐾 brand + gradient wordmark, 5 currency chips, save indicator.
- `CatPortrait.jsx` — procedurally-drawn canvas cat. Sitting pose, sine-wave tail wag, rarity glow, class badge, "ON MISSION" ribbon.
- `CatCard.jsx` — one cat in the Club: portrait, name, class + breed + passive, Lv + XP bar, 6 stat cells, 4 equip slots.
- `MissionCard.jsx` — one tier row inside a neighborhood: T#, duration, DC, party range, rewards, Plan button; plus `NeighborhoodTabs`.
- `MissionPicker.jsx` — the Send-Party modal: score vs DC, verdict chip, hazards list with mitigation pool, party checklist, Send button.
- `Panels.jsx` — `ShopItem`, `InventoryItem`, `ActiveMissionRow`, `LogEntry`, `Toast`.
- `App.jsx` — composes the demo: The Club column, Neighborhoods column, Inventory column, active-missions strip, toast stack, pickable mission modal.

## Interaction coverage

- Switch neighborhoods (4 tabs, flavor copy changes)
- Plan any unlocked tier → opens the party-picker modal
- Toggle cats into the party (checkbox rows, party-max enforced)
- Cancel or "Send party" → pushes a success toast
- Retire a cat → pushes a toast
- Filter inventory by rarity (all / common / rare / epic / legendary)

## What's faked

The real game has a tick loop (`CatGame/js/game.js`), mission resolution dice rolls, stat math, save/load, and prestige. This kit hardcodes a snapshot. Party-score totals are dummy values. Missions don't actually run.

## How to extend

- Add a new component by dropping a `.jsx` file and including it in `index.html` **before** `App.jsx`. Export to `window` at the bottom of the file — each Babel script has its own scope.
- Match the game's class naming (`.mission-card`, `.inv-item`, `.shop-item`). The existing stylesheet covers 95% of states. Add new styles to `kit-extras.css`, not `style.css`.
- Neighborhood color comes from `--hood-color` set inline on any element that needs it — see `<NeighborhoodTabs>` and `<ActiveMissionRow>`.

## Known limitations / flags

- ⚠️ `CatPortrait` is a direct port of `drawCat()` from `CatGame/js/render.js`. If the game's drawing changes, this has to be updated by hand.
- ⚠️ No proper logo asset — the brand is a Unicode `🐾` + gradient clip-text. See root `assets/paw-logo.svg` for a first-pass vector mark.
