# Cat Adventure Club — Design System

A design system for **Cat Adventure Club**, a semi-idle web game about adventuring cats on the loose. Players recruit cats, assign them to missions across themed neighborhoods, loot treasures, level up, and prestige via "Cat Nap" ascensions.

## Sources

- **Codebase:** `CatGame/` (attached local folder) — vanilla JS + single HTML + `style.css`
  - `CatGame/index.html` — root layout: top bar, 3-column game view, active-mission strip, modal, toast stack
  - `CatGame/style.css` — ~1100 lines of CSS. Source of truth for tokens, components, and states.
  - `CatGame/js/data.js` — static definitions (cat breeds, neighborhoods, mission tiers, shop items, eternal perks, synergies)
  - `CatGame/js/game.js` — tick loop, mission resolution, stats math
  - `CatGame/js/render.js` — canvas cat drawing + DOM panel rendering
  - `CatGame/js/state.js`, `js/main.js` — save/load + bootstrap

The game is a single product (a browser game). This design system recreates its UI so the visual language can be reused for marketing pages, splash screens, onboarding, store pages, etc.

## Product Context

**Cat Adventure Club** is a browser idle-adventure:

- **The Club** — up to 16 cats across 4 classes: Scrapper (fighter), Mystic (mage), Prowler (rogue), Purrist (cleric). Each has stats (STR/DEX/CON/INT/WIS/CHA), a breed, a palette, equipment, and XP.
- **Neighborhoods** — 4 themed zones with elemental tags: The Park (🌳 earth), The Lake (🌊 water), The Rooftops (🌆 air), The Bakery (🔥 fire). Each has environmental **hazards** ("Bold Squirrels", "Slippery Docks", "Oven Flares"…).
- **Missions** — 10 tiers, from 1-minute T1 runs to 48-hour T10 expeditions. Players build a party and "Plan" a send, previewing party score vs. difficulty with hazards and synergies.
- **Loot** — 4 rarities (common / rare / epic / legendary), 4 slot types (collar / toy / treat / relic), with elemental affinity and stat bonuses.
- **Currencies** — 💰 Moneys (common), 🐟 Fishes (rare), 🎀 Treaties (rarest), 🌀 Nine Lives (prestige). 🐈 cat count.
- **Prestige** — "Cat Nap (Ascension)" — retire 15 cats, carry 1 forward as a Veteran, earn Nine Lives, unlock Eternal Perks.

## Content Fundamentals

**Voice:** warm, witty, low-stakes whimsy. Cats are serious about very silly things. Prose leans into animal-fantasy tropes, then punctures them. No exclamation-point energy, no hustle tone.

**Tone examples (pulled from source):**
- Neighborhood flavor: "Shady oaks, bold squirrels, muddy paws." / "Quiet docks, koi drifting in lantern light." / "Starlight, chimney pots, daring leaps."
- Hazards have real menace wrapped in cozy language: "Something old watches from the canopy." / "Something in the reeds remembers you." / "A broom has your name on it."
- Class blurbs read like trading cards: "Tough frontline tabby." / "Arcane long-hair." / "Sleek and silent." / "Compassionate guardian."
- Verdicts are blunt: `likely crit` / `favored` / `risky` / `doomed`

**Casing:**
- **UI labels:** Title Case for buttons and section headers ("Club Shop", "Active Missions", "Send party")
- **Stat labels:** ALL CAPS, letter-spaced (STR, DEX, CON)
- **Section H2s:** ALL CAPS, `font-size: 13px`, `letter-spacing: 1.2px`, dim color — reads as an engraved plaque, not a shout
- **Verdicts, state badges:** ALL CAPS with tracking ("UNLOCKED", "ON MISSION")

**Pronouns:** Mostly third-person about the cats ("Retire 15 cats, pick 1 to carry…"). Second-person to the player only for direct actions ("You'll earn +3 🌀"). Never first-person.

**Numbers & data:** Heavy use of `font-variant-numeric: tabular-nums` for XP, timers, currencies. Counts like `0/16`, `T3`, `Lv 12`, `DC 40+4=44`. Short rich formatting like `+3 STR` and `12m 30s`.

**Emoji as glyphs:** emoji are load-bearing, not decorative — they're the game's iconography (see Iconography section). Currencies (💰🐟🎀🌀🐈), neighborhoods (🌳🌊🌆🔥), class badges (⚔ ✿ ✶ ✚), shop items (🧹🥫🎲🌿🍣🎫💎🍼), synergies (🛡️🎭🌈🐾).

**Copy examples to keep:**
- Empty states: *"No retirees yet. The club is young."* / *"No loot yet. Plan a mission!"* / *"No idle cats. The club is young."*
- Perks: *"+200💰"* / *"Missions accept up to 4 cats."*
- Shop desc: *"Single-use. Your next mission gets +25% stray-offer chance."*
- Cat Nap: *"Retire 15 cats, pick 1 to carry (with gear) into a new run. Kept cat gains Veteran +1 (all base stats +1)."*

