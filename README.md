# VipKorner

VipKorner is an invitation-only, multi-user progressive web app for adults. It combines public profiles, photo and video posts, 24-hour Shorts, follows, private text messaging, moderation, and installable PWA behavior.

- App: [vipkorner.app](https://vipkorner.app)
- Marketing site: [vipkorner.com](https://vipkorner.com)
- Repository: [indzon/vipkorner](https://github.com/indzon/vipkorner)

## Product behavior

- New members register with an active, unused invitation code.
- Date of birth is checked server-side; under-18 registration is rejected and the date itself is not stored.
- Email confirmation completes the pending profile, claims the invitation, establishes the session, and redirects into the app.
- Profiles are public by default unless the member enables the private-account setting. Private profiles remain discoverable, but their posts and Shorts are visible only after the owner approves a follow request.
- A signed-in member can open their own follower and following lists. Other members only see aggregate counts.
- Avatars and identity rows in connections, activity, and Explore open the relevant member profile; Explore identity copy is left-aligned for easy scanning, and other members’ follower/following lists remain hidden.
- Another member’s profile includes a message action that creates or reopens the private text conversation with that member.
- Member profiles use a rounded, image-led hero that the owner can replace from Edit profile. Location is required for account records but is public only when the owner enables **Show location on profile**. An avatar receives the active Short ring only while that member has an unseen Short, and the avatar opens that member’s Short sequence. Public profiles no longer carry a redundant status badge; private profiles show a request control until access is approved.
- Private follows use an owner-approved request workflow. Owners can approve or decline from Activity, and the requester receives the decision as a notification.
- Follow counts and activity refresh immediately after social actions, when the app regains focus, and periodically while it is visible.
- Shorts expire after 24 hours. The tray shows one unviewed Short per member and removes that member once all of their current Shorts have been seen.
- Posts support carousels of up to 10 mixed images and videos. A post has one primary caption, and each carousel item can optionally carry its own caption.
- Feed avatars open the author profile and use the active-Short ring when that author has unseen Shorts. Members can follow from a post header, double-tap media or use the heart to like with animated feedback, bookmark posts into their Saved collection, and send posts through private messaging.
- Saved collections are private by default. A member can make their Saved tab visible from Settings; the server still filters out posts the visitor is not authorized to view.
- Follow and unfollow controls are available in Explore and on public member profiles. Unfollow requires explicit confirmation. Successful new follows use a self-contained, full-screen VipKorner acknowledgement instead of a persistent status banner; block confirmation and profile/post reporting use branded in-app dialogs instead of browser prompts. For the current demo, every seeded or newly registered non-admin profile automatically follows the first active administrator.
- Members can react to another member’s Short with a quick emoji when that Short owner allows Short replies; each member has one current reaction per Short and can tap it again to remove it.
- Direct messages are text-only and subject to follow/block privacy controls. Unread totals appear on the desktop, compact, and mobile Messages navigation and refresh while the app is visible. On mobile, conversations remain available in a horizontal row above the active thread, represented by a vertically stacked avatar and member name.
- The production community includes six clearly fictional adult seed profiles with generated avatars, 37 image posts, and 9 active Short slots. These records enrich Explore and the feed without creating login credentials or email recipients.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system details and [docs/OPERATIONS.md](docs/OPERATIONS.md) for deployment and configuration.

## Design system

The application UI uses the **VipKorner Midnight Marquee** design system. Its
machine-readable tokens, responsive layout layer, visual reskin, and live
specimen documentation are maintained together in
[`design/system`](design/system). `app/globals.css` imports these layers in a
fixed order: Tailwind, tokens, the proven responsive layout, then the visual
reskin. The separation keeps the dark theme from changing page geometry or app
behavior. Narrow Short composers use tokenized inline padding and constrained,
balanced upload instructions so selection copy stays clear of the media-card
edges.

## Local development

Prerequisites: Node.js `>=22.13.0` and pnpm.

```bash
pnpm install
pnpm run dev
```

The local runtime uses the bindings declared in `.openai/hosting.json` and configured through `vite.config.ts`.

## Verification

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm test
pnpm run build
```

Use `pnpm run db:generate` after changing `db/schema.ts`. Review every generated migration before deployment.

The repeatable, idempotent community seed is documented in
[`seed/vipkorner-community`](seed/vipkorner-community). Generated media lives in
the `seed/community/` R2 prefix and is intentionally excluded from git.

## Data and security

- Supabase Auth owns credentials and authenticated sessions.
- Cloudflare D1 stores application records and social relationships.
- Cloudflare R2 stores uploaded media.
- The Worker revalidates authentication and authorization for every protected API operation.
- Follower/following list endpoints are self-scoped; no request parameter can select another member’s private list.
- Secrets belong in Cloudflare Worker secrets and must never be committed.

## License

Private project. All rights reserved.
