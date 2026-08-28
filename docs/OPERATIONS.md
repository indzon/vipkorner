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
3. Approve the request and confirm a `follows` row is created, the requester receives an approval notification, and the private posts and Shorts become visible.
4. Repeat with a decline and confirm no `follows` row is created and the requester receives the decline notification.
5. Cancel a pending request and block either participant; confirm pending request records cannot grant access afterward.

## Messaging and Short-reaction smoke test

1. Send a text message from one member to another and confirm the recipient sees the same unread badge on desktop navigation, compact navigation, and mobile navigation without manually refreshing the page.
2. Open the conversation and confirm the unread badge clears after the messages are marked read.
3. Open another member’s active Short, choose an emoji, and confirm it becomes selected and the reaction count updates.
4. Choose a different emoji and confirm it replaces the first; choose the selected emoji again and confirm it is removed.
5. Disable Short replies on the Short owner’s account and confirm reaction controls are no longer offered to other members.

## Carousel and responsive UI smoke test

1. Create a post with 10 mixed supported photos and videos, leaving some item captions blank and adding captions to others.
2. Confirm the feed card and full-screen viewer can move through every item, video playback resets between items, and the optional item caption changes with the active item.
3. Delete the post and confirm its parent record, ordered media rows, and uploaded R2 objects are removed.
4. On a mobile viewport, open Messages and confirm conversation summaries form a horizontally scrollable row above the active thread.
5. View every active Short from one member and confirm that member disappears from the home Shorts tray while other members with unviewed Shorts remain.
6. Follow a new member and confirm the full-screen animated acknowledgement appears without a persistent “Profile updated” notice.
7. Open a public member profile, follow and unfollow from the hero control, and confirm neither action blanks or reloads the application.
8. Open a member with an unseen Short, confirm the avatar has the colorful Short ring, select it, and verify the viewer opens that member’s Short sequence. After viewing all active Shorts, confirm the ring is removed.
9. On a narrow mobile viewport, open **New short** and confirm the upload heading and file-size guidance wrap within the padded media surface without touching either edge.

## Profile personalization and safety-dialog smoke test

1. Open **Edit profile** and confirm every text input and textarea uses the design-system surface, border, spacing, radius, type, and focus treatment.
2. Confirm location is required, toggle **Show location on profile** off, save from the bottom action, and verify the owner can still edit the stored location while another member cannot see it.
3. Toggle location sharing on and confirm another member can see the location after saving without a reload.
4. Choose a landscape profile background, save, reopen the profile, and confirm the uploaded image is used in the owner and member hero without exposing a raw R2 key.
5. Replace the background and confirm the prior owned R2 object is removed.
6. Choose **Block** from Explore, confirm the VipKorner-branded in-app dialog appears, cancel once, then confirm the action and verify both members are hidden from each other.
7. Choose **Following** on a member profile, cancel the confirmation once, then confirm the unfollow and verify the relationship is removed.

## Demo administrator-follow smoke test

1. Apply the community seed and confirm all six `seed-*` users follow the first active administrator.
2. Register a new non-admin member and confirm the follow relationship is created during profile finalization.
3. On an existing database, allow runtime initialization to apply `admin_autofollow_v1` once, then confirm the marker exists in `app_meta`.
4. Unfollow the administrator from a test profile and restart the app; confirm the one-time migration does not recreate the relationship.

## Feed timestamp and media-viewer smoke test

1. Confirm every feed card shows its lowercase relative post time beneath the username and no duplicate time appears below the caption.
2. Open an image in the full-screen viewer and confirm it fits the available stage without a Fit/Fill/zoom toolbar.
3. On an owned post, confirm **Edit caption** uses the primary design-system control and **Delete post** uses the outlined danger treatment.
4. Hover the viewer like and comment counts and confirm their surfaces, text colors, and liked state use the current design-system tokens.
5. Follow a public member from Explore and from a member profile; each successful action must play exactly one acknowledgement animation.
6. Confirm followed authors do not show a redundant **Following** control in the feed; unfollowed authors still show **Follow**.
7. Choose **Hide post** from another member's post menu and confirm the post disappears immediately and stays absent after a refresh without affecting other members' feeds.
8. Like and unlike a post with the heart, then double-tap unliked media; confirm each action changes the count once and the count never flashes back while the request or a background feed refresh is in flight.

## Fictional community seed

The six production seed profiles are application-data records only. They are
not Supabase Auth users and cannot sign in. Their reserved `.invalid` email
addresses must never be changed to deliverable addresses.

- Source: `seed/vipkorner-community/seed.sql`
- D1 record prefix: `seed-`
- R2 object prefix: `seed/community/`
- Expected totals: 6 profiles, 37 posts, 9 active Shorts

Before applying the seed, query D1 for username collisions. Upload the 52
optimized JPEG assets to the documented R2 keys, then run the SQL remotely.
The SQL only replaces `seed-post-*`, `seed-story-*`, and follow relationships
involving `seed-*` users; unrelated member data is not touched. Re-running it
refreshes the 24-hour Short windows.
