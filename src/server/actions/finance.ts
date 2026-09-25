"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "../context";
import { recomputeBrandFinancials } from "../services/finance";
import { toActionError, type ActionResult } from "./result";

export async function recomputeFinancialsAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("imports.run");
    const brandId = z.uuid().parse(fd.get("brand_id"));
    const n = await recomputeBrandFinancials(ctx.db, ctx.workspace.id, brandId);
    revalidatePath(`/brands/${brandId}/financials`);
    return { ok: true, message: `Rebuilt ${n} day(s) of financial metrics from imported orders.` };
  } catch (e) {
    return toActionError(e);
  }
}
