# Roadmap

The whole architecture is built now. Phases describe which capabilities become fully *live* as providers are connected.

| Phase | Scope | Status |
|---|---|---|
| 1 | Director, Opportunity Scout, Brand Architect | **Built.** Live with an AI key; add `RESEARCH_PROVIDER` for sourced research. |
| 2 | Creative Director, IP / Compliance, Product & Profit | **Built.** Image generation needs `IMAGE_PROVIDER`; catalog via CSV, manual or demo until Fulfill Engine. |
| 3 | Store Builder, storefront preview, exports | **Built.** Preview and all offline exports work today. |
| 4 | Growth Agent, experiments, analytics, Trend Watcher | **Built.** Metrics arrive by CSV or manual entry; ad-platform connectors are future work. |
| 5 | Fulfill Engine, Shopify, automation | **Prepared.** Shopify CSV and draft publishing via the Admin API when configured; Fulfill Engine adapter awaiting API docs ([plan](fulfill-engine-plan.md)). |

## Next

- Connect a real AI key and a research provider, then re-run the Scout on PL-0001 (Director "revisit" flags all demo research).
- Fulfill Engine catalog sync and order placement (human-approved).
- Analytics connectors (Shopify orders, ad platforms, GA4) that write `orders_import` and `experiment_metrics` automatically.
- Email delivery for notifications (for example Resend) and digest emails from the Director briefing.
- Workspace invitations by email for people without accounts.
- Realtime job status (Supabase Realtime) instead of refresh-on-completion.
- Prompt A/B comparison dashboards using `agent_runs.prompt_version`.
