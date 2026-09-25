import { priceForGrossMargin, type FeeModel } from "@/domain/finance";
import type { ProductOutput } from "../schemas";

interface CatalogItem {
  provider_sku: string;
  blank_name: string;
  product_type: string;
  decoration_method: string;
  blank_cost: number;
  decoration_cost: number;
  fulfillment_fee: number;
  shipping_estimate_domestic: number | null;
}

export function demoProduct(input: {
  designs: Array<{ code: string; title: string; preferred_products: string[]; printing_method: string | null }>;
  catalog: CatalogItem[];
  fee_model: FeeModel;
  max_products: number;
}): ProductOutput {
  const selections: ProductOutput["selections"] = [];
  const used = new Set<string>();
  for (const d of input.designs) {
    for (const pref of d.preferred_products.length ? d.preferred_products : ["tee"]) {
      if (selections.length >= input.max_products) break;
      const embroidered = (d.printing_method ?? "").includes("embroidery");
      const candidates = input.catalog.filter((c) => c.product_type === pref);
      const item =
        candidates.find((c) => (embroidered ? c.decoration_method.includes("embroidery") : !c.decoration_method.includes("embroidery"))) ?? candidates[0];
      if (!item || used.has(`${d.code}:${item.provider_sku}`)) continue;
      used.add(`${d.code}:${item.provider_sku}`);
      const price = priceForGrossMargin(
        { blankCost: item.blank_cost, decorationCost: item.decoration_cost, fulfillmentFee: item.fulfillment_fee, shippingCost: item.shipping_estimate_domestic ?? 0 },
        input.fee_model,
        0.55,
      );
      selections.push({
        design_code: d.code,
        provider_sku: item.provider_sku,
        title: `${d.title} ${item.blank_name.replace(/\s*\(demo\)$/i, "")}`.slice(0, 150),
        retail_price: price,
        compare_at_price: null,
        rationale: `Demo selection: first preferred product type (${pref}) with a compatible decoration method; priced for ~55% gross margin.`,
      });
      break;
    }
    if (selections.length >= input.max_products) break;
  }
  if (selections.length === 0 && input.catalog[0] && input.designs[0]) {
    const item = input.catalog[0];
    selections.push({ design_code: input.designs[0].code, provider_sku: item.provider_sku, title: `${input.designs[0].title} ${item.blank_name}`.slice(0, 150), retail_price: 34.99, compare_at_price: null, rationale: "Demo fallback selection." });
  }
  return {
    selections,
    bundles: selections.length >= 2 ? [{ name: "Starter pair", description: "Any two pieces at 10% off (demo bundle).", selection_indexes: [0, 1], discount_pct: 0.1 }] : [],
    pricing_notes: "Demo pricing: charm prices targeting ~55% gross margin on placeholder costs. Economics are recomputed deterministically by POD Lab.",
  };
}
