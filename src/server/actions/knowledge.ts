"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "../context";
import { UserFacingError, describeDbError } from "../services/errors";
import { toActionError, type ActionResult } from "./result";

export async function setTrendStatusAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("trend_id"));
    const status = z.enum(["watching", "dismissed", "new"]).parse(fd.get("status"));
    const res = await ctx.db.from("trends").update({ status }).eq("id", id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not update."));
    revalidatePath("/trends");
    return { ok: true, message: `Trend ${status}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createInsightAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const opt = (k: string) => (fd.get(k) ? String(fd.get(k)) : undefined);
    const input = z
      .object({
        title: z.string().trim().min(3, "Title is required").max(300),
        body: z.string().trim().min(3, "Describe the insight").max(5000),
        claim_type: z.enum(["observation", "correlation", "hypothesis", "validated"]),
        confidence: z.enum(["low", "medium", "high"]),
        evidence_summary: z.string().trim().max(2000).optional(),
        sample_size: z.coerce.number().int().min(0).optional(),
        brand_id: z.uuid().optional(),
        experiment_id: z.uuid().optional(),
        tags: z.string().optional().transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10)),
      })
      .parse({
        title: fd.get("title"),
        body: fd.get("body"),
        claim_type: fd.get("claim_type"),
        confidence: fd.get("confidence"),
        evidence_summary: opt("evidence_summary"),
        sample_size: opt("sample_size"),
        brand_id: opt("brand_id"),
        experiment_id: opt("experiment_id"),
        tags: opt("tags"),
      });
    if (input.claim_type === "validated" && !input.experiment_id) throw new UserFacingError("A validated insight must link to the experiment that validated it.");
    const res = await ctx.db.from("insights").insert({ ...input, workspace_id: ctx.workspace.id, source: "human", created_by: ctx.user.id });
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save the insight."));
    revalidatePath("/insights");
    return { ok: true, message: "Insight saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function archiveInsightAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("insight_id"));
    await ctx.db.from("insights").update({ status: "archived" }).eq("id", id);
    revalidatePath("/insights");
    return { ok: true, message: "Archived." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function markNotificationsReadAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext();
    const id = fd.get("notification_id");
    let q = ctx.db.from("notifications").update({ read_at: new Date().toISOString() }).eq("workspace_id", ctx.workspace.id).is("read_at", null);
    if (typeof id === "string" && id) q = q.eq("id", z.uuid().parse(id));
    const res = await q;
    if (res.error) throw new UserFacingError(res.error.message);
    revalidatePath("/", "layout");
    return { ok: true, message: "Marked as read." };
  } catch (e) {
    return toActionError(e);
  }
}
