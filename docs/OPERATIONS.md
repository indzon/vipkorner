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
