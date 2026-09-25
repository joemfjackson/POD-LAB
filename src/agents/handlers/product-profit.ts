import { recommendProduct } from "@/domain/finance";
import { uniqueSlug } from "@/domain/slug";
import type { Json } from "@/lib/supabase/database.types";
import { demoProduct } from "../demo/product";
import { agentMoveBrand, check, createGate, logAgentActivity, must, notify } from "../runtime/db-helpers";
import type { AgentHandler } from "../runtime/types";
import { productOutputSchema, productPayloadSchema, type ProductOutput, type ProductPayload } from "../schemas";
import { costsOf, loadPricingModel, toFeeModel } from "./pricing-model";

export const productProfitHandler: AgentHandler<ProductPayload, ProductOutput> = {
  key: "product_profit",
  payloadSchema: productPayloadSchema,
  outputSchema: productOutputSchema,

  async prepare(ctx, payload) {
    const { db, workspace } = ctx;
    const brand = must(await db.from("brands").select("id, code, working_title, official_name, niche, audience, positioning").eq("id", payload.brand_id).eq("workspace_id", workspace.id).single(), "load brand");
    const designs = must(
      await db.from("design_concepts").select("id, code, title, preferred_products, printing_method, status, compliance_status, collections(name)").eq("brand_id", brand.id).in("status", ["approved", "production_ready"]),
      "load designs",
    );
    if (designs.length === 0) throw new Error("No approved designs yet. Approve designs for production before running Product & Profit.");
    const catalog = must(
      await db.from("provider_products").select("provider_sku, blank_name, product_type, decoration_method, blank_cost, decoration_cost, fulfillment_fee, shipping_estimate_domestic, production_sla_days, available_colors, available_sizes").eq("workspace_id", workspace.id).eq("active", true).limit(300),
      "load catalog",
    );
    if (catalog.length === 0) throw new Error("The product catalog is empty. Import a catalog CSV, add products manually, or load the mock catalog in Products.");
    const pricingRow = await loadPricingModel(db, workspace.id, brand.id);
    const feeModel = toFeeModel(pricingRow);
    const cac = payload.target_cac ?? feeModel.targetCac;
    const numericCatalog = catalog.map((c) => ({
      ...c,
      blank_cost: Number(c.blank_cost),
      decoration_cost: Number(c.decoration_cost),
      fulfillment_fee: Number(c.fulfillment_fee),
      shipping_estimate_domestic: c.shipping_estimate_domestic === null ? null : Number(c.shipping_estimate_domestic),
    }));
    const input = {
      brand: { code: brand.code, name: brand.official_name ?? brand.working_title, niche: brand.niche, audience: brand.audience, positioning: brand.positioning },
      designs: designs.map((d) => ({ code: d.code, title: d.title, preferred_products: d.preferred_products, printing_method: d.printing_method, collection: d.collections?.name ?? null, compliance: d.compliance_status })),
      catalog: numericCatalog,
      fee_model: feeModel,
      target_cac: cac,
      max_products: payload.max_products,
    };
    return {
      input,
      demo: () => demoProduct({ designs: input.designs, catalog: numericCatalog, fee_model: feeModel, max_products: payload.max_products }),
      sources: [],
      researchMode: ctx.demoMode ? "demo" : "model_only",
      brandId: brand.id,
    };
  },

  async persist(ctx, payload, out) {
    const { db, workspace, job } = ctx;
    const brandId = payload.brand_id;
    const pricingRow = await loadPricingModel(db, workspace.id, brandId);
    const feeModel = toFeeModel(pricingRow);
    const cac = payload.target_cac ?? feeModel.targetCac;
    const designs = must(await db.from("design_concepts").select("id, code, collection_id").eq("brand_id", brandId), "load designs");
    const designByCode = new Map(designs.map((d) => [d.code, d]));
    const catalog = must(await db.from("provider_products").select("*").eq("workspace_id", workspace.id).eq("active", true), "load catalog");
    const productBySku = new Map(catalog.map((p) => [p.provider_sku, p]));
    const takenSlugs = new Set(must(await db.from("brand_products").select("slug").eq("brand_id", brandId), "load slugs").map((r) => r.slug));

    const created: Array<{ id: string; recommendation: string }> = [];
    const skipped: string[] = [];
    for (const sel of out.selections.slice(0, payload.max_products)) {
      const design = designByCode.get(sel.design_code);
      const product = productBySku.get(sel.provider_sku);
      if (!design || !product) {
        skipped.push(`${sel.design_code}/${sel.provider_sku}`);
        created.push({ id: "", recommendation: "skipped" });
        continue;
      }
      const costs = costsOf(product);
      const rec = recommendProduct(costs, sel.retail_price, feeModel, { cac });
      const slug = uniqueSlug(sel.title, takenSlugs);
      takenSlugs.add(slug);
      const avoid = rec.recommendation === "avoid";
      const row = must(
        await db
          .from("brand_products")
          .insert({
            workspace_id: workspace.id,
            brand_id: brandId,
            provider_product_id: product.id,
            design_id: design.id,
            collection_id: design.collection_id,
            pricing_model_id: pricingRow?.id ?? null,
            title: sel.title,
            slug,
            description: sel.rationale,
            status: avoid ? "rejected" : "pending_approval",
            retail_price: sel.retail_price,
            compare_at_price: sel.compare_at_price,
            recommendation: rec.recommendation,
            recommendation_reason: rec.reasons.join(" "),
            economics: { unit: rec.economics, bundle_of_two: rec.bundleOfTwo, suggested_price: rec.suggestedPrice, cac, fee_model: feeModel, computed_at: ctx.now.toISOString() } as unknown as Json,
            is_demo: ctx.demoMode || product.is_demo,
          })
          .select("id, code, title")
          .single(),
        "insert brand product",
      );
      created.push({ id: row.id, recommendation: rec.recommendation });
      if (avoid) {
        await logAgentActivity(db, {
          workspaceId: workspace.id,
          agentKey: "product_profit",
          action: "product.rejected",
          summary: `Product Agent rejected ${product.product_type} "${row.title}" due to margin: ${rec.reasons[0] ?? ""}`,
          brandId,
          subjectType: "brand_product",
          subjectId: row.id,
        });
        await notify(db, {
          workspaceId: workspace.id,
          type: "margin_problem",
          title: `Margin problem: ${row.code} ${row.title}`,
          body: rec.reasons.join(" "),
          link: `/brands/${brandId}/products`,
          brandId,
          severity: "warning",
        });
      }
    }

    for (const b of out.bundles) {
      const items = b.selection_indexes.map((i) => created[i]).filter((c): c is { id: string; recommendation: string } => Boolean(c?.id) && c?.recommendation !== "avoid");
      if (items.length < 2) continue;
      const prices = must(await db.from("brand_products").select("id, retail_price").in("id", items.map((i) => i.id)), "bundle prices");
      const total = prices.reduce((s, p) => s + Number(p.retail_price), 0);
      const bundle = must(
        await db
          .from("bundles")
          .insert({ workspace_id: workspace.id, brand_id: brandId, name: b.name, description: b.description, bundle_price: Math.round(total * (1 - b.discount_pct) * 100) / 100, status: "draft" })
          .select("id")
          .single(),
        "insert bundle",
      );
      check(await db.from("bundle_items").insert(items.map((i) => ({ workspace_id: workspace.id, bundle_id: bundle.id, brand_product_id: i.id, quantity: 1 }))), "bundle items");
    }

    await agentMoveBrand(db, { workspaceId: workspace.id, brandId, to: "product_selection", agentKey: "product_profit", reason: "Assortment proposed" });
    const approvable = created.filter((c) => c.id && c.recommendation !== "avoid" && c.recommendation !== "skipped");
    if (approvable.length) {
      await createGate(db, {
        workspaceId: workspace.id,
        gateType: "product_assortment",
        subjectType: "brand",
        subjectId: brandId,
        brandId,
        jobId: job.id,
        title: `Approve product assortment (${approvable.length} products)`,
        summary: `Recommendations: ${summarize(approvable.map((a) => a.recommendation))}. Avoided products were rejected automatically on margin.`,
        payload: { brand_product_ids: approvable.map((a) => a.id) },
      });
    }
    const rejected = created.filter((c) => c.recommendation === "avoid").length;
    return {
      summary: `Proposed ${approvable.length} product(s)${rejected ? `, rejected ${rejected} on margin` : ""}${skipped.length ? `, skipped ${skipped.length} invalid selection(s)` : ""}`,
      waitingForApproval: approvable.length > 0,
      brandId,
    };
  },
};

function summarize(recs: string[]): string {
  const counts = new Map<string, number>();
  for (const r of recs) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(", ");
}
