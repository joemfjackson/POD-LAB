import type { SupabaseClient } from "@supabase/supabase-js";
import { IMPORT_KINDS, previewImport, type ImportKind, type RowError } from "@/domain/csv";
import type { Database, Json } from "@/lib/supabase/database.types";
import { UserFacingError } from "./errors";
import { recomputeBrandFinancials } from "./finance";

type Db = SupabaseClient<Database>;

export interface ImportTarget {
  brandId?: string | null;
  experimentId?: string | null;
}

export interface ImportResult {
  batchId: string;
  imported: number;
  errors: RowError[];
  total: number;
}

/**
 * Imports the VALID rows of a CSV and records an import batch with every
 * error row. Invalid rows are never written.
 */
export async function commitImport(db: Db, params: { workspaceId: string; userId: string; kind: ImportKind; filename: string; csv: string; mapping?: Record<string, number>; target: ImportTarget }): Promise<ImportResult> {
  const preview = previewImport(params.kind, params.csv, params.mapping);
  if (preview.missingRequired.length) throw new UserFacingError(`Map the required columns first: ${preview.missingRequired.join(", ")}`);
  const errors: RowError[] = [...preview.errors];
  let imported = 0;

  const batch = await db
    .from("import_batches")
    .insert({ workspace_id: params.workspaceId, kind: params.kind, filename: params.filename.slice(0, 200), total_rows: preview.totalRows, mapping: preview.mapping as unknown as Json, brand_id: params.target.brandId ?? null, created_by: params.userId })
    .select("id")
    .single();
  if (batch.error) throw new UserFacingError(batch.error.message);

  if (params.kind === "fulfillment_catalog" || params.kind === "products") {
    const providerKey = params.kind === "fulfillment_catalog" ? "csv" : "manual";
    const provider = await db.from("fulfillment_providers").select("id").eq("workspace_id", params.workspaceId).eq("key", providerKey).single();
    if (provider.error) throw new UserFacingError("Provider record missing — open Settings to repair workspace defaults.");
    const rows = (preview as ReturnType<typeof previewImport<"fulfillment_catalog">>).valid.map(({ data: d }) => ({
      workspace_id: params.workspaceId,
      provider_id: provider.data.id,
      provider_sku: d.provider_sku,
      blank_name: d.blank_name,
      blank_brand: d.blank_brand || null,
      product_type: d.product_type,
      available_colors: d.available_colors,
      available_sizes: d.available_sizes,
      blank_cost: d.blank_cost,
      decoration_method: d.decoration_method || "dtg",
      decoration_cost: d.decoration_cost,
      fulfillment_fee: d.fulfillment_fee,
      shipping_estimate_domestic: d.shipping_estimate_domestic,
      shipping_estimate_international: d.shipping_estimate_international,
      production_sla_days: d.production_sla_days === null ? null : Math.round(d.production_sla_days),
      product_images: d.product_images.filter((u) => /^https:\/\//.test(u)),
      source: "csv" as const,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const res = await db.from("provider_products").upsert(rows.slice(i, i + 500), { onConflict: "provider_id,provider_sku" });
      if (res.error) throw new UserFacingError(res.error.message);
    }
    imported = rows.length;
  } else if (params.kind === "orders") {
    if (!params.target.brandId) throw new UserFacingError("Choose the brand these orders belong to.");
    const products = await db.from("brand_products").select("id, code, provider_products(provider_sku)").eq("brand_id", params.target.brandId);
    const bySku = new Map<string, string>();
    for (const p of products.data ?? []) {
      bySku.set(p.code.toUpperCase(), p.id);
      if (p.provider_products?.provider_sku) bySku.set(p.provider_products.provider_sku.toUpperCase(), p.id);
    }
    const rows = (preview as ReturnType<typeof previewImport<"orders">>).valid.map(({ data: d }) => ({
      workspace_id: params.workspaceId,
      brand_id: params.target.brandId!,
      import_batch_id: batch.data.id,
      external_order_id: d.external_order_id,
      order_date: d.order_date,
      channel: d.channel || null,
      sku: d.sku || "",
      product_title: d.product_title || null,
      brand_product_id: d.sku ? (bySku.get(d.sku.toUpperCase()) ?? null) : null,
      quantity: d.quantity,
      revenue: d.revenue,
      discount: d.discount,
      shipping_paid: d.shipping_paid,
      cogs: d.cogs,
      decoration_cost: d.decoration_cost,
      fulfillment_fee: d.fulfillment_fee,
      shipping_cost: d.shipping_cost,
      payment_processing: d.payment_processing,
      platform_fee: d.platform_fee,
      ad_attribution: d.ad_attribution,
      refunds: d.refunds,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const res = await db.from("orders_import").upsert(rows.slice(i, i + 500), { onConflict: "brand_id,external_order_id,sku" });
      if (res.error) throw new UserFacingError(res.error.message);
    }
    imported = rows.length;
    await recomputeBrandFinancials(db, params.workspaceId, params.target.brandId);
  } else {
    if (!params.target.experimentId) throw new UserFacingError("Choose the experiment these metrics belong to.");
    const variants = await db.from("experiment_variants").select("id, key").eq("experiment_id", params.target.experimentId);
    const byKey = new Map((variants.data ?? []).map((v) => [v.key, v.id]));
    const rows = [];
    for (const { row, data: d } of (preview as ReturnType<typeof previewImport<"experiment_metrics">>).valid) {
      const variantId = byKey.get(d.variant_key);
      if (!variantId) {
        errors.push({ row, field: "variant_key", message: `Variant ${d.variant_key} does not exist in this experiment` });
        continue;
      }
      const { variant_key: _k, ...metrics } = d;
      rows.push({ ...metrics, workspace_id: params.workspaceId, experiment_id: params.target.experimentId, variant_id: variantId, source: "csv" as const, import_batch_id: batch.data.id });
    }
    if (rows.length) {
      const res = await db.from("experiment_metrics").upsert(rows, { onConflict: "variant_id,metric_date,source" });
      if (res.error) throw new UserFacingError(res.error.message);
    }
    imported = rows.length;
  }

  errors.sort((a, b) => a.row - b.row);
  await db
    .from("import_batches")
    .update({ imported_rows: imported, error_rows: new Set(errors.map((e) => e.row)).size, errors: errors.slice(0, 500) as unknown as Json, status: errors.length === 0 ? "completed" : imported > 0 ? "partial" : "failed" })
    .eq("id", batch.data.id);
  await db.from("audit_log").insert({
    workspace_id: params.workspaceId,
    actor_type: "human",
    actor_id: params.userId,
    action: `import.${params.kind}`,
    subject_type: "import_batch",
    subject_id: batch.data.id,
    brand_id: params.target.brandId ?? null,
    summary: `Imported ${imported} ${IMPORT_KINDS[params.kind].label.toLowerCase()} row(s) from ${params.filename}${errors.length ? ` (${errors.length} error(s))` : ""}`,
  });
  return { batchId: batch.data.id, imported, errors, total: preview.totalRows };
}
