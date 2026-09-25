import "server-only";
import type { AppContext } from "../context";

const HREF: Record<string, (id: string, brandId: string | null) => string> = {
  brand: (id) => `/brands/${id}`,
  opportunity: (id) => `/opportunities/${id}`,
  design: (id) => `/design-studio/${id}`,
  product: (_id, brandId) => (brandId ? `/brands/${brandId}/products` : "/products"),
  experiment: (id) => `/experiments/${id}`,
  agent: () => `/agents`,
  note: (_id, brandId) => (brandId ? `/brands/${brandId}/notes` : "/brands"),
  trend: () => `/trends`,
  insight: () => `/insights`,
};

export interface SearchHit {
  kind: string;
  id: string;
  code: string | null;
  title: string;
  subtitle: string | null;
  href: string;
}

export async function searchWorkspace(ctx: AppContext, q: string): Promise<SearchHit[]> {
  const res = await ctx.db.rpc("search_workspace", { p_workspace: ctx.workspace.id, p_query: q });
  if (res.error) return [];
  return (res.data ?? []).map((r) => ({
    kind: r.kind,
    id: r.id,
    code: r.code,
    title: r.title,
    subtitle: r.subtitle,
    href: (HREF[r.kind] ?? (() => "/dashboard"))(r.id, r.brand_id),
  }));
}
