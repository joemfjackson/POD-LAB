import type { AgentKey } from "@/domain/lifecycle";

export interface BrandRef {
  id: string;
  niche: string;
  opportunity_id: string | null;
}

/** Minimal valid payload to run an agent for a brand (UI buttons, command bar). */
export function defaultPayload(agent: AgentKey, brand: BrandRef | null): Record<string, unknown> {
  switch (agent) {
    case "opportunity_scout":
      return brand
        ? { prompt: `Investigate ${brand.niche} as a print-on-demand market`, mission_type: "investigate", brand_id: brand.id, ...(brand.opportunity_id ? { opportunity_id: brand.opportunity_id } : {}) }
        : { prompt: "Find emerging identity-based POD niches", mission_type: "discover", max_candidates: 10 };
    case "brand_architect":
    case "ip_compliance":
    case "product_profit":
    case "store_builder":
    case "growth":
      if (!brand) throw new Error("This agent needs a brand");
      return { brand_id: brand.id };
    case "creative_director":
      if (!brand) throw new Error("This agent needs a brand");
      return { brand_id: brand.id, mode: "full" };
    case "experiment_analyst":
      return brand ? { brand_id: brand.id } : {};
    case "trend_watcher":
      return {};
    case "director":
      return { period: "daily" };
  }
}
