"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BRAND_STAGES } from "@/domain/lifecycle";
import { requireContext } from "../context";
import { recordBrandDecision, transitionBrand } from "../services/brands";
import { UserFacingError, describeDbError } from "../services/errors";
import { toActionError, type ActionResult } from "./result";

const newBrand = z.object({
  working_title: z.string().trim().min(2, "Working title is required").max(200),
  niche: z.string().trim().min(2, "Niche is required").max(200),
  sub_niche: z.string().trim().max(200).optional(),
  audience: z.string().trim().max(1000).optional(),
  opportunity_thesis: z.string().trim().max(4000).optional(),
});

export async function createBrandAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const ctx = await requireContext("content.edit");
    const input = newBrand.parse({
      working_title: fd.get("working_title"),
      niche: fd.get("niche"),
      sub_niche: fd.get("sub_niche") || undefined,
      audience: fd.get("audience") || undefined,
      opportunity_thesis: fd.get("opportunity_thesis") || undefined,
    });
    const res = await ctx.db.from("brands").insert({ ...input, workspace_id: ctx.workspace.id, stage: "idea", created_by: ctx.user.id }).select("id, code").single();
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not create the brand."));
    await ctx.db.from("brand_stage_history").insert({ workspace_id: ctx.workspace.id, brand_id: res.data.id, from_stage: null, to_stage: "idea", actor_type: "human", actor_id: ctx.user.id, reason: "Brand created manually" });
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "brand.created", subject_type: "brand", subject_id: res.data.id, brand_id: res.data.id, summary: `${ctx.user.displayName} created ${res.data.code} ${input.working_title}` });
    id = res.data.id;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/brands/${id}`);
}

const editable = z.object({
  brand_id: z.uuid(),
  working_title: z.string().trim().min(2).max(200),
  niche: z.string().trim().min(2).max(200),
  sub_niche: z.string().trim().max(200).nullable(),
  audience: z.string().trim().max(1000).nullable(),
  opportunity_thesis: z.string().trim().max(4000).nullable(),
  domain: z.string().trim().max(253).nullable(),
});

export async function updateBrandAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const s = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" && v.trim() ? v : null;
    };
    const input = editable.parse({
      brand_id: fd.get("brand_id"),
      working_title: fd.get("working_title"),
      niche: fd.get("niche"),
      sub_niche: s("sub_niche"),
      audience: s("audience"),
      opportunity_thesis: s("opportunity_thesis"),
      domain: s("domain"),
    });
    const { brand_id, ...fields } = input;
    const res = await ctx.db.from("brands").update(fields).eq("id", brand_id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save."));
    revalidatePath(`/brands/${brand_id}`);
    return { ok: true, message: "Saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function transitionBrandAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const brandId = z.uuid().parse(fd.get("brand_id"));
    const to = z.enum(BRAND_STAGES).parse(fd.get("to"));
    const reason = z.string().trim().min(3, "Give a reason for the stage change").max(1000).parse(fd.get("reason"));
    const r = await transitionBrand(ctx.db, { brandId, to, reason, userId: ctx.user.id });
    revalidatePath(`/brands/${brandId}`, "layout");
    return { ok: true, message: `Moved to ${r.to.replace("_", " ")}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function brandDecisionAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const brandId = z.uuid().parse(fd.get("brand_id"));
    const decision = z.enum(["kill", "iterate", "clone", "scale", "pause", "keep_collecting"]).parse(fd.get("decision"));
    const reason = z.string().trim().min(3, "Give a reason").max(2000).parse(fd.get("reason"));
    const experimentId = z.uuid().optional().parse(fd.get("experiment_id") || undefined);
    const r = await recordBrandDecision(ctx.db, { brandId, decision, reason, userId: ctx.user.id, experimentId });
    revalidatePath(`/brands/${brandId}`, "layout");
    revalidatePath("/brands");
    const msg = r.newBrandId ? "Clone created as a new brand (stage: idea)." : r.gateId ? "Scale approval requested — an admin must approve." : `Decision recorded: ${decision.replace("_", " ")}.`;
    return { ok: true, message: msg };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addNoteAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("notes.write");
    const brandId = z.uuid().optional().parse(fd.get("brand_id") || undefined);
    const subjectType = z.enum(["brand", "opportunity", "design", "experiment", "store", "campaign"]).parse(fd.get("subject_type") ?? "brand");
    const subjectId = z.uuid().optional().parse(fd.get("subject_id") || undefined);
    const body = z.string().trim().min(1, "Write something").max(20000).parse(fd.get("body"));
    const res = await ctx.db.from("notes").insert({ workspace_id: ctx.workspace.id, brand_id: brandId ?? null, subject_type: subjectType, subject_id: subjectId ?? brandId ?? null, body, author_id: ctx.user.id });
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save the note."));
    if (brandId) revalidatePath(`/brands/${brandId}/notes`);
    return { ok: true, message: "Note added." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateNameStatusAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const nameId = z.uuid().parse(fd.get("name_id"));
    const status = z.enum(["shortlisted", "rejected", "proposed"]).parse(fd.get("status"));
    const res = await ctx.db.from("brand_names").update({ status }).eq("id", nameId).neq("status", "final").select("brand_id");
    if (res.error || !res.data?.length) throw new UserFacingError("Could not update the name (final names change only through approval).");
    revalidatePath(`/brands/${res.data[0]!.brand_id}/names`);
    return { ok: true, message: `Name ${status}.` };
  } catch (e) {
    return toActionError(e);
  }
}
