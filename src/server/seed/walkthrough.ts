import type { SupabaseClient } from "@supabase/supabase-js";
import { processJob } from "@/agents/runtime/runner";
import { check, must } from "@/agents/runtime/db-helpers";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { requestAgentRun } from "../services/agents";
import { decideGate, requestGate } from "../services/approvals";
import { transitionBrand } from "../services/brands";
import { recomputeBrandFinancials } from "../services/finance";

type Db = SupabaseClient<Database>;

export interface WalkthroughContext {
  admin: AdminClient;
  user: Db;
  userId: string;
  workspaceId: string;
  brandId: string;
  log?: (msg: string) => void;
}

const REASON = "Demo walkthrough approval (demo data)";

async function runAgent(ctx: WalkthroughContext, agentKey: Parameters<typeof requestAgentRun>[1]["agentKey"], payload: Record<string, unknown>) {
  const { job } = await requestAgentRun(ctx.admin, { workspaceId: ctx.workspaceId, userId: ctx.userId, agentKey, payload, brandId: ctx.brandId });
  const result = await processJob(ctx.admin, { jobId: job.id });
  if (!result || result.status === "failed" || result.status === "queued") throw new Error(`${agentKey} failed: ${result?.error ?? "not claimed"}`);
  ctx.log?.(`✓ ${agentKey}: ${result.summary}`);
  // Chained follow-ups (e.g. compliance after creative) run immediately in the walkthrough.
  for (;;) {
    const next = await processJob(ctx.admin, { workspaceId: ctx.workspaceId });
    if (!next) break;
    if (next.status === "failed") throw new Error(`follow-up job failed: ${next.error}`);
    ctx.log?.(`  ↳ follow-up: ${next.summary}`);
  }
  return result;
}

async function approvePending(ctx: WalkthroughContext, gateType: Database["public"]["Enums"]["approval_gate_type"]) {
  const gates = must(await ctx.user.from("approval_gates").select("id, title").eq("brand_id", ctx.brandId).eq("gate_type", gateType).eq("status", "pending"), "load gates");
  for (const g of gates) {
    await decideGate(ctx.user, ctx.admin, { gateId: g.id, decision: "approved", reason: REASON, role: "owner" });
    ctx.log?.(`  ✓ approved: ${g.title}`);
  }
  return gates.length;
}

/** Demo metrics for a two-variant experiment. Clearly flagged is_demo/source "demo". */
export async function seedDemoMetrics(admin: AdminClient, experimentId: string, days = 14, endDate = new Date()) {
  const exp = must(await admin.from("experiments").select("workspace_id").eq("id", experimentId).single(), "load experiment");
  const variants = must(await admin.from("experiment_variants").select("id, key").eq("experiment_id", experimentId).order("key"), "load variants");
  const rows = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(endDate.getTime() - (days - 1 - d) * 86_400_000).toISOString().slice(0, 10);
    for (const [i, v] of variants.entries()) {
      const sessions = 70 + ((d * 7 + i * 13) % 20);
      const impressions = sessions * 45;
      const purchases = Math.round(sessions * (i === 0 ? 0.024 : 0.034));
      const revenue = purchases * 38.5;
      rows.push({
        workspace_id: exp.workspace_id,
        experiment_id: experimentId,
        variant_id: v.id,
        metric_date: date,
        impressions,
        clicks: Math.round(impressions * 0.018),
        sessions,
        product_views: Math.round(sessions * 0.62),
        add_to_carts: Math.round(sessions * 0.08),
        checkouts: Math.round(sessions * 0.05),
        purchases,
        gross_revenue: Math.round(revenue * 100) / 100,
        discounts: 0,
        refunds: 0,
        cogs: Math.round(purchases * 12.2 * 100) / 100,
        fulfillment_cost: Math.round(purchases * 1.5 * 100) / 100,
        shipping_subsidy: 0,
        ad_spend: Math.round(sessions * 0.35 * 100) / 100,
        repeat_buyers: 0,
        source: "demo",
        is_demo: true,
      });
    }
  }
  check(await admin.from("experiment_metrics").upsert(rows, { onConflict: "variant_id,metric_date,source" }), "seed metrics");
  return rows.length;
}

/**
 * DEMO orders for a brand's approved products over the last `days` days, then
 * rebuilds the financial model. Clearly flagged is_demo.
 */
