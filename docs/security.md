# Security

- **Tenancy:** Supabase RLS on every table. Workspace membership and role helpers are `SECURITY DEFINER` with an empty `search_path`. Integration tests prove cross-workspace isolation and that viewers are read-only.
- **Human approval is enforced by the database**, not just the UI. Gated stage transitions and approved values require the transaction-local `pod_lab.gate_context` flag, which only `decide_approval_gate()` sets. That function refuses callers without `auth.uid()` (agents and the service role), checks the per-gate minimum role, requires reasons for rejections, and audits every decision.
- **Secrets:** the service role key, AI, research, image, Shopify and Fulfill Engine keys and the encryption key are server-only (`lib/env.ts` is `server-only`; only `NEXT_PUBLIC_SUPABASE_URL`, the publishable key and the site URL reach the browser). Workspace credentials are encrypted with AES-256-GCM (`POD_LAB_ENCRYPTION_KEY`). The table has no RLS policies, so clients cannot read it. Credentials are shown only as a hint (`••••1234`) and activated only after **owner** approval.
- **CSRF:** Server Actions are POST with Next.js Origin/Host verification. Sign-out is POST-only with an origin check. The cron endpoint requires `Authorization: Bearer $CRON_SECRET` (constant-time compare).
- **Input validation:** every Server Action and agent payload is parsed with Zod. Agent output is validated before storage, and malformed output is discarded. CSV imports validate each row and store errors. Redirect targets after login are restricted to relative paths.
- **Rate limiting:** a Postgres fixed-window limiter (`consume_rate_limit`) caps agent runs (30 per hour per user) and image generations (20 per hour). Supabase Auth rate limits apply to sign-in.
- **Uploads:** 4 MB maximum. An allow-list of MIME types (no SVG or HTML), extension-to-type matching, magic-byte verification, filename sanitisation, a private bucket, workspace-scoped storage policies and short-lived signed URLs for downloads.
- **Output safety:** React escaping everywhere. Store theme colours and fonts are validated before use in inline styles. Shopify HTML is escaped. CSV exports neutralise spreadsheet formula injection. External links use `rel="noopener noreferrer nofollow"`.
- **Headers:** `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`, `nosniff`, a strict referrer policy and a restrictive permissions policy. The `X-Powered-By` header is removed.
- **Cost and abuse controls:** per-agent daily run and cost limits, a workspace daily AI budget, and caps on max candidates and research depth.
- **Audit:** `audit_log` records human, agent and system actions: approvals, stage changes, decisions, imports, uploads and deletions, settings and credential changes, agent completions and failures.
- **Legal:** compliance screening and trademark notes are labelled as preliminary and not legal advice.

Run the Supabase security advisors after applying migrations to a hosted project (see [deployment.md](deployment.md)).
