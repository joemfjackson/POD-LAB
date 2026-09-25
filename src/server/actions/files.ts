"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "../context";
import { UserFacingError } from "../services/errors";
import { storeFile, validateUpload, type FileKind } from "../services/files";
import { toActionError, type ActionResult } from "./result";

const KINDS = ["design", "mockup", "logo", "research", "export", "import", "other"] as const;

export async function uploadFileAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("content.edit");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new UserFacingError("Choose a file to upload.");
    const brandId = z.uuid().optional().parse(fd.get("brand_id") || undefined);
    const designId = z.uuid().optional().parse(fd.get("design_id") || undefined);
    const kind = z.enum(KINDS).parse(fd.get("kind") ?? "other") as FileKind;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = validateUpload({ name: file.name, type: file.type, size: file.size }, bytes.slice(0, 64));
    const row = await storeFile(ctx.db, { workspaceId: ctx.workspace.id, brandId: brandId ?? null, kind, name: file.name, mimeType: mime, bytes, userId: ctx.user.id });
    if (designId) {
      const design = await ctx.db.from("design_concepts").select("current_revision").eq("id", designId).single();
      await ctx.db.from("design_assets").insert({
        workspace_id: ctx.workspace.id,
        design_id: designId,
        file_id: row.id,
        kind: kind === "mockup" ? "mockup" : kind === "design" ? "artwork" : "reference",
        source: "upload",
        revision: design.data?.current_revision ?? 1,
        created_by: ctx.user.id,
      });
      revalidatePath(`/design-studio/${designId}`);
    }
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "file.uploaded", subject_type: "file", subject_id: row.id, brand_id: brandId ?? null, summary: `${ctx.user.displayName} uploaded ${row.name}` });
    revalidatePath("/files");
    if (brandId) revalidatePath(`/brands/${brandId}/files`);
    return { ok: true, message: `Uploaded ${row.name}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteFileAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("data.delete");
    const id = z.uuid().parse(fd.get("file_id"));
    const f = await ctx.db.from("files").select("path, name, brand_id").eq("id", id).single();
    if (f.error) throw new UserFacingError("File not found.");
    const rm = await ctx.db.storage.from("pod-lab").remove([f.data.path]);
    if (rm.error) throw new UserFacingError(rm.error.message);
    await ctx.db.from("files").delete().eq("id", id);
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "file.deleted", subject_type: "file", subject_id: id, brand_id: f.data.brand_id, summary: `${ctx.user.displayName} deleted ${f.data.name}` });
    revalidatePath("/files");
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return toActionError(e);
  }
}
