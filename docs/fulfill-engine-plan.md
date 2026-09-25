# Fulfill Engine integration plan

**Status:** waiting for API access. No credentials, endpoints or payload formats have been assumed.

## Already in place

- `FulfillEngineAdapter` (`src/providers/fulfillment/adapters.ts`) implements the full `FulfillmentProviderAdapter` interface. Every method currently raises `ProviderNotConfiguredError` ("Requires provider connection").
- The `fulfillment_providers` row `fulfill_engine` (status `not_configured`) is created for every workspace.
- Settings → Providers & credentials: non-secret config (API base URL, https only; account ID; notes) and encrypted API-key storage that needs **owner approval** before activation.
- `provider_products`, `product_variants` and `brand_products` hold everything the domain needs (SKU, blank, colours, sizes, blank and decoration cost, fulfillment fee, shipping estimates, production SLA, images, inventory mode, provider metadata JSONB).
- The fulfillment mapping export (`/api/stores/<id>/export?adapter=fulfill_engine`) lists product → provider SKU / colours / sizes / design.
- The catalog CSV importer already covers fulfillment catalogs, so Fulfill Engine exports can be imported today.

## When documentation and credentials arrive

1. Record the official base URL, auth scheme, rate limits and webhook model in this file.
2. Implement in `FulfillEngineAdapter`:
   - `listProducts` / `getProduct` / `getVariants` / `getPricing`: map the provider catalog onto `CatalogProduct`, `CatalogVariant` and `ProviderPricing`.
   - `createOrder` / `getOrder` / `getFulfillmentStatus`: map to `FulfillmentOrder` and `FulfillmentStatus` (`simulated: false`).
3. Add a catalog sync service that upserts into `provider_products` (`source = 'provider_api'`, provider ID of the `fulfill_engine` row). Run it from an admin button and optionally from cron.
4. Read the API key from the active `provider_credentials` row (`fulfillment` / `fulfill_engine`) or from `FULFILL_ENGINE_API_KEY`.
5. Mark the provider `active` once a connectivity check passes.
6. Order creation must stay a human-approved action (launch approval plus an explicit operator action). POD Lab never places orders automatically.
7. Add adapter unit tests with recorded fixtures and one integration test against a sandbox, if one is offered.

No business logic (economics, recommendations, store builder, reporting) needs to change: it only reads catalog rows and adapter types.