## Visual Foundations

**Color vibe.** A **dark, cozy midnight-blue** game UI, warm gold accents. Reads like a late-night hearth: `#14161c` page → `#1c1f29` panel → `#242836` raised. Gold (`#ffd866`) is the single warm hero that carries every active/primary/critical moment. Neighborhoods are keyed to **four distinct hues** (earth green, water blue, air lavender, fire coral) that surface as tab borders, mission ribbons, hazard accents. Rarity uses the classic MMO palette (gray → blue → purple → gold).

**Typography.** Display face is **Fraunces** (Google Fonts) at its wonky 144-opsz / SOFT 100 / WONK 1 setting — a chunky, slightly-off serif with optical sizing that matches the "serious about silly things" voice. Used for the wordmark, hero headlines, flavor copy. Body/UI text stays on the system stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`) for maximum density. 14px base, 1.45 line-height. H2s are small, uppercase, letter-spaced sans-serif labels (not display type). The brand title is Fraunces with a gold→coral gradient clip-text. Numbers always tabular.

**Spacing.** 4px rhythm. Panel padding = 12px, element gap = 4–14px. Top bar 10×20. Cards 6–10px internal padding. Everything is compact — this is a data-dense idle UI, not a marketing page.

**Corner radii.** 3-step scale: `4px` (tiny buttons, stat cells), `5–6px` (inventory items, shop rows), `8px` (cards, tabs), `10px` (columns, modal). Pill badges use `12px` radius.

**Borders.** Bordered, not floating. Every card has a 1–1.5px border in `--border` (`#2e3343`) or `--border-strong` (`#3a4057`). Rarity / neighborhood states swap the border color — not the fill. Selected/active states use colored borders + a *barely tinted* `color-mix` fill (`color-mix(in srgb, var(--accent) 18%, transparent)`).

**Shadows.** Minimal. Modal gets `0 20px 60px rgba(0,0,0,0.5)`, toasts `0 10px 30px rgba(0,0,0,0.5)`. Legendary items glow with `box-shadow: 0 0 12px rgba(255,179,71,0.25)`. No elevation scale; shadows are situational.

**Gradients.** Used sparingly for polish:
- Top bar: `linear-gradient(180deg, #1e2230 0%, #181b25 100%)` (subtle vertical)
- Brand title: `linear-gradient(90deg, #ffd866, #ff9f68)` clipped to text
- XP bar fill: `linear-gradient(90deg, #6fc38a, #a8dc6f)` (green)
- Mission progress: `linear-gradient(90deg, #c9a94a, #ffd866)` (gold)
- Cat nap panel: `linear-gradient(135deg, tinted-purple, panel)` (nine-lives purple tint)
- Cat portrait bg: `radial-gradient(circle at 50% 55%, #2a2f42 0%, #1a1d29 100%)`

**Backgrounds.** Flat dark panels. No imagery, no textures, no patterns. Cat portraits are **procedurally drawn on `<canvas>`** — not sprites — with rarity-glow backgrounds. This is an idle game, not an art-driven RPG; the vibe is "data dashboard with warmth."

**Animation.** Restrained and functional.
- Transitions: 0.15–0.25s, almost always on `border-color`, `background`, `opacity`, `filter: brightness()`, and `transform`.
- `choice-pulse` keyframe — 1.8s ease-in-out infinite on actionable ★ buttons (glowing ring).
- Tail wag on canvas cats — sine wave, `Math.sin(t) * 7`, continuous RAF.
- Toasts: slide-in from right 20px + opacity 0→1 over 0.25s.
- No bounces, no spring physics, no scroll animations.

**Hover states:** Border color shifts to `--accent-dim` or `--accent`. Filter-brightness 1.15–1.2 on interactive items. Background color sometimes deepens (`--border-strong`). Links/buttons never animate size.

**Press states:** `transform: translateY(1px)` for pressable items (equip slots, inventory items). Primary buttons just swap `background` → `--accent` with `color: #2a2a2a`.

**Disabled:** `opacity: 0.4–0.6`, `cursor: not-allowed`. Locked content: `opacity: 0.5` plus italic muted-text explainer.

**Transparency & blur.** Modal backdrop: `rgba(10,12,18,0.7)` + `backdrop-filter: blur(2px)`. `color-mix(in srgb, <hue> 14–18%, panel)` everywhere for soft tinted states. No heavy glassmorphism.

**Layout rules.** Fixed top bar (brand / resources / save indicator), fixed bottom "active strip" for running missions, fixed toast stack top-right, modal centered with backdrop. Main content is a 3-column CSS grid (`1.1fr 1.3fr 0.9fr`) that collapses to stacked below 1080px and mobile below 520px.

