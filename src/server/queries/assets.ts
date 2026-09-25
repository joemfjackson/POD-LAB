import "server-only";
import type { UserSupabaseClient } from "@/lib/supabase/server";

/** Batch signed URLs (10 min) for private storage objects. */
export async function signedUrlMap(db: UserSupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)].filter(Boolean);
  if (!unique.length) return new Map();
  const res = await db.storage.from("pod-lab").createSignedUrls(unique, 600);
  const map = new Map<string, string>();
  for (const r of res.data ?? []) if (r.signedUrl && r.path) map.set(r.path, r.signedUrl);
  return map;
}

/** Latest image asset per design → signed thumbnail URL. */
export async function designThumbnails(db: UserSupabaseClient, designIds: string[]): Promise<Map<string, string>> {
  if (!designIds.length) return new Map();
  const assets = await db
    .from("design_assets")
    .select("design_id, created_at, files(path, mime_type)")
    .in("design_id", designIds)
    .in("kind", ["artwork", "mockup"])
    .order("created_at", { ascending: false });
  const latest = new Map<string, string>();
  for (const a of assets.data ?? []) {
    if (!latest.has(a.design_id) && a.files?.path && a.files.mime_type.startsWith("image/")) latest.set(a.design_id, a.files.path);
  }
  const urls = await signedUrlMap(db, [...latest.values()]);
  return new Map([...latest.entries()].map(([id, path]) => [id, urls.get(path) ?? ""]).filter(([, u]) => u) as Array<[string, string]>);
}
