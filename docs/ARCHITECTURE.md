# VipKorner architecture

## Runtime

VipKorner is a Vinext/React application deployed as a Cloudflare Worker. The same Worker serves the PWA at `vipkorner.app` and the static marketing experience at `vipkorner.com`.

| Layer | Service | Responsibility |
| --- | --- | --- |
| UI and API | Cloudflare Workers | React application, server routes, authorization, PWA assets |
| Authentication | Supabase Auth | Email/password accounts, confirmation, session cookies |
| Relational data | Cloudflare D1 | Users, invitations, posts, follows, messages, moderation |
| Media | Cloudflare R2 | Profile photos, post media, story media |

## Authentication and registration

1. The applicant submits name, username, email, password, invitation code, and date of birth.
2. The Worker verifies the member is at least 18 without persisting the birth date.
3. A pending registration reserves the username and invitation for up to 48 hours.
4. Supabase sends the confirmation email.
5. `/auth/confirm` exchanges or verifies the Supabase token, creates the D1 profile, claims the invitation, and redirects to `/` with an authenticated session.

The app stays invitation-only while `app_meta.registration_mode` is `invite`.

## Social graph privacy

`follows` stores directional relationships using `(follower_id, followed_id)` as its composite key.

- Discovery returns public profile summaries and aggregate follower counts.
- `/api/social?counts=1` returns only the signed-in member’s counts.
- `/api/social?list=followers` and `?list=following` always resolve against the authenticated member; callers cannot request another member’s list.
- `/api/social?profile=<id>` returns one available member’s public profile summary and aggregate counts, but never their connection lists.
- Follow and block mutations return refreshed counts for immediate UI updates.
- The client refreshes counts every 15 seconds while visible and whenever the window regains focus.

Connection rows, notification actors, and Explore identities all use the same member-profile navigation path. Activity payloads include the actor’s public avatar fields so the UI does not substitute a generic activity icon. From another member’s profile, the message action posts `{ action: "start", targetId }` to `/api/messages`, then opens the returned conversation in the Messages view. The client loads conversation summaries at startup, on focus, and every 15 seconds while visible so the Messages navigation can display an aggregate unread count; opening a conversation marks its messages read and refreshes that count.

## Story reactions

`story_reactions` stores at most one emoji per `(story_id, user_id)`. `/api/stories` validates reactions against the supported emoji set, rechecks story visibility and block rules, honors the story owner’s `story_replies` setting, and prevents self-reactions. Selecting a new emoji replaces the prior reaction; selecting the active emoji removes it. A current reaction creates one owner notification, and changing or removing the reaction replaces or removes that notification.

## Main application routes

| Route | Purpose |
| --- | --- |
| `/api/auth` | Supabase sign-in, invitation validation, pending registration |
| `/auth/confirm` | Confirmation exchange and automatic profile finalization |
| `/api/feed` | Feed, stories with viewer reaction state, comments, notifications, own profile summary |
| `/api/social` | Discovery, follows, blocks, reports, invitations, connection lists |
| `/api/messages` | Text-only conversations, message requests, and unread totals |
| `/api/stories` | Story creation, views, reactions, and owner deletion |
| `/api/uploads` | Validated R2 uploads |
| `/api/media` | Authorized media delivery |

## Schema workflow

`db/schema.ts` is the documented schema source. `db/storage.ts` also performs idempotent runtime initialization for the existing D1 deployment. When schema changes:

1. Update both files.
2. Run `pnpm run db:generate`.
3. Inspect the generated SQL in `drizzle/`.
4. Run type checking, lint, and a production build before deploying.
