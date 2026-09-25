# Agents

Every agent has four parts:

1. **Definition** in `src/agents/registry.ts`: key, name, business question, phase, schema version, output type, default temperature and max tokens.
2. **Prompt** in `src/agents/prompts/registry.ts`: a versioned `PromptDefinition` (`<key>_v<n>`). Shared rules (never fabricate evidence, cite only provided sources, no legal claims, no automatic spend) are prepended to every system prompt. `ACTIVE_PROMPT_VERSION` selects the version, and each run stores the version it used.
3. **Schemas** in `src/agents/schemas/`: the payload schema (validated before enqueueing and again when the job runs) and the output schema (validated after every model response).
4. **Handler** in `src/agents/handlers/`: `prepare()` builds the prompt input, retrieves sources and supplies the demo generator. `persist()` writes records, creates approval gates and notifications, moves stages (non-gated only) and returns follow-ups.

| Agent | Payload | Output → records | Gates / follow-ups |
|---|---|---|---|
| **Director** | `period` | Briefing (headline, priorities, brands needing attention, revisit candidates, risks) → `agent_outputs` | none |
| **Opportunity Scout** | prompt, mission type (discover / investigate / revisit), max candidates, depth, brand/opportunity | `opportunities`, 10 × `opportunity_scores`, `research_reports` (full snapshot incl. research dimensions), `research_sources` (claims tagged fact / signal / inference / assumption) | `opportunity_approval` for brand-linked research; duplicates skipped by niche key |
| **Brand Architect** | brand, name count, notes | `brand_names` (risks, TM notes marked PRELIMINARY), `domains` (RDAP when enabled, else unverified), `social_handles` (unverified), versioned `brand_identity` | `brand_identity_final`; name finalisation via `brand_name_final` |
| **Creative Director** | brand, mode (full / derivatives), parent design, count | 3 visual directions (on the final identity), `collections`, `design_concepts` (full production briefs, generation and mockup prompts), `design_revisions` | Follow-up: IP / Compliance on new designs |
| **IP / Compliance** | brand, design ids | Rule screening (`domain/compliance-rules.ts`) plus optional model second pass → `compliance_reviews`, `compliance_issues` | `compliance_override` (admin) for flags |
| **Product & Profit** | brand, max products, target CAC | Selections are validated against real design codes and catalog SKUs. Economics and recommendations are computed deterministically (`domain/finance.ts`) → `brand_products`, `bundles` | `product_assortment`; avoided products are rejected with a margin notification |
| **Store Builder** | brand | `stores` (theme from identity), 9 `store_pages` (privacy/terms flagged as placeholders), `store_collections`, `store_products` (copy, SEO, upsells, cross-sells) | `store_launch` (admin) |
| **Growth Agent** | brand, focus | Launch `campaign`, 30-day calendar and other `content_items`, paid proposals (`campaigns.is_paid`), draft `experiments` with variants | `paid_campaign_spend` (admin) per paid proposal |
| **Trend Watcher** | focus, max trends | `trends` + `research_sources` (velocity forced to "unknown" without live sources) | "Send to Scout" creates a mission |
| **Experiment Analyst** | brand or experiment ids | The decision engine (`domain/decision-engine.ts`) classifies each experiment. The model only narrates → `experiments.decision*`, `insights` (never causal) | `scale_approval` (admin) when the result is *scale*; threshold notifications |

## Structured output and validation

`generateValidated()` (`agents/runtime/structured.ts`):

- Sends the JSON Schema derived from the Zod schema (`response_format: json_schema`, or `json_object` with the schema in the prompt).
- Extracts JSON (it tolerates fences and prose), validates it with Zod, and on failure retries up to twice, feeding the exact issue paths back to the model.
- Returns `ok: false` after the retries run out. The runner records the failed run with its validation errors and **discards the malformed output**.
- The demo provider goes through exactly the same validation.

## Evidence rules (Scout, Trend Watcher)

Models receive retrieved documents as `S1…Sn` and can only reference those refs. They cannot emit URLs. `normalizeEvidence()` maps refs back to the retrieved URL and publisher and the published and retrieved dates. Any `measured_fact` or `observed_signal` without a valid ref becomes an **assumption** marked "unverified", and a database check constraint rejects facts or signals without a URL. Final confidence is `min(model claim, evidence ceiling)`. Without live sources the ceiling is **low**.

## Cost controls

- Per run: model selection (agent → workspace → env), estimated tokens, actual usage when the provider returns it, estimated cost (`AI_PRICE_*_PER_MTOK`).
- Before each run: agent enabled, `daily_run_limit`, `daily_cost_limit_usd`, workspace `daily_ai_budget_usd`.
- Research: `max_research_depth` and `max_candidates` cap mission size. Per-user rate limit of 30 agent runs per hour.

## Adding an agent

1. Add the key to `AgentKey` in `domain/lifecycle.ts` and a definition to `agents/registry.ts`.
2. Add payload and output schemas in `agents/schemas/<agent>.ts` and export them from `schemas/index.ts`.
3. Register a prompt `<key>_v1` in `agents/prompts/registry.ts` and set `ACTIVE_PROMPT_VERSION`.
4. Write `agents/handlers/<agent>.ts` implementing `AgentHandler` (include a deterministic, schema-valid demo generator) and register it in `handlers/index.ts`.
5. Add a default payload in `server/services/agent-defaults.ts`. If the agent is stage-driven, add it to `recommendedActions()`.
6. Add tests. The unit suite verifies that every agent has a handler, an active prompt and a valid default payload. Add a demo-generator schema test and an integration workflow test.
7. Existing workspaces receive the agent row through `ensureWorkspaceDefaults` (Settings → Workspace → *Verify workspace defaults*).

## Versioning prompts

Add `<key>_v2` next to v1 and switch `ACTIVE_PROMPT_VERSION`. Runs keep the version they used (`agent_runs.prompt_version`), and schema versions are recorded too (`schema_version`), so you can compare outcomes across versions.
