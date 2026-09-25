# Database

Postgres on Supabase, defined entirely by ordered migrations in `supabase/migrations/`:

| Migration | Contents |
|---|---|
| `…0100_core.sql` | Extensions, core enums, `set_updated_at`, `users` (mirror of `auth.users` via trigger), `workspaces` (cost controls, AI defaults), `workspace_members` (roles), role helpers, **human-readable IDs**, `audit_log`, `notifications`, `files`, `notes`, rate limiting |
| `…0200_research_brands.sql` | `research_missions`, `opportunities` (unique `niche_key` per workspace), `opportunity_scores`, `research_reports`, `research_sources` (claim + evidence kind + source metadata; facts/signals require a URL), `brands`, `brand_stage_history`, `brand_decisions`, **lifecycle state machine trigger** |
| `…0300_agents_jobs_approvals.sql` | `agents` (per-workspace config), `agent_jobs` (durable queue, dedupe index, `claim_agent_job`, `recover_stale_agent_jobs`), `agent_runs`, `agent_outputs`, `approval_gates`, `approval_comments`, `gate_min_role`, `provider_credentials` |
| `…0400_identity_creative_compliance.sql` | `brand_names`, `domains`, `social_handles`, versioned `brand_identity`, `collections`, `design_concepts`, `design_assets`, `design_revisions`, `compliance_reviews`, `compliance_issues` |
| `…0500_products_stores.sql` | `fulfillment_providers`, `provider_products`, `product_variants`, `pricing_models`, `brand_products`, `bundles`, `bundle_items`, `stores`, `store_pages`, `store_collections`, `store_products` |
| `…0600_growth_experiments_finance.sql` | `campaigns`, `content_items`, `decision_rule_sets`, `experiments`, `experiment_variants`, `experiment_metrics`, `import_batches`, `orders_import`, `financial_metrics`, `trends`, `trend_opportunities`, `insights` |
| `…0700_security_rpc.sql` | RLS for every table, gated-value guard triggers, `decide_approval_gate()`, `create_workspace()`, `search_workspace()`, storage bucket and policies |

All primary keys are UUIDs. Every table has `created_at` and `updated_at` (maintained by triggers), and every workspace-owned row carries `workspace_id` with an FK and cascade. Status fields use enums or check constraints. JSONB is used only for flexible payloads: agent output snapshots, provider metadata, store page sections, strategy blobs and pricing tiers.

## Human-readable IDs

`id_counters(workspace_id, prefix)` plus `next_code()` (an atomic upsert) plus a `BEFORE INSERT` trigger `assign_code('<PREFIX>')`. Codes are per workspace: `PL-0001` brands, `OPP` opportunities, `MIS` missions, `DES` designs, `EXP` experiments, `PRD` brand products, `STR` stores, `CMP` campaigns, `JOB` jobs, `APR` approvals, `TRD` trends, `INS` insights. `format_code()` pads to four digits and never truncates (`PL-12345`). The TypeScript mirror is `domain/ids.ts`.

## Multi-tenancy and RLS

- `has_workspace_role(ws, min_role)` and `is_workspace_member(ws)` are `SECURITY DEFINER`, `search_path=''` helpers.
- Standard tables: members read, editors insert/update, admins delete.
- Configuration tables (`agents`, `fulfillment_providers`, `pricing_models`, `decision_rule_sets`): admins write.
- Append-only: `audit_log` and `brand_stage_history` (human inserts must be attributed to `auth.uid()`).
- `agent_runs` and `agent_outputs` are read-only to users. Jobs can be inserted by editors (queued only), and execution state is written by the server.
- `approval_gates`: editors may request. **Decisions only through `decide_approval_gate()`.**
- `provider_credentials`, `id_counters` and `rate_limits` have **no policies**, so they are unreachable from clients.
- Storage bucket `pod-lab` is private. Objects are namespaced `<workspace_id>/<brand|workspace>/<kind>s/<uuid>-<name>`, and policies check membership from the first path segment.

## Invariants enforced in the database

| Invariant | Mechanism |
|---|---|
| Valid lifecycle transitions only; paused brands resume to their previous stage | `enforce_brand_stage_transition` trigger + `brand_stage_transition_kind()` (kept identical to `domain/lifecycle.ts` by an integration test over all 225 stage pairs) |
| Gated transitions (candidate→approved, branding→creative, product_selection→store_build, store_build→launch_ready, →scaling) | Trigger requires `pod_lab.gate_context`, which only `decide_approval_gate()` sets |
| Approved states (opportunity approved, name final, identity final, product approved, store launch_approved, design approved/production_ready, compliance overridden, credential active) | `guard_gated_value` / `guard_design_status` triggers, which apply even to the service role |
| Paid campaigns cannot be approved or activated, or have budgets changed, without a gate | `guard_campaign_spend` + check constraint |
| Production-ready designs need clear or overridden compliance | `enforce_design_production_compliance` |
| Validated insights must link an experiment; experiment overrides need a reason | Check constraints |
| One pending gate per subject and type; one active job per dedupe key; one final name / identity per brand | Partial unique indexes |

`decide_approval_gate(gate, decision, reason)` checks that the caller is an authenticated human with the gate type's minimum role (owner for credentials; admin for launch, spend, scale, compliance override and destructive actions; editor otherwise). It requires a reason for rejections and revision requests, and it applies every side effect in one transaction, including creating the Brand Record for an approved opportunity. It also writes the audit entry.

## Migrations and types

```bash
npm run db:reset     # local: drop and re-apply all migrations (then seed.sql, which is empty)
npm run db:lint      # plpgsql lint (supabase db lint)
npm run db:types     # regenerate src/lib/supabase/database.types.ts
npx supabase db push # apply pending migrations to a linked remote project
```

Never change a deployed schema outside migrations. Add a new timestamped file instead of editing an applied one.

## Seeding

Demo data is separate from migrations:

- `npm run seed` creates the demo user and workspace and loads the **baseline**: PL-0001 *AI / Superintelligence* at `researching` with name hypotheses (RECURSIVE, BEYOND GENERAL, T-ZERO, SYNTH, POSTHUMAN, SUPERINTEL), eight collection concepts, the eight sample design concepts, a demo-labelled sample research report, the mock catalog, a sample trend and a sample insight.
- `npm run demo:walkthrough` runs the full pipeline on PL-0001 (see [workflows.md](workflows.md)).
- Onboarding's "Load demo data" checkbox loads the baseline into a new workspace.

Every demo row has `is_demo = true` and is shown with a **DEMO** badge.
