"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { costsOf, loadPricingModel, toFeeModel } from "@/agents/handlers/pricing-model";
import { recommendProduct } from "@/domain/finance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { requireContext } from "../context";
import { UserFacingError, describeDbError } from "../services/errors";
import { loadMockCatalog } from "../services/workspace";
import { toActionError, type ActionResult } from "./result";

const PRODUCT_TYPES = ["tee", "long_sleeve", "hoodie", "crewneck", "hat", "beanie", "tote", "mug", "poster", "sticker", "phone_case", "jacket", "shorts", "other"] as const;
const money = z.coerce.number().min(0).max(10000);
const list = z.string().transform((v) => v.split(/[|,]/).map((s) => s.trim()).filter(Boolean).slice(0, 40));

export async function createCatalogProductAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const input = z
      .object({
        provider_sku: z.string().trim().min(1, "SKU is required").max(120),
        blank_name: z.string().trim().min(1, "Name is required").max(200),
        blank_brand: z.string().trim().max(120),
        product_type: z.enum(PRODUCT_TYPES),
        available_colors: list,
        available_sizes: list,
        blank_cost: money,
        decoration_method: z.string().trim().min(1).max(60),
        decoration_cost: money,
        fulfillment_fee: money,
        shipping_estimate_domestic: money,
        production_sla_days: z.coerce.number().int().min(0).max(90),
      })
      .parse(Object.fromEntries(["provider_sku", "blank_name", "blank_brand", "product_type", "available_colors", "available_sizes", "blank_cost", "decoration_method", "decoration_cost", "fulfillment_fee", "shipping_estimate_domestic", "production_sla_days"].map((k) => [k, fd.get(k) ?? ""])));
    const provider = await ctx.db.from("fulfillment_providers").select("id").eq("workspace_id", ctx.workspace.id).eq("key", "manual").single();
    if (provider.error) throw new UserFacingError("Manual provider missing — open Settings to repair workspace defaults.");
    const res = await ctx.db.from("provider_products").insert({ ...input, blank_brand: input.blank_brand || null, workspace_id: ctx.workspace.id, provider_id: provider.data.id, source: "manual" });
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not add the product."));
    revalidatePath("/products");
    return { ok: true, message: `Added ${input.blank_name}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function loadMockCatalogAction(): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const n = await loadMockCatalog(createSupabaseAdminClient(), ctx.workspace.id);
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "catalog.mock_loaded", summary: `${ctx.user.displayName} loaded the demo mock catalog (${n} products)` });
    revalidatePath("/products");
    return { ok: true, message: `Loaded ${n} demo catalog products (illustrative costs, labelled DEMO).` };
  } catch (e) {
    return toActionError(e);
  }
}

/** Re-prices a brand product and recomputes its deterministic unit economics. */
export async function repriceProductAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("product_id"));
    const price = z.coerce.number().positive().max(10000).parse(fd.get("retail_price"));
    const compare = fd.get("compare_at_price") ? z.coerce.number().positive().max(20000).parse(fd.get("compare_at_price")) : null;
    const cac = fd.get("cac") ? z.coerce.number().min(0).max(1000).parse(fd.get("cac")) : undefined;
    const bp = await ctx.db.from("brand_products").select("id, brand_id, status, provider_products(blank_cost, decoration_cost, fulfillment_fee, shipping_estimate_domestic)").eq("id", id).single();
    if (bp.error || !bp.data.provider_products) throw new UserFacingError("Product not found.");
    const pricing = await loadPricingModel(createSupabaseAdminClient(), ctx.workspace.id, bp.data.brand_id);
    const model = toFeeModel(pricing);
    const rec = recommendProduct(costsOf(bp.data.provider_products), price, model, { cac });
    // Price changes on approved products send them back through assortment approval.
    const status = bp.data.status === "approved" ? "candidate" : bp.data.status;
    const res = await ctx.db
      .from("brand_products")
      .update({
        retail_price: price,
        compare_at_price: compare,
        recommendation: rec.recommendation,
        recommendation_reason: rec.reasons.join(" "),
        status: status as "candidate",
        economics: { unit: rec.economics, bundle_of_two: rec.bundleOfTwo, suggested_price: rec.suggestedPrice, cac: cac ?? model.targetCac, fee_model: model, computed_at: new Date().toISOString() } as unknown as Json,
      })
      .eq("id", id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not update the price."));
    revalidatePath(`/brands/${bp.data.brand_id}/products`);
    return { ok: true, message: `Recomputed: ${rec.recommendation.replace("_", " ")}${bp.data.status === "approved" ? " — needs assortment re-approval" : ""}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function requestAssortmentApprovalAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const brandId = z.uuid().parse(fd.get("brand_id"));
    const products = await ctx.db.from("brand_products").select("id").eq("brand_id", brandId).in("status", ["candidate", "pending_approval"]).neq("recommendation", "avoid");
    const ids = (products.data ?? []).map((p) => p.id);
    if (!ids.length) throw new UserFacingError("No candidate products to approve.");
    await ctx.db.from("brand_products").update({ status: "pending_approval" }).in("id", ids);
    const { requestGate } = await import("../services/approvals");
    const gate = await requestGate(ctx.db, { workspaceId: ctx.workspace.id, userId: ctx.user.id, gateType: "product_assortment", subjectType: "brand", subjectId: brandId, brandId, title: `Approve product assortment (${ids.length} products)`, payload: { brand_product_ids: ids } });
    revalidatePath(`/brands/${brandId}/products`);
    return { ok: true, message: `Assortment approval requested (${gate.code}).` };
  } catch (e) {
    return toActionError(e);
  }
}
