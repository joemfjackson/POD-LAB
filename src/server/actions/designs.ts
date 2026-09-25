"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PRINTING_METHODS } from "@/agents/schemas";
import type { Json } from "@/lib/supabase/database.types";
import { getImageProvider } from "@/providers/image";
import { ProviderNotConfiguredError } from "@/providers/errors";
import { requireContext } from "../context";
import { UserFacingError, describeDbError } from "../services/errors";
import { storeFile } from "../services/files";
import { startAgentJob } from "./agents";
import { toActionError, type ActionResult } from "./result";

const str = (max: number) => z.string().trim().max(max).nullable();
const list = z.string().transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10));

const designFields = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  concept: z.string().trim().min(1, "Concept is required").max(4000),
  collection_id: z.uuid().nullable(),
  front_placement: str(300),
  back_placement: str(300),
  sleeve_placement: str(300),
  colors: list,
  typography: str(500),
  illustration_notes: str(1000),
  printing_method: z.enum(PRINTING_METHODS).nullable(),
  preferred_products: list,
  target_buyer: str(500),
  generation_prompt: str(4000),
  mockup_prompt: str(2000),
});

function readDesign(fd: FormData) {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() ? v : null;
  };
  return designFields.parse({
    title: fd.get("title"),
    concept: fd.get("concept"),
    collection_id: s("collection_id"),
    front_placement: s("front_placement"),
    back_placement: s("back_placement"),
    sleeve_placement: s("sleeve_placement"),
    colors: String(fd.get("colors") ?? ""),
    typography: s("typography"),
    illustration_notes: s("illustration_notes"),
    printing_method: s("printing_method"),
    preferred_products: String(fd.get("preferred_products") ?? ""),
    target_buyer: s("target_buyer"),
    generation_prompt: s("generation_prompt"),
    mockup_prompt: s("mockup_prompt"),
  });
}

export async function createDesignAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const brandId = z.uuid().parse(fd.get("brand_id"));
    const fields = readDesign(fd);
    const res = await ctx.db
      .from("design_concepts")
      .insert({ ...fields, workspace_id: ctx.workspace.id, brand_id: brandId, status: "brief", compliance_status: "not_reviewed" })
      .select("id, code")
      .single();
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not create the design."));
    await ctx.db.from("design_revisions").insert({ workspace_id: ctx.workspace.id, design_id: res.data.id, revision_number: 1, snapshot: fields as unknown as Json, change_notes: "Created manually", actor_type: "human", actor_id: ctx.user.id });
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "design.created", subject_type: "design", subject_id: res.data.id, brand_id: brandId, summary: `${ctx.user.displayName} created ${res.data.code} ${fields.title}` });
    revalidatePath("/design-studio");
    return { ok: true, message: `Created ${res.data.code}. Run IP / Compliance before requesting production approval.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateDesignAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("design_id"));
    const notes = z.string().trim().max(1000).parse(fd.get("change_notes") ?? "") || "Edited";
    const fields = readDesign(fd);
    const cur = await ctx.db.from("design_concepts").select("current_revision, status, brand_id, code").eq("id", id).single();
    if (cur.error) throw new UserFacingError("Design not found.");
    const revision = cur.data.current_revision + 1;
    // Any edit invalidates prior screening and production approval.
    const status = ["approved", "production_ready"].includes(cur.data.status) ? "review" : cur.data.status === "idea" ? "brief" : cur.data.status;
    const res = await ctx.db.from("design_concepts").update({ ...fields, current_revision: revision, compliance_status: "pending", status: status as "review" }).eq("id", id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save."));
    await ctx.db.from("design_revisions").insert({ workspace_id: ctx.workspace.id, design_id: id, revision_number: revision, snapshot: fields as unknown as Json, change_notes: notes, actor_type: "human", actor_id: ctx.user.id });
    const screen = await startAgentJob(ctx, "ip_compliance", { brand_id: cur.data.brand_id, design_ids: [id] }, cur.data.brand_id);
    revalidatePath(`/design-studio/${id}`);
    return { ok: true, message: `Saved revision ${revision}. ${screen.message}` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setDesignStatusAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const id = z.uuid().parse(fd.get("design_id"));
    const status = z.enum(["idea", "brief", "review", "revision", "retired"]).parse(fd.get("status"));
    const res = await ctx.db.from("design_concepts").update({ status }).eq("id", id).select("code");
    if (res.error || !res.data?.length) throw new UserFacingError(describeDbError(res.error, "Could not update the status."));
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "design.status", subject_type: "design", subject_id: id, summary: `${ctx.user.displayName} set ${res.data[0]!.code} to ${status}` });
    revalidatePath(`/design-studio/${id}`);
    return { ok: true, message: `Status set to ${status}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function generateDesignImageAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.run");
    const id = z.uuid().parse(fd.get("design_id"));
    const kind = z.enum(["artwork", "mockup"]).parse(fd.get("kind"));
    const design = await ctx.db.from("design_concepts").select("brand_id, code, title, generation_prompt, mockup_prompt, current_revision, status").eq("id", id).single();
    if (design.error) throw new UserFacingError("Design not found.");
    const prompt = kind === "artwork" ? design.data.generation_prompt : design.data.mockup_prompt;
    if (!prompt) throw new UserFacingError(`Add a ${kind === "artwork" ? "generation" : "mockup"} prompt first.`);
    const provider = getImageProvider();
    if (!provider.configured) throw new ProviderNotConfiguredError("image generation", "set IMAGE_PROVIDER and IMAGE_API_KEY, or upload artwork manually");
    const r = await ctx.db.rpc("consume_rate_limit", { bucket: "image_generation", max_hits: 20, window_seconds: 3600 });
    if (r.data !== true) throw new UserFacingError("Image generation limit reached (20 per hour).");
    const prev = design.data.status;
    if (prev === "brief" || prev === "idea") await ctx.db.from("design_concepts").update({ status: "generating" }).eq("id", id);
    try {
      const img = await provider.generate(prompt);
      const file = await storeFile(ctx.db, { workspaceId: ctx.workspace.id, brandId: design.data.brand_id, kind: kind === "artwork" ? "design" : "mockup", name: `${design.data.code}-${kind}.png`, mimeType: "image/png", bytes: img.bytes, userId: ctx.user.id });
      await ctx.db.from("design_assets").insert({ workspace_id: ctx.workspace.id, design_id: id, file_id: file.id, kind, source: "generated", provider: `${img.provider}:${img.model}`, prompt, revision: design.data.current_revision, created_by: ctx.user.id });
      if (prev === "brief" || prev === "idea") await ctx.db.from("design_concepts").update({ status: "review" }).eq("id", id);
    } catch (err) {
      if (prev === "brief" || prev === "idea") await ctx.db.from("design_concepts").update({ status: prev }).eq("id", id);
      throw err;
    }
    revalidatePath(`/design-studio/${id}`);
    return { ok: true, message: `Generated ${kind}.` };
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}
