import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { fulfillEngineStoreAdapter, genericExportAdapter, nextjsAdapter, shopifyAdapter } from "@/providers/commerce/adapters";
import type { StoreAdapter } from "@/providers/commerce/types";
import { getContext } from "@/server/context";
import { buildStorePackage } from "@/server/services/exports";
import { storeFile } from "@/server/services/files";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const env = serverEnv();
  const adapters: Record<string, StoreAdapter> = {
    generic_export: genericExportAdapter,
    nextjs: nextjsAdapter,
    shopify: shopifyAdapter({ storeDomain: env.SHOPIFY_STORE_DOMAIN, accessToken: env.SHOPIFY_ADMIN_ACCESS_TOKEN, apiVersion: env.SHOPIFY_API_VERSION }),
    fulfill_engine: fulfillEngineStoreAdapter(Boolean(env.FULFILL_ENGINE_API_BASE_URL && env.FULFILL_ENGINE_API_KEY)),
  };
  const adapter = adapters[request.nextUrl.searchParams.get("adapter") ?? "generic_export"];
  if (!adapter) return new NextResponse("Unknown export format", { status: 400 });
  let pkg;
  try {
    pkg = await buildStorePackage(ctx.db, id);
  } catch {
    return new NextResponse("Store not found", { status: 404 });
  }
  const artifact = adapter.export(pkg);
  if (!artifact) return new NextResponse("This adapter has no offline export", { status: 400 });
  // Keep a copy of every export in Storage (workspace/brand/exports/) for the record.
  const brand = await ctx.db.from("stores").select("brand_id").eq("id", id).single();
  if (ctx.role !== "viewer" && brand.data) {
    await storeFile(ctx.db, {
      workspaceId: ctx.workspace.id,
      brandId: brand.data.brand_id,
      kind: "export",
      name: artifact.filename.replace(/\.csv$/, ".csv"),
      mimeType: artifact.contentType === "text/csv" ? "text/csv" : "application/json",
      bytes: new TextEncoder().encode(artifact.body),
      userId: ctx.user.id,
    }).catch(() => undefined);
  }
  return new NextResponse(artifact.body, {
    headers: {
      "content-type": `${artifact.contentType}; charset=utf-8`,
      "content-disposition": `attachment; filename="${artifact.filename}"`,
      "cache-control": "no-store",
    },
  });
}
