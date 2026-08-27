# VipKorner marketing site — Midnight Marquee

A complete, self-contained marketing page built on the Midnight Marquee design
system in `design/system/`.

`design/marketing/index.html` is the editable source of truth and
`public/marketing.html` is the deployed copy served at `vipkorner.com`. After
editing the source, keep the deployed copy synchronized with:

```bash
cp design/marketing/index.html public/marketing.html
```

No route or Worker binding needs to change.

---

## What's in the file

One HTML file, no external requests, no dependencies, no build. It carries its
own token block — the subset of `design/system/vipkorner-tokens.css` this page
uses, copied verbatim. That's a deliberate trade: a marketing page should paint
in a single request with no render-blocking stylesheet and no flash of unstyled
content. **Do not hand-edit those values** — change them in the system file,
re-copy, and diff the two in CI so they cannot drift apart.

### Sections

| # | Section | Motion |
| --- | --- | --- |
| 1 | Sticky nav | Solidifies past 24px; reading-progress bar |
| 2 | Hero | Four parallax planes at different rates (glow 0.18 / 0.12 / 0.26, rings 0.34, copy −0.08, device −0.22) |
| 3 | Principles ticker | Drifts horizontally with scroll position, not on a timer |
| 4 | Three feature rows | Alternating, reveal from left/right, media plane at −0.10 |
| 5 | Stories strip | Pinned for 220vh; vertical scroll drives horizontal card travel |
| 6 | Invitations | Staggered card reveal (70ms apart, capped at 280ms) |
| 7 | Install / PWA | Reveal + slow media plane |
| 8 | Final CTA | Gradient plane at 0.10, scale-in reveal |

---

## Screenshot placeholders

Ten slots are reserved. **Every slot already occupies its exact final aspect
ratio**, so dropping the real image in causes zero layout shift — the page will
not reflow when your screenshots land.

Each placeholder in the file sits directly beneath an HTML comment containing
the exact `<img>` tag to paste in its place, alt text included. Replace the
`<div class="shot-hold">…</div>` with that `<img>`; change nothing else.

| Slot | File | Pixels (@2x) | Ratio | Capture |
| --- | --- | --- | --- | --- |
| 1 | `app-home@2x.png` | 780 × 1688 | 390:844 | Home feed — featured moment at the top, story rings beneath, first post partly visible |
| 2 | `app-composer@2x.png` | 780 × 1688 | 390:844 | Composer — photo selected, caption half-typed, Share active |
| 3 | `app-explore@2x.png` | 2560 × 1600 | 16:10 | Explore on desktop — three-column shell, search panel open, member grid |
| 4 | `app-messages@2x.png` | 780 × 1688 | 390:844 | A message thread — gold outgoing bubbles, grey incoming, composer at base |
| 5 | `story-1@2x.png` | 620 × 1102 | 9:16 | Story viewing — progress bars, poster name, time remaining |
| 6 | `story-2@2x.png` | 620 × 1102 | 9:16 | Story reacting — emoji row at the base, one chip selected |
| 7 | `story-3@2x.png` | 620 × 1102 | 9:16 | Story composing — caption being dragged over the image |
| 8 | `story-4@2x.png` | 620 × 1102 | 9:16 | The story rail — unviewed first with the gold ring, viewed ones flat |
| 9 | `app-signin@2x.png` | 2560 × 1600 | 16:10 | Sign-in — editorial panel left, invitation code field right |
| 10 | `app-install@2x.png` | 1600 × 1000 | 16:10 | Install sheet with its numbered add-to-home-screen steps |

**Capture settings.** Device pixel ratio 2. Phone shots at a 390 × 844 viewport,
desktop at 1280 × 800, story frames at 310 × 551. Put the files in
`public/shots/` so the `/shots/…` paths in the comments resolve as written.

**Before you publish them:** these are screenshots of a real social product. Use
seeded demo accounts, not member content — real usernames, faces, captions or
message text on a public marketing page is a disclosure you cannot take back,
and this is an invitation-only community for adults.

---

## Motion, and how it behaves when it shouldn't run

All animation is `transform` and `opacity` only — no layout properties are ever
animated. The scroll handler never reads layout: element positions are measured
once on load and re-measured on resize, so scrolling cannot force reflow. One
rAF loop drives everything, and elements more than 1.6 viewports away are
skipped entirely.

Three off-switches, all verified:

- **`prefers-reduced-motion: reduce`** — the whole system disables. Content
  renders in its final state, the pinned strip becomes an ordinary swipeable
  rail, the ticker stops. Verified: 20/20 reveals visible, 0/12 parallax
  elements transformed.
- **JavaScript disabled or broken** — every hidden state lives under a `.js`
  class set by an inline script before first paint. If that script never runs,
  the page is complete and static. Verified with JS off: headline visible,
  reveal opacity 1.
- **Print / PDF / screenshot services** — a `@media print` block forces final
  state. Without it, anything that captures without scrolling would render
  blank space where the reveals are.

Below 960px the parallax and pinning switch off on their own: the phone frames
stack, the story strip becomes a snap-scrolling rail. Both preference queries
are watched live, so a visitor toggling reduced motion mid-session is handled
without a reload.

---

## Verified

- No horizontal overflow at 360 / 390 / 768 / 960 / 1024 / 1440 / 1920px
- Zero JavaScript errors at every width
- All 20 scroll reveals fire; all 10 slots hold their exact aspect ratio
- No purple, no teal anywhere in the palette
- Contrast: every text-on-surface pairing clears WCAG AA

The one console error when opening the file directly from disk is
`/icon-192.png` — an absolute path that resolves correctly once the file is
served from `public/`.

## Two contrast bugs this fixed

1. **The CTA panel.** The current site's gradient runs `#5C2430 → #B9603A →
   #E8B455` with dark ink text on top. At the left edge that is **1.56:1** — the
   heading "Your invitation opens the door" is effectively unreadable there. The
   replacement keeps the gradient inside a light range (`#C0663C → #DE9247 →
   `#EFC471`), where the same ink text measures 4.63 / 7.39 / 11.39.
2. **Alpha text over a gradient.** The old body copy used
   `rgba(255,255,255,.x)` over a colour that changes across the panel, so its
   effective contrast differed at every horizontal position. All CTA text is now
   a solid colour; hierarchy comes from size and weight instead.

## Not done here

Open Graph image (`og-vipkorner.png`), favicon set, a privacy policy or terms
page, and analytics. The `<head>` is wired for all of them.
