import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/server/context";

/** Redirects to a short-lived signed URL (RLS decides whether the user may read it). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const file = await ctx.db.from("files").select("path, name, mime_type").eq("id", id).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!file.data) return new NextResponse("Not found", { status: 404 });
  const download = request.nextUrl.searchParams.get("download") === "1";
  const signed = await ctx.db.storage.from("pod-lab").createSignedUrl(file.data.path, 300, download ? { download: file.data.name } : undefined);
  if (signed.error || !signed.data) return new NextResponse("Unavailable", { status: 502 });
  return NextResponse.redirect(signed.data.signedUrl, { headers: { "cache-control": "no-store" } });
}
