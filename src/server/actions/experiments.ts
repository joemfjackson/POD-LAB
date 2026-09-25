"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EXPERIMENT_TYPES, PRIMARY_METRICS } from "@/agents/schemas";
import { requireContext } from "../context";
import { UserFacingError, describeDbError } from "../services/errors";
import { toActionError, type ActionResult } from "./result";

export async function createExperimentAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireContext("content.edit");
    const input = z
      .object({
        brand_id: z.uuid(),
        name: z.string().trim().min(3, "Name is required").max(200),
        experiment_type: z.enum(EXPERIMENT_TYPES),
        hypothesis: z.string().trim().min(5, "State a hypothesis").max(2000),
        primary_metric: z.enum(PRIMARY_METRICS),
        minimum_sample: z.coerce.number().int().min(0).max(1_000_000),
        variants: z.string().transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean)),
      })
      .parse({
        brand_id: fd.get("brand_id"),
        name: fd.get("name"),
        experiment_type: fd.get("experiment_type"),
        hypothesis: fd.get("hypothesis"),
        primary_metric: fd.get("primary_metric"),
        minimum_sample: fd.get("minimum_sample") ?? 500,
        variants: String(fd.get("variants") ?? ""),
      });
    if (input.variants.length < 2) throw new UserFacingError("Add at least two variants (one per line).");
    if (input.variants.length > 26) throw new UserFacingError("At most 26 variants.");
    const { variants, ...fields } = input;
    const exp = await ctx.db.from("experiments").insert({ ...fields, workspace_id: ctx.workspace.id, status: "draft", created_by: ctx.user.id }).select("id, code").single();
    if (exp.error) throw new UserFacingError(describeDbError(exp.error, "Could not create the experiment."));
    const v = await ctx.db.from("experiment_variants").insert(variants.map((name, i) => ({ workspace_id: ctx.workspace.id, experiment_id: exp.data.id, key: String.fromCharCode(65 + i), name: name.slice(0, 120), is_control: i === 0 })));
    if (v.error) throw new UserFacingError(v.error.message);
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "experiment.created", subject_type: "experiment", subject_id: exp.data.id, brand_id: input.brand_id, summary: `${ctx.user.displayName} created ${exp.data.code} ${input.name}` });
    revalidatePath("/experiments");
    return { ok: true, message: `Created ${exp.data.code}.`, data: { id: exp.data.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setExperimentStatusAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("experiment_id"));
    const status = z.enum(["running", "paused", "completed", "cancelled"]).parse(fd.get("status"));
    const today = new Date().toISOString().slice(0, 10);
    const cur = await ctx.db.from("experiments").select("start_date, code").eq("id", id).single();
    if (cur.error) throw new UserFacingError("Experiment not found.");
    const patch: { status: typeof status; start_date?: string; end_date?: string } = { status };
    if (status === "running" && !cur.data.start_date) patch.start_date = today;
    if (status === "completed" || status === "cancelled") patch.end_date = today;
    const res = await ctx.db.from("experiments").update(patch).eq("id", id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not update."));
    revalidatePath(`/experiments/${id}`);
    return { ok: true, message: `${cur.data.code} is ${status}.` };
  } catch (e) {
    return toActionError(e);
  }
}

const nonneg = z.coerce.number().min(0);
const count = z.coerce.number().int().min(0);

export async function addMetricsAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("imports.run");
    const input = z
      .object({
        experiment_id: z.uuid(),
        variant_id: z.uuid(),
        metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        impressions: count,
        clicks: count,
        sessions: count,
        product_views: count,
        add_to_carts: count,
        checkouts: count,
        purchases: count,
        gross_revenue: nonneg,
        discounts: nonneg,
        refunds: nonneg,
        cogs: nonneg,
        fulfillment_cost: nonneg,
        shipping_subsidy: nonneg,
        ad_spend: nonneg,
        repeat_buyers: count,
      })
      .parse(Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, v === "" ? "0" : v])));
    const res = await ctx.db.from("experiment_metrics").upsert({ ...input, workspace_id: ctx.workspace.id, source: "manual" }, { onConflict: "variant_id,metric_date,source" });
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save metrics."));
    revalidatePath(`/experiments/${input.experiment_id}`);
    return { ok: true, message: `Saved metrics for ${input.metric_date}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function overrideDecisionAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("experiment_id"));
    const decision = z.enum(["insufficient_data", "keep_collecting", "kill", "iterate", "clone", "scale"]).parse(fd.get("override_decision"));
    const reason = z.string().trim().min(3, "An override needs a reason").max(2000).parse(fd.get("override_reason"));
    const res = await ctx.db.from("experiments").update({ override_decision: decision, override_reason: reason, overridden_by: ctx.user.id, overridden_at: new Date().toISOString() }).eq("id", id).select("code, brand_id");
    if (res.error || !res.data?.length) throw new UserFacingError(describeDbError(res.error, "Could not save the override."));
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "experiment.override", subject_type: "experiment", subject_id: id, brand_id: res.data[0]!.brand_id, summary: `${ctx.user.displayName} overrode ${res.data[0]!.code} decision → ${decision}: ${reason}` });
    revalidatePath(`/experiments/${id}`);
    return { ok: true, message: "Override recorded." };
  } catch (e) {
    return toActionError(e);
  }
}
