# VipKorner

VipKorner is an invitation-only, multi-user progressive web app for adults. It combines public profiles, photo and video posts, 24-hour stories, follows, private text messaging, moderation, and installable PWA behavior.

- App: [vipkorner.app](https://vipkorner.app)
- Marketing site: [vipkorner.com](https://vipkorner.com)
- Repository: [indzon/vipkorner](https://github.com/indzon/vipkorner)

## Product behavior

- New members register with an active, unused invitation code.
- Date of birth is checked server-side; under-18 registration is rejected and the date itself is not stored.
- Email confirmation completes the pending profile, claims the invitation, establishes the session, and redirects into the app.
- Profiles are public by default unless the member enables the private-account setting.
- A signed-in member can open their own follower and following lists. Other members only see aggregate counts.
- Avatars and identity rows in connections, activity, and Explore open the relevant member profile; Explore identity copy is left-aligned for easy scanning, and other members’ follower/following lists remain hidden.
- Another member’s profile includes a message action that creates or reopens the private text conversation with that member.
- Follow counts refresh immediately after follow/block actions, when the app regains focus, and periodically while it is visible.
- Stories expire after 24 hours. Posts and stories support images and videos.
- Direct messages are text-only and subject to follow/block privacy controls.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system details and [docs/OPERATIONS.md](docs/OPERATIONS.md) for deployment and configuration.

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

## Data and security

- Supabase Auth owns credentials and authenticated sessions.
- Cloudflare D1 stores application records and social relationships.
- Cloudflare R2 stores uploaded media.
- The Worker revalidates authentication and authorization for every protected API operation.
- Follower/following list endpoints are self-scoped; no request parameter can select another member’s private list.
- Secrets belong in Cloudflare Worker secrets and must never be committed.

## License

Private project. All rights reserved.
