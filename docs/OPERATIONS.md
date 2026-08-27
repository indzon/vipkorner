# VipKorner operations

## Production endpoints

- PWA: `https://vipkorner.app`
- Marketing: `https://vipkorner.com`
- Worker fallback: `https://vipkorner.vipkorner.workers.dev`

## Required Cloudflare resources

- Worker: `vipkorner`
- D1 database: `vipkorner-db`
- R2 bucket: `vipkorner-media`
- Custom domains: `vipkorner.app`, `www.vipkorner.app`, `vipkorner.com`, `www.vipkorner.com`

## Required Worker secrets

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not put secret values in this repository, build logs, screenshots, or issue descriptions.

## Supabase Auth configuration

- Site URL: `https://vipkorner.app`
- Redirect URL: `https://vipkorner.app/auth/confirm`
- Email confirmations: enabled
- Custom SMTP: configure a verified provider before production email volume increases
- Recommended sender name: `VipKorner`
- Recommended sender address: `no-reply@auth.vipkorner.app`

## Release checklist

1. Update product behavior and relevant documentation in the same change.
2. Run `pnpm exec tsc --noEmit`.
3. Run `pnpm run lint` and review warnings.
4. Run the production `pnpm run build` with the D1/R2 build variables.
5. Deploy with Wrangler using `--keep-vars` so production secrets remain attached.
6. Smoke-test `/api/session`, authentication rejection paths, and affected APIs.
7. Push the exact deployed source revision to `indzon/vipkorner`.

## Connection-count behavior

Follow and block responses include the signed-in member’s current counts. The UI applies those counts immediately, then continues lightweight polling every 15 seconds while visible. Opening the owner-only follower/following modal revalidates both the list and counts.

Profile navigation from a connection or activity item requests only the selected member’s public summary and aggregate counts. Verify that these links open the correct profile and that no follower/following list is exposed for another member.

For member-profile releases, verify Explore identity copy remains left-aligned, open another member’s profile, select the accessible message icon, and confirm the correct private conversation opens in Messages.

## Private-profile request smoke test

1. Mark a test member private and confirm their profile remains discoverable, shows its location and hero treatment, hides the post grid, and offers **Request to Follow** instead of a profile-status badge.
2. Send a request and confirm it appears as pending for the requester and as an actionable Activity notification for the profile owner.
3. Approve the request and confirm a `follows` row is created, the requester receives an approval notification, and the private posts and stories become visible.
4. Repeat with a decline and confirm no `follows` row is created and the requester receives the decline notification.
5. Cancel a pending request and block either participant; confirm pending request records cannot grant access afterward.

## Messaging and story-reaction smoke test

1. Send a text message from one member to another and confirm the recipient sees the same unread badge on desktop navigation, compact navigation, and mobile navigation without manually refreshing the page.
2. Open the conversation and confirm the unread badge clears after the messages are marked read.
3. Open another member’s active story, choose an emoji, and confirm it becomes selected and the reaction count updates.
4. Choose a different emoji and confirm it replaces the first; choose the selected emoji again and confirm it is removed.
5. Disable story replies on the story owner’s account and confirm reaction controls are no longer offered to other members.

## Carousel and responsive UI smoke test

1. Create a post with 10 mixed supported photos and videos, leaving some item captions blank and adding captions to others.
2. Confirm the feed card and full-screen viewer can move through every item, video playback resets between items, and the optional item caption changes with the active item.
3. Delete the post and confirm its parent record, ordered media rows, and uploaded R2 objects are removed.
4. On a mobile viewport, open Messages and confirm conversation summaries form a horizontally scrollable row above the active thread.
5. View every active story from one member and confirm that member disappears from the home story tray while other members with unviewed stories remain.
6. Follow a new member and confirm the full-screen animated acknowledgement appears without a persistent “Profile updated” notice.
7. Open a public member profile, follow and unfollow from the hero control, and confirm neither action blanks or reloads the application.
8. Open a member with an unseen story, confirm the avatar has the colorful story ring, select it, and verify the viewer opens that member’s story sequence. After viewing all active stories, confirm the ring is removed.

## Profile personalization and safety-dialog smoke test

1. Open **Edit profile** and confirm every text input and textarea uses the design-system surface, border, spacing, radius, type, and focus treatment.
2. Choose a landscape profile background, save, reopen the profile, and confirm the uploaded image is used in the member hero without exposing a raw R2 key.
3. Replace the background and confirm the prior owned R2 object is removed.
4. Choose **Block** from Explore, confirm the VipKorner-branded in-app dialog appears, cancel once, then confirm the action and verify both members are hidden from each other.

## Fictional community seed

The six production seed profiles are application-data records only. They are
not Supabase Auth users and cannot sign in. Their reserved `.invalid` email
addresses must never be changed to deliverable addresses.

- Source: `seed/vipkorner-community/seed.sql`
- D1 record prefix: `seed-`
- R2 object prefix: `seed/community/`
- Expected totals: 6 profiles, 37 posts, 9 active stories

Before applying the seed, query D1 for username collisions. Upload the 52
optimized JPEG assets to the documented R2 keys, then run the SQL remotely.
The SQL only replaces `seed-post-*`, `seed-story-*`, and follow relationships
involving `seed-*` users; unrelated member data is not touched. Re-running it
refreshes the 24-hour story windows.
