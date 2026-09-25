# Integrations

Every external capability sits behind an interface in `src/providers/`. Adapters without credentials either fall back to an honest manual workflow or fail with `ProviderNotConfiguredError`, which the UI shows as **"Requires provider connection."** No adapter fakes data or guesses undocumented APIs.

## AI (`providers/ai`)

`AIProvider` exposes `generateStructured()` and `generateText()`. The agent runtime adds schema validation, retries, usage and cost accounting on top (`agents/runtime/structured.ts`), and the handlers cover the conceptual operations `runAgent`, `generateStructuredObject`, `generateText`, `generateImagePrompt` (Creative Director prompts) and `analyzeResearch` (the Scout).

| Provider | Config |
|---|---|
| `demo` (default) | No calls. Deterministic, schema-valid placeholders labelled DEMO. |
| `openai_compatible` | `AI_API_KEY`, `AI_BASE_URL`, `AI_DEFAULT_MODEL`, `AI_RESPONSE_FORMAT` (`json_schema` or `json_object`), `AI_MAX_TOKENS_PARAM` (`max_tokens` default or `max_completion_tokens`). Works with OpenAI, OpenRouter, Together, Groq, vLLM/Ollama gateways and Anthropic's OpenAI-compatible endpoint. Retries 429 and 5xx responses with backoff; 180 s timeout. |

Resolution order: agent override (Settings → Agents) → workspace (Settings → AI provider) → environment. The API key can be an owner-approved encrypted workspace credential or `AI_API_KEY`. Per-agent model env overrides: `AI_MODEL_<AGENT_KEY>`.

## Web research (`providers/research`)

`ResearchProvider.search(query, { maxResults })` returns documents with URL, title, snippet, publisher, published date and retrieval time. The `tavily` adapter is `RESEARCH_PROVIDER=tavily` with `RESEARCH_API_KEY`. With `none`, agents are told no sources exist and all findings are labelled model knowledge or assumptions. Add marketplace, Reddit, trends or social APIs as further `ResearchProvider` implementations; only use APIs whose terms permit it (no scraping).

## Image generation (`providers/image`)

`IMAGE_PROVIDER=openai_compatible` with `IMAGE_API_KEY` and `IMAGE_MODEL` (default `gpt-image-1`) generates artwork or mockups from the stored prompts and saves PNGs to Storage as `design_assets`. Otherwise the Design Studio shows the manual upload workflow. Generation is rate limited to 20 per hour per user.

## Domains and handles (`providers/domains`)

`DOMAIN_RDAP_ENABLED=true` checks registrations through public RDAP (`rdap.org`). A 404 is reported as *likely available*, never as guaranteed. Social handle availability has no reliable public API, so handles are stored as *unverified* with direct profile links for manual checks. Trademark research links (USPTO, WIPO, EUIPO) are provided. POD Lab never claims clearance.

## Fulfillment (`providers/fulfillment`)

`FulfillmentProviderAdapter`: `listProducts`, `getProduct`, `getVariants`, `getPricing`, `createOrder`, `getOrder`, `getFulfillmentStatus`.

| Adapter | Status |
|---|---|
| `manual` / `csv` (`CatalogAdapter`) | Catalog from the database (manual entry or CSV import). Cannot place orders. |
| `mock` (`MockFulfillmentAdapter`) | Demo catalog with **illustrative placeholder costs**. Orders are simulated and flagged `simulated: true`. |
| `fulfill_engine` (`FulfillEngineAdapter`) | Placeholder. Every method raises "Requires provider connection" until the official API is documented. See [fulfill-engine-plan.md](fulfill-engine-plan.md). |

Domain logic (Product & Profit, finance, store builder) depends only on catalog rows and the adapter types. It never depends on a specific provider.

## Commerce / storefronts (`providers/commerce`)

`StoreAdapter` consumes the portable `StorePackage` built by `server/services/exports.ts`.

| Adapter | Offline export | Remote publish |
|---|---|---|
| Internal preview | Rendered in-app | not applicable |
| Generic JSON | Full brand and store package | not applicable |
| Next.js | Route manifest (pages, collections, products) | not applicable |
| Shopify | Product CSV (Admin → Products → Import, as drafts) | Admin GraphQL `productCreate` + `productVariantsBulkCreate` as **DRAFT**. Requires `SHOPIFY_STORE_DOMAIN` + `SHOPIFY_ADMIN_ACCESS_TOKEN`, launch approval and the admin role. |
| Fulfill Engine | Product → provider SKU mapping JSON | Requires provider connection |

Exports are also saved to Storage under `<workspace>/<brand>/exports/`.

## Adding a provider

1. Implement the interface in `src/providers/<kind>/` (for example `class MyResearchProvider implements ResearchProvider`). Throw `ProviderNotConfiguredError` when credentials are missing and `ProviderTransientError` for retryable failures (429, 5xx, timeouts). Use `fetchWithTimeout`.
2. Add server-only env vars to `lib/env.ts` and `.env.example`. Never use `NEXT_PUBLIC_` for secrets.
3. Wire it into the factory (`getResearchProvider`, `getImageProvider`, `getAIProvider`, or the store adapter map in `app/api/stores/[id]/export/route.ts`).
4. If credentials should be storable per workspace, read the active `provider_credentials` row (decrypted server-side) the way `runner.ts` does for AI and research keys.
5. Surface its status in Settings → Providers or AI, and add unit tests with a stubbed `fetch`.
