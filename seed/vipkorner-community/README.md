# VipKorner community seed

This seed adds six fictional adult community profiles to the production social
data layer. It does not create Supabase Auth users, passwords, sessions, or
deliverable email addresses.

## Contents

- 6 generated profile avatars
- 37 generated image posts (5–8 per profile)
- 9 generated image stories (1–2 per profile)
- A small follow graph between the six profiles

All original visuals were generated with ChatGPT Image 2.0. Optimized JPEG
derivatives are uploaded to Cloudflare R2; the PNG source files remain local.

## Production resources

- D1 database: `vipkorner-db`
- R2 bucket: `vipkorner-media`
- Object prefix: `seed/community/`

The SQL file is idempotent for the six `seed-*` record IDs. Re-running it
refreshes story expiry windows while preserving unrelated members and content.

