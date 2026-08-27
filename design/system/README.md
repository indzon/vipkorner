# VipKorner Design System — Midnight Marquee

Version 1.0.1 · presentation only · no functional change to the app.

Open **`index.html`** in a browser for the full documentation. Its specimens are
rendered by the two stylesheets in this folder, not by copies — if a component
looks wrong there, it is wrong in the app.

## Files

| File | Role |
| --- | --- |
| `vipkorner-tokens.css` | Primitives + semantic aliases. The only place a colour, size, duration or z-index is invented. Ends with a legacy bridge for the nine variables `globals.css` uses today. |
| `vipkorner-layout.css` | Proven responsive geometry restored from the pre-reskin app: page grids, sizing, positioning, overflow and mobile breakpoints. |
| `vipkorner-reskin.css` | Visual-only compatibility layer for color, borders, type, elevation and control states. It deliberately does not redefine the app grid. |
| `vipkorner-theme.css` | Full design-system reference stylesheet retained as a component specification; it is not imported by the production app. |
| `tokens.json` | The same tokens, machine-readable, with contrast ratios recorded. For a Tailwind theme extension, a Figma sync, or a lint rule. |
| `index.html` | Documentation, live specimens, contrast tables, adoption plan. |

## Install

```css
/* app/globals.css */
@import "tailwindcss";
@import "../design/system/vipkorner-tokens.css";
@import "../design/system/vipkorner-layout.css";
@import "../design/system/vipkorner-reskin.css";
```

Order matters: tokens precede both application layers, the layout loads before
the reskin, and all three load after Tailwind's preflight. Do not replace the
layout layer with the reference theme; the layout file is the compatibility
contract for desktop, compact and mobile views.

## Coverage (verified, not asserted)

- **210 / 210** legacy class selectors remain covered by the layout plus reskin layers.
- **175 / 175** distinct `className` values in `app/page.tsx` and `app/login/page.tsx` remain covered.
- **0** raw hex values in the theme outside gradient stops.
- **0** colours in the purple (255–330°) or teal (155–205°) hue bands. `--plum #7d3d6a` is retired and bridged to gold.
- Contrast ratios computed for every text token against all four surfaces; two documented exceptions with named substitutes.

## The one rule

Components reference semantic tokens. Semantic tokens reference primitives.
Primitives are the only literals. If a component needs a colour with no semantic
name, the colour is missing from the system — add it to the token file, don't
inline it.

## Known issues in the current app that this surfaces

1. `.add-story`, `.login-loading` and `.member-profile-page` are compatibility
   selectors supplied by the system layers even though the legacy stylesheet
   did not define them.
2. `font-family: var(--font-geist), Arial, sans-serif` has no fallback inside
   `var()`. If `next/font` has not injected the variable, the whole declaration
   is invalid and the app silently reverts to the browser default serif. The
   token file uses `var(--font-geist, system-ui)`.
3. Notification badges use 9px white numerals on `#e95072` — 3.59:1, failing on
   both colour and size. Badges here use `rose-700` at 11px (5.59:1).
4. `app/page.tsx` holds all five views in 1,108 lines. Split it before a
   redesign lands on top of it.

## Not covered

The marketing site, email templates, a light theme, and a custom icon set.
See the "Out of scope" section of `index.html`.
