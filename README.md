# POD Lab

An AI-powered print-on-demand brand discovery, research, design, launch, testing and scaling operating system.

**Research → Validate → Brand → Design → Products → Store → Launch → Test → Analyze → Kill / Iterate / Clone / Scale**

POD Lab runs a portfolio of niche POD brands as a repeatable experimentation engine. Ten specialist agents, coordinated by a Director, produce **Zod-validated structured output** that is stored as permanent relational records. Humans approve every important transition. Deterministic rules, not model opinion, decide unit economics and experiment outcomes.

| Stage question | Agent |
|---|---|
| Is this market worth testing? | Opportunity Scout |
| What brand could own this niche? | Brand Architect |
| What would the audience actually want to wear or buy? | Creative Director |
| Is it safe enough to put in front of a human for production approval? | IP / Compliance |
| Can we sell it profitably? | Product & Profit |
| Can we present it credibly enough to convert? | Store Builder |
| How do we reach the right buyers? | Growth Agent |
| What is emerging that we should look at? | Trend Watcher |
| Did the market actually validate our hypothesis? | Experiment Analyst |
| What should we do next? | POD Lab Director |

## Stack

Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19, TypeScript (strict, `noUncheckedIndexedAccess`), Tailwind CSS v4, Supabase (Postgres, Auth, Storage, RLS), Zod 4, Vitest, Playwright. It deploys to Vercel.

## Quick start (local)

Prerequisites: Node 20.9+, Docker (for the local Supabase stack).

```bash
npm install
npm run db:start            # local Supabase (Postgres, Auth, REST, Storage)
npm run db:reset            # apply migrations in supabase/migrations
cp .env.example .env.local  # fill in the values printed by `npx supabase status`
npm run seed                # DEMO data: PL-0001 AI / Superintelligence (researching)
npm run demo:walkthrough    # optional: run PL-0001 through the whole pipeline (demo provider)
npm run dev                 # http://localhost:3000
```

Sign in as `demo@podlab.local` with password `podlab-demo-password` (override with `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`). You can also sign up. Onboarding creates a workspace and can load the same demo data.

> If Docker Hub is reachable but `public.ecr.aws` is not, prefix Supabase CLI commands with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`.

### AI configuration

By default `AI_PROVIDER=demo`, a deterministic provider that makes **no model calls and no web research**. Everything it creates is labelled **DEMO**, and every claim it makes is labelled as an assumption. To use a real model:

```bash
AI_PROVIDER=openai_compatible
AI_API_KEY=...                      # server-only
AI_BASE_URL=https://api.openai.com/v1   # or any Chat Completions-compatible endpoint
AI_DEFAULT_MODEL=gpt-4.1-mini
RESEARCH_PROVIDER=tavily            # optional live web research with source URLs
RESEARCH_API_KEY=...
```

You can override the model per agent (`AI_MODEL_OPPORTUNITY_SCOUT=…`), and per workspace or per agent in **Settings**. See [docs/integrations.md](docs/integrations.md).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint (zero warnings) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (pure domain + runtime) |
| `npm run test:integration` | Integration tests against local Supabase (skipped if it isn't running) |
| `npm run test:e2e` | Playwright smoke tests (run `npm run build` first) |
| `npm run db:reset` / `db:types` / `db:lint` | Migrations, generated types, schema lint |
| `npm run seed` / `demo:walkthrough` | Demo data / full PL-0001 workflow |

## Documentation

- [Architecture](docs/architecture.md): layers, request flow, agent runtime
- [Agents](docs/agents.md): every agent, schemas, prompts, how to add one
- [Database](docs/database.md): schema, RLS, guards, IDs, migrations, seeding
- [Workflows](docs/workflows.md): lifecycle, approval gates, the end-to-end flow
- [Integrations](docs/integrations.md): AI, research, image, domains, Shopify, fulfillment, how to add a provider
- [Fulfill Engine plan](docs/fulfill-engine-plan.md)
- [Deployment](docs/deployment.md): Supabase and Vercel
- [Testing](docs/testing.md)
- [Security](docs/security.md)
- [Roadmap](docs/roadmap.md)

## Principles

- **Never fabricate evidence.** Models can only cite numbered sources that were actually retrieved. Uncited "facts" are downgraded to assumptions, and confidence is capped by the evidence.
- **Humans decide.** Opportunities, final names and identity, production designs, compliance overrides, assortments, launches, paid spend, scaling, credentials and destructive actions all go through approval gates. Database triggers block anyone, including the service role, from setting approved states outside a gate.
- **No fake functionality.** Capabilities that need credentials say **"Requires provider connection."**
- **Gross and contribution profit are not net income.** Fixed overhead is out of scope.