export async function seedDemoOrders(admin: AdminClient, workspaceId: string, brandId: string, days = 30, endDate = new Date()) {
  const products = must(
    await admin.from("brand_products").select("id, code, title, retail_price, economics").eq("brand_id", brandId).eq("status", "approved"),
    "approved products",
  );
  if (!products.length) return 0;
  const rows = [];
  let n = 0;
  for (let d = 0; d < days; d++) {
    const date = new Date(endDate.getTime() - (days - 1 - d) * 86_400_000).toISOString().slice(0, 10);
    const perDay = 1 + ((d * 5) % 4);
    for (let k = 0; k < perDay; k++) {
      const p = products[(d + k) % products.length]!;
      const unit = (p.economics as { unit?: { blankCost: number; decorationCost: number; fulfillmentFees: number; shippingCost: number } }).unit;
      const price = Number(p.retail_price);
      const qty = k % 3 === 0 ? 2 : 1;
      n++;
      rows.push({
        workspace_id: workspaceId,
        brand_id: brandId,
        brand_product_id: p.id,
        external_order_id: `DEMO-${String(n).padStart(5, "0")}`,
        order_date: date,
        channel: "demo",
        sku: p.code,
        product_title: p.title,
        quantity: qty,
        revenue: Math.round(price * qty * 100) / 100,
        discount: qty === 2 ? Math.round(price * 0.2 * 100) / 100 : 0,
        shipping_paid: price * qty >= 75 ? 0 : 4.99,
        cogs: Math.round((unit?.blankCost ?? 7) * qty * 100) / 100,
        decoration_cost: Math.round((unit?.decorationCost ?? 4) * qty * 100) / 100,
        fulfillment_fee: Math.round((unit?.fulfillmentFees ?? 1.5) * qty * 100) / 100,
        shipping_cost: unit?.shippingCost ?? 4.75,
        payment_processing: Math.round((price * qty * 0.029 + 0.3) * 100) / 100,
        platform_fee: 0,
        ad_attribution: k === 0 ? 9.5 : 0,
        refunds: n % 17 === 0 ? Math.round(price * 100) / 100 : 0,
        is_demo: true,
      });
    }
  }
  check(await admin.from("orders_import").upsert(rows, { onConflict: "brand_id,external_order_id,sku" }), "seed demo orders");
  await recomputeBrandFinancials(admin, workspaceId, brandId);
  return rows.length;
}

/**
 * Runs PL-0001 through the full pipeline with the demo provider:
 * Scout → approval → Brand Architect → name + identity → Creative Director →
 * compliance → design approvals → Product & Profit → assortment → Store Builder
 * → launch approval → Growth → experiment with demo metrics → Analyst.
 * Paid spend, compliance overrides and scaling are NEVER approved by the walkthrough.
 */
export async function runWalkthrough(ctx: WalkthroughContext) {
  const brand = must(await ctx.admin.from("brands").select("stage, opportunity_id").eq("id", ctx.brandId).single(), "load brand");

  if (["idea", "researching", "candidate"].includes(brand.stage)) {
    await runAgent(ctx, "opportunity_scout", { prompt: "Investigate whether AI / superintelligence is a strong POD market", mission_type: "investigate", brand_id: ctx.brandId, opportunity_id: brand.opportunity_id ?? undefined });
    await approvePending(ctx, "opportunity_approval");
  }

  await runAgent(ctx, "brand_architect", { brand_id: ctx.brandId, name_count: 10 });
  const topName = must(
    await ctx.user.from("brand_names").select("id, name").eq("brand_id", ctx.brandId).eq("status", "proposed").order("memorability", { ascending: false }).limit(1).single(),
    "top name",
  );
  const nameGate = await requestGate(ctx.user, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    gateType: "brand_name_final",
    subjectType: "brand_name",
    subjectId: topName.id,
    brandId: ctx.brandId,
    title: `Make "${topName.name}" the final brand name`,
  });
  await decideGate(ctx.user, ctx.admin, { gateId: nameGate.id, decision: "approved", reason: REASON, role: "owner" });
  ctx.log?.(`  ✓ final name: ${topName.name}`);
  await approvePending(ctx, "brand_identity_final");

  await runAgent(ctx, "creative_director", { brand_id: ctx.brandId, mode: "full", design_count: 8 });
  // Compliance overrides are never auto-approved: flagged designs wait for a human.
  const designs = must(
    await ctx.user.from("design_concepts").select("id, code, title").eq("brand_id", ctx.brandId).eq("status", "review").eq("compliance_status", "clear"),
    "designs for review",
  );
  for (const d of designs) {
    const g = await requestGate(ctx.user, {
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      gateType: "design_production",
      subjectType: "design",
      subjectId: d.id,
      brandId: ctx.brandId,
      title: `Production approval: ${d.code} ${d.title}`,
    });
    await decideGate(ctx.user, ctx.admin, { gateId: g.id, decision: "approved", reason: REASON, role: "owner" });
  }
  ctx.log?.(`  ✓ approved ${designs.length} designs for production`);

  await runAgent(ctx, "product_profit", { brand_id: ctx.brandId, max_products: 10 });
  await approvePending(ctx, "product_assortment");

  await runAgent(ctx, "store_builder", { brand_id: ctx.brandId });
  await approvePending(ctx, "store_launch");

  await runAgent(ctx, "growth", { brand_id: ctx.brandId });
  ctx.log?.("  • paid spend proposals left pending (never auto-approved)");

  const experiment = must(await ctx.user.from("experiments").select("id, code").eq("brand_id", ctx.brandId).eq("status", "draft").order("created_at").limit(1).single(), "first experiment");
  const start = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);
  check(await ctx.user.from("experiments").update({ status: "running", start_date: start }).eq("id", experiment.id), "start experiment");
  await transitionBrand(ctx.user, { brandId: ctx.brandId, to: "testing", reason: "Launch experiment started (demo)", userId: ctx.userId });
  const n = await seedDemoMetrics(ctx.admin, experiment.id, 14);
  ctx.log?.(`  • ${experiment.code}: ${n} demo metric rows`);

  const orders = await seedDemoOrders(ctx.admin, ctx.workspaceId, ctx.brandId, 30);
  ctx.log?.(`  • ${orders} demo orders imported; financial model rebuilt`);

  await runAgent(ctx, "experiment_analyst", { brand_id: ctx.brandId });
  return { experimentId: experiment.id };
}