**Cards.** Dark panel fill, 1–1.5px border, 6–10px radius, compact padding. State transitions ONLY via border-color, never elevation. Rarity cards get colored border + faintly tinted interior. Cards never look "clickable" by shadow — they look clickable by border-hover.

**Density.** This game packs 6 cat stat cells, 4 equip slots, an XP bar, level, name, class, and two action buttons into a 108px-tall card. Every pixel earns its place. Mirror this in future surfaces: prefer packed grids over generous whitespace.

## Iconography

**Primary icon system: Unicode emoji & symbols.** The game uses zero SVG icons, zero icon fonts, zero PNG icons. Everything is a Unicode character rendered in-flow as text.

- **Currencies:** 💰 (gold), 🐟 (fish), 🎀 (treaty), 🌀 (nine lives), 🐾 (brand), 🐈 (cat)
- **Neighborhoods:** 🌳 Park (earth), 🌊 Lake (water), 🌆 Rooftops (air), 🔥 Bakery (fire)
- **Class badges:** `⚔` (Scrapper), `✿` (Mystic), `✶` (Prowler), `✚` (Purrist) — geometric glyphs drawn on `<canvas>` in gold
- **Synergies:** 🛡️ Guardian Pact, 🎭 Arcane Thief, 🌈 Full Spectrum, 🐾 Pack Tactics
- **Shop items:** 🧹 🥫 🎲 🌿 🍣 🎫 💎 🍼 — each mapped 1:1 to an SKU
- **Eternal perks:** ★ (party slots), 🐈 (club slot), 💰 (head start)
- **States:** ★ (stat-choice available), 🏡 (retire / lounge), 💤 (cat nap), ▸ / ▾ (details arrows), ● (save indicator), ↺ (use-last-party)
- **Outcomes:** ⭐ crit / ✅ success / ⚠️ fail

**No Lucide, no Heroicons, no Feather.** Keep the emoji-first language if building new surfaces. When an emoji isn't expressive enough, fall back to a simple Unicode geometric glyph (★ ✿ ✶ ✚ ▸ ● ↺) rendered in-text in gold or muted-gray.

**Logos & brand art.** The brand-mark is a **four-toe cat paw** where each toe bean is colored for one of the four neighborhoods — green (Park), blue (Lake), lavender (Rooftops), coral (Bakery). The main pad is the hero gold. This encodes the core game concept (four zones of adventure) into the mark. Three variants ship in `assets/`:
- `paw-logo.svg` — the full neighborhood-colored paw (primary mark)
- `paw-logo-mono.svg` — all-gold version for small sizes, single-color contexts, print
- `app-icon.svg` — paw inside a dark gradient circle with gold→coral ring (avatar / favicon / store icon)
- `wordmark.svg` — "Cat Adventure Club" set in Fraunces display, gold→coral gradient clip
- `logo-lockup.svg` — paw + wordmark horizontal lockup

The in-game top bar pairs `paw-logo.svg` with the Fraunces wordmark. Old `🐾` usage in UI copy (toasts, log entries) is fine — it's read as "brand flavor," not as a logo.

**Cat portraits.** Procedurally drawn on `<canvas>` — see `render.js drawCat()`. Each cat gets a sitting-pose sprite: ellipse body, round head, triangle ears, oval eyes with colored iris and slit pupil, triangular pink nose, smile-curve mouth, four whiskers per side, wagging tail (sine-wave RAF). Fur/accent/eye palette is breed-based with ±variance per cat. Rarity glow is a radial gradient behind the cat. A gold class-badge circle sits top-right. "ON MISSION" ribbon across the bottom when busy.

## Flagged substitutions & open questions

- ✅ ~~No webfonts~~ → **Fraunces** is now the display face (Google Fonts, free, variable font with SOFT + WONK axes that match the brand voice). Body/UI stays on the system stack. If you'd prefer a different face, say the word.
- ✅ ~~No logo file~~ → Primary paw-mark designed in `assets/paw-logo.svg` with neighborhood-colored toe beans. Three variants shipped.
- ⚠️ **No marketing surfaces.** The game has no landing page, store page, press kit, or splash screen in the codebase. This system infers from the in-game look. UI kit covers the game only.

## Index

- `README.md` — this file
- `colors_and_type.css` — CSS custom properties & semantic type tokens
- `SKILL.md` — skill manifest, portable to Claude Code
- `assets/` — SVG class-badges, paw logo mark, sample cat portraits (see `assets/README.md`)
- `fonts/` — (empty — game uses system stack)
- `preview/` — Design System tab preview cards
- `ui_kits/game/` — pixel-accurate recreation of the Cat Adventure Club game UI
  - `ui_kits/game/index.html` — interactive click-thru prototype
  - `ui_kits/game/*.jsx` — React components (TopBar, CatCard, MissionCard, ShopItem, etc.)
