# Architecture

POD Lab is a single Next.js 16 application backed by Supabase. Business rules live in pure TypeScript modules. Agents are thin, typed adapters around a shared runtime. The database enforces tenancy and human-approval invariants on its own, so a bug in application code cannot bypass them.

```
src/
  app/                 Next.js routes (App Router). (auth), onboarding, (app)/… pages, api/ route handlers
  components/          UI primitives (ui/), layout, charts, storefront renderer, feature components
  domain/              PURE logic, no I/O: lifecycle, scoring, finance, decision engine, financial model,
                       CSV import, compliance rules, IDs, permissions, command parser, formatting
  agents/
    registry.ts        agent definitions (name, phase, schema version, defaults)
    prompts/           versioned prompt registry (opportunity_scout_v1, …)
    schemas/           Zod output + payload schemas per agent
    handlers/          prepare() → model input + demo generator; persist() → relational writes, gates, follow-ups
    demo/              deterministic demo generators (clearly labelled DEMO)
    runtime/           job queue, runner, structured generation + validation retries, limits, db helpers
  providers/           ai/, research/, image/, domains/, fulfillment/, commerce/ adapters + errors
  server/
    context.ts         request context: user, active workspace, role (RLS-scoped client)
    execution.ts       inline/deferred job execution (after())
    actions/           Server Actions (validated with Zod, role-checked, return ActionResult)
    services/          reusable server logic used by actions, scripts and tests
    queries/           read helpers (storefront, search, signed asset URLs)
    seed/              demo baseline + end-to-end walkthrough
  lib/                 env parsing, Supabase clients (server/browser/admin/proxy), crypto
supabase/migrations/   ordered SQL migrations (schema, RLS, triggers, RPCs, storage)
scripts/               seed, walkthrough, e2e setup (tsx)
tests/                 unit/, integration/ (local Supabase), e2e/ (Playwright)
```

## Clients and trust boundaries

| Client | Where | Permissions |
|---|---|---|
| `createSupabaseServerClient()` | Server Components, Server Actions, route handlers | The signed-in user's session. **All RLS applies.** Used for every user-initiated read and write. |
| `createSupabaseBrowserClient()` | Browser | Publishable key only. The UI uses Server Components and Server Actions, so this client is kept for future realtime features. |
| `createSupabaseAdminClient()` | Server only (`server-only`) | Service role, which bypasses RLS. Used only by the agent runner, the queue, bootstrap/seed and credential storage. Every query is explicitly scoped by `workspace_id`. |

Approval-sensitive state still can't be forged with the service role: guard triggers require the `pod_lab.gate_context` flag, which only `decide_approval_gate()` sets, and that function requires an authenticated human.

## Request flow

1. `src/proxy.ts` (Next 16 replacement for middleware) refreshes the Supabase session cookie and redirects anonymous users to `/login`.
2. `getContext()` resolves the user, their memberships and the active workspace (cookie `podlab_ws`), cached per request.
3. Pages are Server Components that query with the user client, so RLS limits every result to the user's workspaces.
4. Mutations are Server Actions. They parse input with Zod, check the role with `domain/permissions`, write through the user client, and return a typed `ActionResult` that `<ActionForm>` renders inline (`aria-live`). Next.js checks the Origin header on every Server Action (CSRF).

## Agent execution

```
UI / command bar / Director follow-up
        │ requestAgentRun() — payload validated by the agent's Zod schema, rate limited per user
        ▼
agent_jobs (queued, dedupe_key unique while queued/running)
        │ executeJob(): inline (default) or after() (deferred); cron drains the rest
        ▼
claim_agent_job() — FOR UPDATE SKIP LOCKED, attempts++
        │ checkLimits(): agent enabled, daily runs, agent daily cost, workspace daily budget
        │ handler.prepare(): load context, live research (optional), build prompt input + demo generator
        │ generateValidated(): model call → JSON extraction → Zod validation → retry with errors (max 2)
        │ agent_runs row: provider, model, temperature, prompt version, schema version, tokens, cost, duration, sources
        │ agent_outputs row: only validated output
        │ handler.persist(): relational records, approval gates, notifications, stage moves (non-gated only)
        ▼
job completed | waiting_for_approval | queued (retry with backoff) | failed (+ notification)
        │ followUps → new queued jobs (e.g. Creative Director → IP / Compliance)
```

Failures are never swallowed. Each attempt leaves a failed `agent_runs` row with the error, the validation issues and the discarded raw output. Transient failures are retried with exponential backoff. Configuration errors ("Requires provider connection") and limit breaches fail immediately with a notification.

## Director

The Director has two halves:

- **Orchestration (deterministic code):** job routing and follow-ups, approval gates, lifecycle enforcement, duplicate-research prevention (`opportunities.niche_key` is unique per workspace), revisit detection (stale or unsourced research), post-approval "ready for next stage" notifications, and the stage-aware recommended actions shown on each brand.
- **Briefing (agent):** `computeDirectorStats()` computes real numbers from the database. The Director agent turns them into priorities, brands needing attention, revisit candidates and risks. In demo mode it uses `deterministicBriefing()`, which contains no invented numbers.

The Director never spends money or launches anything. Paid spend and scaling are gates that require an admin.

## Storefront preview

`components/storefront/storefront.tsx` renders a full store (header, navigation, hero, collections, product grid, product pages with variants and upsells, FAQ, policies, email capture, footer) from stored data. Theme values are validated (`safeTheme`) before they reach inline styles. Responsiveness uses **CSS container queries** (`@container`), so the mobile preview (390px frame) reflows correctly inside the app without an iframe.

## Design system

Dark, dense, technical: near-black surfaces, one restrained electric accent (`--color-accent`), and status colours reserved for state, always paired with a text label. Tokens live in `app/globals.css`. Chart colours come from a validated categorical palette (checked for CVD separation and contrast against the app surface). Charts ship hover/focus tooltips, legends for more than one series, and a table view.
