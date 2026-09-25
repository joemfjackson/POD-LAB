"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { GateType } from "@/domain/lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireContext } from "../context";
import { decideGate, requestGate } from "../services/approvals";
import { UserFacingError } from "../services/errors";
import { toActionError, type ActionResult } from "./result";

export async function decideGateAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    const gateId = z.uuid().parse(fd.get("gate_id"));
    const decision = z.enum(["approved", "rejected", "revision_requested"]).parse(fd.get("decision"));
    const reason = z.string().trim().max(2000).parse(fd.get("reason") ?? "") || null;
    const comment = z.string().trim().max(5000).parse(fd.get("comment") ?? "");
    if (comment) await ctx.db.from("approval_comments").insert({ workspace_id: ctx.workspace.id, gate_id: gateId, author_id: ctx.user.id, body: comment });
    const decided = await decideGate(ctx.db, createSupabaseAdminClient(), { gateId, decision, reason: reason ?? (comment || null), role: ctx.role });
    revalidatePath("/", "layout");
    return { ok: true, message: `${decided.code} ${decision.replace("_", " ")}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function commentGateAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    const gateId = z.uuid().parse(fd.get("gate_id"));
    const body = z.string().trim().min(1, "Write a comment").max(5000).parse(fd.get("body"));
    const res = await ctx.db.from("approval_comments").insert({ workspace_id: ctx.workspace.id, gate_id: gateId, author_id: ctx.user.id, body });
    if (res.error) throw new UserFacingError(res.error.message);
    revalidatePath(`/approvals/${gateId}`);
    return { ok: true, message: "Comment added." };
  } catch (e) {
    return toActionError(e);
  }
}

const REQUESTABLE: Record<string, { subjectType: string; table: "design_concepts" | "brand_names" | "stores" | "campaigns" | "brands"; label: (row: Record<string, unknown>) => string }> = {
  design_production: { subjectType: "design", table: "design_concepts", label: (r) => `Production approval: ${r.code} ${r.title}` },
  brand_name_final: { subjectType: "brand_name", table: "brand_names", label: (r) => `Make "${r.name}" the final brand name` },
  store_launch: { subjectType: "store", table: "stores", label: (r) => `Approve launch of ${r.name}` },
  paid_campaign_spend: { subjectType: "campaign", table: "campaigns", label: (r) => `Approve paid spend: ${r.code} ${r.name}` },
  destructive_action: { subjectType: "brand", table: "brands", label: (r) => `Archive brand ${r.code}` },
};

/** Human request for an approval (the decision is still a separate human step). */
export async function requestGateAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const gateType = z.enum(Object.keys(REQUESTABLE) as [string, ...string[]]).parse(fd.get("gate_type")) as GateType;
    const subjectId = z.uuid().parse(fd.get("subject_id"));
    const cfg = REQUESTABLE[gateType]!;
    const row = await ctx.db.from(cfg.table).select("*").eq("id", subjectId).single();
    if (row.error) throw new UserFacingError("Subject not found.");
    const r = row.data as Record<string, unknown>;
    const brandId = cfg.table === "brands" ? null : ((r.brand_id as string | undefined) ?? null);
    const payload: Record<string, unknown> = {};
    if (gateType === "destructive_action") payload.action = z.enum(["archive_brand", "delete_brand"]).parse(fd.get("action") ?? "archive_brand");
    if (gateType === "paid_campaign_spend") payload.budget_usd = Number(r.proposed_budget_usd ?? 0);
    const summary = z.string().trim().max(2000).parse(fd.get("summary") ?? "") || undefined;
    const title = payload.action === "delete_brand" ? `Permanently delete brand ${r.code}` : cfg.label(r);
    const gate = await requestGate(ctx.db, { workspaceId: ctx.workspace.id, userId: ctx.user.id, gateType, subjectType: cfg.subjectType, subjectId, brandId, title, summary, payload });
    revalidatePath("/", "layout");
    return { ok: true, message: `Approval requested (${gate.code}).` };
  } catch (e) {
    return toActionError(e);
  }
}
