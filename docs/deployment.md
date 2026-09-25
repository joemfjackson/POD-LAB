# Deployment (Supabase + Vercel)

## 1. Supabase project

1. Create a project (for example "POD Lab") and note the project ref, URL, publishable key and secret (service role) key.
2. Apply migrations:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. Run the security and performance advisors (Dashboard → Advisors, or the Supabase MCP `get_advisors`) and resolve anything they flag.
4. Auth → URL configuration: set **Site URL** to your production URL and add `https://<domain>/auth/callback` to the redirect URLs. Enable email confirmations for production.
5. Storage: the `pod-lab` bucket (private, 25 MB object limit, restricted MIME types) is created by the migration.

## 2. Vercel project

1. Import the Git repository. The framework preset is Next.js, and the build command is `next build`.
2. Environment variables (Production and Preview):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<domain>` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret**, server only |
| `POD_LAB_ENCRYPTION_KEY` | `openssl rand -base64 32`; required to store workspace credentials |
| `CRON_SECRET` | random string; Vercel Cron sends it as a Bearer token |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_DEFAULT_MODEL`, `AI_PRICE_*` | `demo` works without a key |
| `AGENT_EXECUTION_MODE` | `inline` (default) or `deferred` (uses `after()`) |
| Optional | `RESEARCH_*`, `IMAGE_*`, `DOMAIN_RDAP_ENABLED`, `SHOPIFY_*`, `FULFILL_ENGINE_*` |

3. `vercel.json` schedules `/api/cron/jobs` daily (Hobby plans allow daily crons; increase the frequency on Pro). The endpoint recovers stale jobs and drains the queue. Most jobs run inline when they are requested.
4. Function duration: app routes export `maxDuration = 300` so real model calls can finish inside Server Actions. Keep Fluid compute enabled.
5. Uploads and CSV imports are capped at 4 MB, under Vercel's 4.5 MB request-body limit.

## 3. First run

1. Sign up at `https://<domain>/signup` and create the workspace (optionally loading the PL-0001 demo data).
2. Owner-only: add real AI and research keys (as env vars, or Settings → AI provider → workspace credential, then approve the credential gate).
3. Review Settings → Workspace (daily AI budget, max candidates, research depth) and Settings → Decision rules & pricing.

## Checks before going live

- `npm run lint && npm run typecheck && npm test && npm run build`
- Supabase advisors are clean. RLS is on for every table: `select tablename from pg_tables where schemaname='public' and not rowsecurity;` returns nothing.
- No `NEXT_PUBLIC_` variable holds a secret.
