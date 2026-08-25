# VipKorner

VipKorner is an adults-only social PWA with public profiles, posts, 24-hour
stories, text messaging, following, blocking, and community administration.

## Local development

Requirements: Node.js 22.13 or newer and pnpm 11.

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Set the Supabase project URL and publishable key in `.env.local` to enable
public email/password authentication. The publishable key is intentionally safe
for browser use; never expose a Supabase secret or service-role key.

## Production deployment

The manual GitHub Actions workflow builds and deploys the Cloudflare Worker.
Before running it, configure these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VIPKORNER_D1_DATABASE_ID`

The workflow uses the `vipkorner-db` D1 database and `vipkorner-media` R2
bucket. The Supabase URL and publishable key are included at build time.

## Useful commands

- `pnpm dev` starts local development.
- `pnpm build` creates the Cloudflare Worker build.
- `pnpm lint` checks the application source.
