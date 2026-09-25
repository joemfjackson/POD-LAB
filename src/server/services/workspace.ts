import { AGENT_DEFINITIONS } from "@/agents/registry";
import { check, must } from "@/agents/runtime/db-helpers";
import type { AdminClient } from "@/lib/supabase/admin";
import { MOCK_CATALOG } from "@/providers/fulfillment/mock-catalog";

/**
 * Idempotently creates the per-workspace defaults: agent configuration rows,
 * the default pricing model, default decision rules and fulfillment providers.
 */
export async function ensureWorkspaceDefaults(db: AdminClient, workspaceId: string): Promise<void> {
  check(
    await db.from("agents").upsert(
      AGENT_DEFINITIONS.map((a) => ({
        workspace_id: workspaceId,
        key: a.key,
        name: a.name,
        description: a.description,
        phase: a.phase,
        daily_run_limit: a.key === "opportunity_scout" ? 20 : 50,
        daily_cost_limit_usd: a.key === "opportunity_scout" || a.key === "creative_director" ? 5 : 2,
      })),
      { onConflict: "workspace_id,key", ignoreDuplicates: true },
    ),
    "seed agents",
  );

  const pricing = await db.from("pricing_models").select("id").eq("workspace_id", workspaceId).is("brand_id", null).eq("is_default", true).maybeSingle();
  if (!pricing.data) {
    check(
      await db.from("pricing_models").insert({
        workspace_id: workspaceId,
        name: "Default DTC pricing (editable assumptions)",
        is_default: true,
        payment_processing_pct: 0.029,
        payment_processing_fixed: 0.3,
        platform_fee_pct: 0,
        shipping_charged: 4.99,
        free_shipping_threshold: 75,
        refund_reserve_pct: 0.03,
        target_cac: 12,
        target_contribution_margin: 0.2,
        min_gross_margin: 0.45,
        quantity_discounts: [{ minQuantity: 2, percentOff: 0.1 }, { minQuantity: 3, percentOff: 0.15 }],
      }),
      "seed pricing model",
    );
  }

  const rules = await db.from("decision_rule_sets").select("id").eq("workspace_id", workspaceId).eq("is_default", true).maybeSingle();
  if (!rules.data) {
    check(await db.from("decision_rule_sets").insert({ workspace_id: workspaceId, name: "Default decision rules", is_default: true }), "seed decision rules");
  }

  check(
    await db.from("fulfillment_providers").upsert(
      [
        { workspace_id: workspaceId, key: "manual", name: "Manual catalog", adapter: "manual", status: "active", notes: "Products entered by hand." },
        { workspace_id: workspaceId, key: "csv", name: "CSV catalog import", adapter: "csv", status: "active", notes: "Products imported from CSV." },
        { workspace_id: workspaceId, key: "mock", name: "Mock catalog (demo data)", adapter: "mock", status: "active", notes: "Illustrative placeholder costs for development — not real quotes." },
        { workspace_id: workspaceId, key: "fulfill_engine", name: "Fulfill Engine", adapter: "fulfill_engine", status: "not_configured", notes: "Awaiting API access. Requires provider connection." },
      ],
      { onConflict: "workspace_id,key", ignoreDuplicates: true },
    ),
    "seed providers",
  );
}

/** Loads the DEMO mock catalog into the workspace (idempotent). */
export async function loadMockCatalog(db: AdminClient, workspaceId: string): Promise<number> {
  const provider = must(await db.from("fulfillment_providers").select("id").eq("workspace_id", workspaceId).eq("key", "mock").single(), "mock provider");
  check(
    await db.from("provider_products").upsert(
      MOCK_CATALOG.map((p) => ({
        workspace_id: workspaceId,
        provider_id: provider.id,
        provider_sku: p.providerSku,
        blank_name: p.blankName,
        blank_brand: p.blankBrand,
        product_type: p.productType,
        available_colors: p.availableColors,
        available_sizes: p.availableSizes,
        blank_cost: p.blankCost,
        decoration_method: p.decorationMethod,
        decoration_cost: p.decorationCost,
        fulfillment_fee: p.fulfillmentFee,
        shipping_estimate_domestic: p.shippingEstimateDomestic,
        shipping_estimate_international: p.shippingEstimateInternational,
        production_sla_days: p.productionSlaDays,
        product_images: p.productImages,
        inventory_mode: p.inventoryMode,
        metadata: p.metadata as never,
        source: "mock",
        is_demo: true,
      })),
      { onConflict: "provider_id,provider_sku" },
    ),
    "load mock catalog",
  );
  return MOCK_CATALOG.length;
}
