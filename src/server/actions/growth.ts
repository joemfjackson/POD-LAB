"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "../context";
import { UserFacingError, describeDbError } from "../services/errors";
import { toActionError, type ActionResult } from "./result";

export async function setCampaignStatusAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("campaign_id"));
    const status = z.enum(["draft", "active", "paused", "completed"]).parse(fd.get("status"));
    const res = await ctx.db.from("campaigns").update({ status }).eq("id", id).select("code, brand_id");
    if (res.error || !res.data?.length) throw new UserFacingError(describeDbError(res.error, "Could not update — paid campaigns can only become active after spending approval."));
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: `campaign.${status}`, subject_type: "campaign", subject_id: id, brand_id: res.data[0]!.brand_id, summary: `${ctx.user.displayName} set ${res.data[0]!.code} to ${status}` });
    revalidatePath(`/growth/${id}`);
    return { ok: true, message: `Campaign ${status}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setContentStatusAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("content_id"));
    const status = z.enum(["draft", "approved", "scheduled", "published", "rejected"]).parse(fd.get("status"));
    const res = await ctx.db.from("content_items").update({ status }).eq("id", id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not update."));
    revalidatePath("/growth");
    return { ok: true, message: `Marked ${status}. POD Lab never posts automatically.` };
  } catch (e) {
    return toActionError(e);
  }
}
