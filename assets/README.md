# Assets

The game uses **Unicode emoji and geometric glyphs** rendered in-text for most in-UI iconography — there are no icon files for currencies, neighborhoods, shop items, etc. This folder contains the **brand marks**:

## Logo marks

- `paw-logo.svg` — **Primary mark.** Four-toe cat paw with each toe bean colored for one of the four neighborhoods (green Park, blue Lake, lavender Rooftops, coral Bakery). Main pad is hero gold `#FFD866`. This encodes the core game concept (four zones of adventure) into the mark.
- `paw-logo-mono.svg` — All-gold version. Use below ~32px, on busy backgrounds, for single-color contexts, and for print.
- `app-icon.svg` — Paw inside a dark gradient circle with a gold→coral stroke ring. Use for avatars, favicons, store icons, social profile images.
- `wordmark.svg` — "Cat Adventure Club" set in Fraunces display (opsz 72, WONK on), gold→coral gradient clip-text.
- `logo-lockup.svg` — Horizontal lockup: paw + wordmark.

## Class badges

- `class-scrapper.svg` — ⚔ Scrapper (fighter)
- `class-mystic.svg` — ✿ Mystic (mage)
- `class-prowler.svg` — ✶ Prowler (rogue)
- `class-purrist.svg` — ✚ Purrist (cleric)

## Usage rules

- **Min size.** Primary paw reads down to ~20px. Below that, swap to `paw-logo-mono.svg`.
- **Clear space.** Keep a margin around the paw equal to one "toe bean" of height.
- **Do not** recolor the toe beans — the four colors are structural, not decorative.
- **Do not** drop shadows or 3D effects on the paw. It's flat by design.
- **Wordmark** must be set in Fraunces with `font-variation-settings: 'opsz' 72, 'SOFT' 100, 'WONK' 1`. The gold→coral gradient is the only approved fill; mono-gold `#FFD866` works on light backgrounds.

All other in-UI iconography (🐾 🌳 🌊 🌆 🔥 💰 🐟 🎀 🌀 ⚔ ✿ ✶ ✚) stays as Unicode characters rendered in text — see the root `README.md` ICONOGRAPHY section.
