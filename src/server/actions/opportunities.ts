"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireContext } from "../context";
import { decideGate, requestGate } from "../services/approvals";
import { UserFacingError } from "../services/errors";
import { startAgentJob } from "./agents";
import { toActionError, type ActionResult } from "./result";

const idSchema = z.uuid();

async function gateFor(ctx: Awaited<ReturnType<typeof requireContext>>, oppId: string) {
  const opp = await ctx.db.from("opportunities").select("id, code, niche, status, brand_id").eq("id", oppId).single();
  if (opp.error) throw new UserFacingError("Opportunity not found.");
  const gate = await requestGate(ctx.db, {
    workspaceId: ctx.workspace.id,
    userId: ctx.user.id,
    gateType: "opportunity_approval",
    subjectType: "opportunity",
    subjectId: opp.data.id,
    brandId: opp.data.brand_id,
    title: `Approve opportunity ${opp.data.code}: ${opp.data.niche}`,
  });
  return { opp: opp.data, gate };
}

export async function decideOpportunityAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult<{ brandId: string | null }>> {
  try {
    const ctx = await requireContext("content.edit");
    const id = idSchema.parse(fd.get("opportunity_id"));
    const decision = z.enum(["approved", "rejected", "revision_requested"]).parse(fd.get("decision"));
    const reason = z.string().trim().max(2000).parse(fd.get("reason") ?? "") || null;
    const { opp, gate } = await gateFor(ctx, id);
    if (opp.status === "approved") throw new UserFacingError("This opportunity is already approved.");
    const decided = await decideGate(ctx.db, createSupabaseAdminClient(), { gateId: gate.id, decision, reason, role: ctx.role });
    let message = decision === "approved" ? `Approved ${opp.code}. Brand record created.` : decision === "rejected" ? `Rejected ${opp.code}.` : `Sent ${opp.code} back for more research.`;
    if (decision === "approved" && fd.get("send_to_architect") === "on" && decided.brand_id) {
      const run = await startAgentJob(ctx, "brand_architect", { brand_id: decided.brand_id }, decided.brand_id);
      message += ` ${run.message}`;
    }
    revalidatePath("/opportunities");
    revalidatePath(`/opportunities/${id}`);
    return { ok: true, message, data: { brandId: decided.brand_id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function archiveOpportunityAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = idSchema.parse(fd.get("opportunity_id"));
    const res = await ctx.db.from("opportunities").update({ status: "archived" }).eq("id", id).neq("status", "approved").select("code");
    if (!res.data?.length) throw new UserFacingError("Approved opportunities cannot be archived here — archive the brand instead.");
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "opportunity.archived", subject_type: "opportunity", subject_id: id, summary: `${ctx.user.displayName} archived ${res.data[0]!.code}` });
    revalidatePath("/opportunities");
    return { ok: true, message: "Archived." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function researchDeeperAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.run");
    const id = idSchema.parse(fd.get("opportunity_id"));
    const depth = z.coerce.number().int().min(1).max(5).parse(fd.get("research_depth") ?? 2);
    const opp = await ctx.db.from("opportunities").select("id, niche, brand_id, status").eq("id", id).single();
    if (opp.error) throw new UserFacingError("Opportunity not found.");
    if (opp.data.status !== "approved") await ctx.db.from("opportunities").update({ status: "researching" }).eq("id", id);
    const payload = {
      prompt: `Research deeper: ${opp.data.niche}. Re-examine demand, competition and risks with more evidence.`,
      mission_type: "revisit",
      opportunity_id: id,
      research_depth: depth,
      ...(opp.data.brand_id ? { brand_id: opp.data.brand_id } : {}),
    };
    const { message } = await startAgentJob(ctx, "opportunity_scout", payload, opp.data.brand_id);
    revalidatePath(`/opportunities/${id}`);
    return { ok: true, message };
  } catch (e) {
    return toActionError(e);
  }
}

export async function sendToArchitectAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.run");
    const id = idSchema.parse(fd.get("opportunity_id"));
    const opp = await ctx.db.from("opportunities").select("brand_id, status").eq("id", id).single();
    if (opp.error || !opp.data.brand_id || opp.data.status !== "approved") throw new UserFacingError("Approve the opportunity first — approval creates the Brand Record.");
    const { message } = await startAgentJob(ctx, "brand_architect", { brand_id: opp.data.brand_id }, opp.data.brand_id);
    revalidatePath(`/brands/${opp.data.brand_id}`);
    return { ok: true, message };
  } catch (e) {
    return toActionError(e);
  }
}
