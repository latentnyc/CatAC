---
name: cat-adventure-club-design
description: Use this skill to generate well-branded interfaces and assets for Cat Adventure Club, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `DESIGN_SYSTEM.md` file within this skill, and explore the other available files:

- `DESIGN_SYSTEM.md` — full design system: product context, content fundamentals, visual foundations, iconography
- `colors_and_type.css` — CSS custom properties (colors, radii, spacing, type sizes, gradients) and semantic utility classes (`.cac-h2`, `.cac-body`, `.cac-brand-title`, `.cac-num`, etc.)
- `assets/` — SVG class-badges (Scrapper / Mystic / Prowler / Purrist), paw-mark, wordmark
- `ui_kits/game/` — pixel-accurate React recreation of the game UI, with `style.css` (the game's actual stylesheet) as the source of truth for component styles
- `preview/` — one-glance cards for each slice of the system (palette, type, radii, shadows, components)

If creating visual artifacts (slides, mocks, throwaway prototypes, marketing surfaces), copy assets out and create static HTML files for the user to view. The game's voice is **warm, witty, low-stakes whimsy** — cats are serious about very silly things. Default to the dark, cozy midnight-blue palette with gold as the single hero accent. Use Unicode emoji as iconography (🐾 currencies, 🌳🌊🌆🔥 neighborhoods, ⚔✿✶✚ class badges) — no icon fonts, no Lucide, no SVG icon kits.

If working on production code, import `colors_and_type.css`, reuse `ui_kits/game/style.css` class names where they apply, and match the existing compact density (4px spacing rhythm, 108–120px cat cards, uppercase tracked H2 labels).

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions (surface? audience? whimsy level? platform?), and act as an expert designer who outputs HTML artifacts **or** production code, depending on the need.
