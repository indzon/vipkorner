# VipKorner architecture

## Runtime

VipKorner is a Vinext/React application deployed as a Cloudflare Worker. The same Worker serves the PWA at `vipkorner.app` and the static marketing experience at `vipkorner.com`.

| Layer | Service | Responsibility |
| --- | --- | --- |
| UI and API | Cloudflare Workers | React application, server routes, authorization, PWA assets |
| Authentication | Supabase Auth | Email/password accounts, confirmation, session cookies |
| Relational data | Cloudflare D1 | Users, invitations, posts, follows, messages, moderation |
| Media | Cloudflare R2 | Profile photos and hero backgrounds, carousel post media, Short media |

## Authentication and registration

1. The applicant submits name, username, email, password, invitation code, and date of birth.
2. The Worker verifies the member is at least 18 without persisting the birth date.
3. A pending registration reserves the username and invitation for up to 48 hours.
4. Supabase sends the confirmation email.
5. `/auth/confirm` exchanges or verifies the Supabase token, creates the D1 profile, claims the invitation, and redirects to `/` with an authenticated session.

The app stays invitation-only while `app_meta.registration_mode` is `invite`.

## Social graph privacy

`follows` stores approved directional relationships using `(follower_id, followed_id)` as its composite key. `follow_requests` stores the private-account request lifecycle (`pending`, `approved`, `declined`, or `canceled`) without granting media access until an approved request creates a `follows` row.

- Discovery returns available profile summaries and aggregate follower counts, including private profiles so a signed-in member can request access.
- `/api/social?counts=1` returns only the signed-in member’s counts.
- `/api/social?list=followers` and `?list=following` always resolve against the authenticated member; callers cannot request another member’s list.
- `/api/social?profile=<id>` returns one available member’s public profile summary and aggregate counts, but never their connection lists.
- Follow and block mutations return refreshed counts for immediate UI updates.
- A follow mutation creates a direct relationship only for a public profile. Private profiles create a pending request and owner notification; the owner can approve or decline from Activity, and the requester receives the decision as a notification.
- The client refreshes the feed, activity, counts, and conversations every 15 seconds while visible and whenever the window regains focus.

Member-profile post and Short visibility continues to depend exclusively on `users.is_public`, self-ownership, or an approved `follows` row. Pending requests never satisfy media queries. The profile summary includes the member location and an owner-selected hero image. If no explicit hero has been uploaded and the viewer may see posts, the latest visible post image is used as a fallback for the gradient-backed hero. Locked private profiles fall back to public avatar imagery and do not expose private post keys. Profile-hero uploads use the multipart R2 pipeline, but completion updates `users.hero_image_key` / `users.hero_image_url` and removes a replaced R2 object.

Connection rows, notification actors, and Explore identities all use the same member-profile navigation path. Activity payloads include the actor’s public avatar fields so the UI does not substitute a generic activity icon. From another member’s profile, the message action posts `{ action: "start", targetId }` to `/api/messages`, then opens the returned conversation in the Messages view. The client loads conversation summaries at startup, on focus, and every 15 seconds while visible so the Messages navigation can display an aggregate unread count; opening a conversation marks its messages read and refreshes that count.

## Short reactions

`story_reactions` stores at most one emoji per `(story_id, user_id)`. `/api/stories` validates reactions against the supported emoji set, rechecks Short visibility and block rules, honors the Short owner’s internal `story_replies` setting, and prevents self-reactions. Selecting a new emoji replaces the prior reaction; selecting the active emoji removes it. A current reaction creates one owner notification, and changing or removing the reaction replaces or removes that notification.

The home Shorts tray groups active Shorts by member and displays only members who still have an unviewed Short for the current viewer. On a member profile, the avatar uses the same unseen-Short state for its ring and opens the first unseen Short (or the first remaining active Short). The Short viewer retains the complete ordered Short set for that member so manual navigation and timed autoplay continue across items.

## Post carousels

`posts` remains the parent record and preserves the first media item in its legacy media columns for compatibility with existing grids and seeded content. `post_media` stores the ordered carousel items, their R2 keys or external URLs, media types, and optional item captions. New posts accept 1–10 mixed images and videos. The API rejects positions outside `0–9`, checks ownership and item count for subsequent uploads, and enforces one media item per `(post_id, position)` at the database layer. The first completed upload creates the parent. Deleting a post removes every related `post_media` record and R2 object.

## Main application routes

| Route | Purpose |
| --- | --- |
| `/api/auth` | Supabase sign-in, invitation validation, pending registration |
| `/auth/confirm` | Confirmation exchange and automatic profile finalization |
| `/api/feed` | Feed, Shorts with viewer reaction state, comments, notifications, own profile summary |
| `/api/social` | Discovery, direct follows, private follow requests, blocks, reports, invitations, connection lists |
| `/api/messages` | Text-only conversations, message requests, and unread totals |
| `/api/stories` | Short creation, views, reactions, and owner deletion |
| `/api/uploads` | Validated multipart R2 uploads, including ordered post-carousel completion |
| `/api/media` | Authorized media delivery |

## Schema workflow

`db/schema.ts` is the documented schema source. `db/storage.ts` also performs idempotent runtime initialization for the existing D1 deployment. When schema changes:

1. Update both files.
2. Run `pnpm run db:generate`.
3. Inspect the generated SQL in `drizzle/`.
4. Run type checking, lint, and a production build before deploying.
