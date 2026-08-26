# VipKorner Design System — Midnight Marquee

Version 1.0.0 · presentation only · no functional change to the app.

Open **`index.html`** in a browser for the full documentation. Its specimens are
rendered by the two stylesheets in this folder, not by copies — if a component
looks wrong there, it is wrong in the app.

## Files

| File | Role |
| --- | --- |
| `vipkorner-tokens.css` | Primitives + semantic aliases. The only place a colour, size, duration or z-index is invented. Ends with a legacy bridge for the nine variables `globals.css` uses today. |
| `vipkorner-theme.css` | Every component, styled entirely from tokens. Keyed to the class names already in `app/globals.css` and `app/page.tsx` — no markup changes needed. |
| `tokens.json` | The same tokens, machine-readable, with contrast ratios recorded. For a Tailwind theme extension, a Figma sync, or a lint rule. |
| `index.html` | Documentation, live specimens, contrast tables, adoption plan. |

## Install

```css
/* app/globals.css */
@import "tailwindcss";
@import "../design/system/vipkorner-tokens.css";
@import "../design/system/vipkorner-theme.css";
```

Order matters: tokens before theme, theme after Tailwind's preflight.

## Coverage (verified, not asserted)

- **210 / 210** class selectors in `app/globals.css` have a rule in the theme.
- **175 / 175** distinct `className` values in `app/page.tsx` and `app/login/page.tsx` are covered.
- **0** raw hex values in the theme outside gradient stops.
- **0** colours in the purple (255–330°) or teal (155–205°) hue bands. `--plum #7d3d6a` is retired and bridged to gold.
- Contrast ratios computed for every text token against all four surfaces; two documented exceptions with named substitutes.

## The one rule

Components reference semantic tokens. Semantic tokens reference primitives.
Primitives are the only literals. If a component needs a colour with no semantic
name, the colour is missing from the system — add it to the token file, don't
inline it.

## Known issues in the current app that this surfaces

1. `.add-story`, `.login-loading` and `.member-profile-page` are applied in
   `page.tsx` but have no rule anywhere in `globals.css`. They render unstyled
   today. The theme defines them — audit whether they are dead markup.
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
