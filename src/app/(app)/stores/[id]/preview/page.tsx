import type { Metadata } from "next";
import Link from "next/link";
import { Storefront } from "@/components/storefront/storefront";
import type { SfRoute } from "@/components/storefront/types";
import { DemoBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { getContext } from "@/server/context";
import { loadStorefront } from "@/server/queries/storefront";

export const metadata: Metadata = { title: "Store preview" };

export default async function StorePreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; product?: string; collection?: string; device?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getContext();
  const data = await loadStorefront(ctx, id);
  const device = sp.device === "mobile" ? "mobile" : "desktop";
  const slug = (v: string | undefined) => (v && /^[a-z0-9-]{1,80}$/.test(v) ? v : null);
  const route: SfRoute = slug(sp.product) ? { kind: "product", slug: slug(sp.product)! } : slug(sp.collection) ? { kind: "collection", slug: slug(sp.collection)! } : { kind: "page", slug: slug(sp.page) ?? "home" };
  const href = (r: SfRoute, d: string = device) => {
    const q = new URLSearchParams({ device: d });
    if (r.kind === "product") q.set("product", r.slug);
    else if (r.kind === "collection") q.set("collection", r.slug);
    else if (r.slug !== "home") q.set("page", r.slug);
    return `/stores/${id}/preview?${q.toString()}`;
  };
  const fonts = [...new Set([data.store.theme.fonts.heading, data.store.theme.fonts.body])].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`).join("&");

  return (
    <>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${fonts}&display=swap`} precedence="default" />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/stores/${id}`} className="text-muted hover:text-ink">
            ← {data.raw.code} {data.raw.name}
          </Link>
          <DemoBadge show={data.store.is_demo} />
          <span className="text-xs text-muted">Preview — checkout disabled</span>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Preview device">
          <Link href={href(route, "desktop")} aria-current={device === "desktop" ? "true" : undefined} className={buttonClass(device === "desktop" ? "primary" : "secondary", "sm")}>
            Desktop
          </Link>
          <Link href={href(route, "mobile")} aria-current={device === "mobile" ? "true" : undefined} className={buttonClass(device === "mobile" ? "primary" : "secondary", "sm")}>
            Mobile
          </Link>
        </div>
      </div>
      <div className={cn("mx-auto overflow-hidden rounded-lg border border-line-strong shadow-2xl", device === "mobile" ? "max-w-[390px]" : "max-w-full")} data-testid="storefront-preview">
        <Storefront store={data.store} route={route} pages={data.pages} products={data.products} collections={data.collections} href={(r) => href(r)} />
      </div>
    </>
  );
}
