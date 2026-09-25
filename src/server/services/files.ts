import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { UserFacingError, describeDbError } from "./errors";

// 4 MB keeps uploads under the Vercel serverless request-body limit (4.5 MB).
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_MIME: Record<string, string[]> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "application/pdf": ["pdf"],
  "text/csv": ["csv"],
  "application/json": ["json"],
  "text/plain": ["txt", "md"],
};
export type FileKind = "design" | "mockup" | "logo" | "research" | "export" | "import" | "other";

/** Strips paths/control chars and keeps a conservative character set. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 100);
  return cleaned.length ? cleaned : "file";
}

/** Checks declared type, extension and magic bytes (SVG/HTML are never accepted). */
export function validateUpload(file: { name: string; type: string; size: number }, head: Uint8Array): string {
  if (file.size <= 0) throw new UserFacingError("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UserFacingError("Files must be 4 MB or smaller.");
  const exts = ALLOWED_MIME[file.type];
  if (!exts) throw new UserFacingError("Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, PDF, CSV, JSON, TXT.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!exts.includes(ext)) throw new UserFacingError(`The file extension does not match its type (${file.type}).`);
  const sig = (bytes: number[]) => bytes.every((b, i) => head[i] === b);
  const ok =
    file.type === "image/png" ? sig([0x89, 0x50, 0x4e, 0x47]) :
    file.type === "image/jpeg" ? sig([0xff, 0xd8, 0xff]) :
    file.type === "image/gif" ? sig([0x47, 0x49, 0x46]) :
    file.type === "image/webp" ? sig([0x52, 0x49, 0x46, 0x46]) :
    file.type === "application/pdf" ? sig([0x25, 0x50, 0x44, 0x46]) :
    // text formats: reject anything that looks like markup/binary
    !/<\s*(script|html|svg)/i.test(new TextDecoder().decode(head)) && !head.includes(0);
  if (!ok) throw new UserFacingError("The file content does not match its declared type.");
  return file.type;
}

export async function storeFile(
  db: SupabaseClient<Database>,
  params: { workspaceId: string; brandId: string | null; kind: FileKind; name: string; mimeType: string; bytes: Uint8Array; userId: string | null; actor?: "human" | "agent" | "system" },
) {
  const safe = sanitizeFilename(params.name);
  const path = `${params.workspaceId}/${params.brandId ?? "workspace"}/${params.kind}s/${randomUUID()}-${safe}`;
  const up = await db.storage.from("pod-lab").upload(path, params.bytes, { contentType: params.mimeType, upsert: false });
  if (up.error) throw new UserFacingError(`Upload failed: ${up.error.message}`);
  const row = await db
    .from("files")
    .insert({
      workspace_id: params.workspaceId,
      brand_id: params.brandId,
      path,
      name: safe,
      mime_type: params.mimeType,
      size_bytes: params.bytes.byteLength,
      kind: params.kind,
      uploaded_by: params.userId,
      uploaded_by_actor: params.actor ?? "human",
    })
    .select("*")
    .single();
  if (row.error) {
    await db.storage.from("pod-lab").remove([path]);
    throw new UserFacingError(describeDbError(row.error, "Could not record the file."));
  }
  return row.data;
}
