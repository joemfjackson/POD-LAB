import { describe, expect, it } from "vitest";
import { demoArchitect } from "@/agents/demo/architect";
import { demoCreative } from "@/agents/demo/creative";
import { demoGrowth } from "@/agents/demo/growth";
import { demoProduct } from "@/agents/demo/product";
import { demoScout } from "@/agents/demo/scout";
import { demoStore } from "@/agents/demo/store";
import { demoTrends } from "@/agents/demo/trends";
import { missionSubject } from "@/agents/demo/util";
import { deterministicBriefing } from "@/agents/handlers/director";
import {
  architectOutputSchema,
  creativeOutputSchema,
  directorOutputSchema,
  growthOutputSchema,
  productOutputSchema,
  scoutOutputSchema,
  storeOutputSchema,
  trendOutputSchema,
} from "@/agents/schemas";
import { DEFAULT_FEE_MODEL } from "@/domain/finance";
import { MOCK_CATALOG } from "@/providers/fulfillment/mock-catalog";

describe("demo generators produce schema-valid output", () => {
  it("scout (discover + investigate) is valid and never cites sources", () => {
    const d = demoScout({ mission: { prompt: "Research 8 HVAC-related niches", mission_type: "discover" }, constraints: { max_candidates: 8 } });
    expect(scoutOutputSchema.parse(d).opportunities).toHaveLength(8);
    expect(d.opportunities.flatMap((o) => o.evidence).every((e) => e.kind === "assumption" && e.source_ref === null)).toBe(true);
    const ai = demoScout({ mission: { prompt: "Investigate AI", mission_type: "investigate" }, constraints: { max_candidates: 1 }, brand: { niche: "AI / Artificial Superintelligence" } });
    expect(scoutOutputSchema.parse(ai).opportunities[0]!.niche).toMatch(/Superintelligence/);
    expect(ai.opportunities[0]!.confidence).toBe("low");
  });

  it("is deterministic", () => {
    const a = demoScout({ mission: { prompt: "Find 3 nurse niches", mission_type: "discover" }, constraints: { max_candidates: 3 } });
    const b = demoScout({ mission: { prompt: "Find 3 nurse niches", mission_type: "discover" }, constraints: { max_candidates: 3 } });
    expect(a).toEqual(b);
  });

  it("architect keeps hypothesis names and labels trademark notes preliminary", () => {
    const d = architectOutputSchema.parse(demoArchitect({ brand: { working_title: "AI / Superintelligence", niche: "AI / Artificial Superintelligence", audience: null }, hypothesis_names: ["RECURSIVE", "SYNTH"], name_count: 8 }));
    expect(d.name_candidates.map((n) => n.name)).toEqual(expect.arrayContaining(["RECURSIVE", "SYNTH"]));
    expect(d.name_candidates.every((n) => /not a trademark clearance/i.test(n.trademark_notes))).toBe(true);
  });

  it("creative, product, store, growth, trends and director are valid", () => {
    const creative = creativeOutputSchema.parse(demoCreative({ brand: { niche: "AI / Artificial Superintelligence", name: "X" }, identity: null, mode: "full", parent: null, design_count: 8 }));
    expect(creative.visual_directions).toHaveLength(3);
    expect(creative.designs.map((d) => d.title)).toContain("THE CURVE GOES VERTICAL");
    const deriv = creativeOutputSchema.parse(demoCreative({ brand: { niche: "teachers", name: "X" }, identity: null, mode: "derivatives", parent: { title: "P", concept: "c", collection: null }, design_count: 2 }));
    expect(deriv.designs).toHaveLength(2);

    const catalog = MOCK_CATALOG.map((p) => ({ provider_sku: p.providerSku, blank_name: p.blankName, product_type: p.productType, decoration_method: p.decorationMethod, blank_cost: p.blankCost, decoration_cost: p.decorationCost, fulfillment_fee: p.fulfillmentFee, shipping_estimate_domestic: p.shippingEstimateDomestic }));
    const product = productOutputSchema.parse(demoProduct({ designs: [{ code: "DES-0001", title: "A", preferred_products: ["hat"], printing_method: "embroidery" }, { code: "DES-0002", title: "B", preferred_products: ["tee"], printing_method: "dtg" }], catalog, fee_model: DEFAULT_FEE_MODEL, max_products: 5 }));
    expect(product.selections[0]!.provider_sku).toMatch(/HAT/);
    expect(product.bundles).toHaveLength(1);

    storeOutputSchema.parse(demoStore({ brand: { name: "Brand", niche: "nurses", tagline: null, positioning: null, story: null }, collections: [{ name: "Core", description: null }], products: [{ code: "PRD-0001", title: "Tee", product_type: "tee", price: 30, design_concept: null }], free_shipping_threshold: 75 }));
    growthOutputSchema.parse(demoGrowth({ brand: { name: "Brand", niche: "nurses", audience: null }, products: [{ title: "Tee" }] }));
    trendOutputSchema.parse(demoTrends({ focus: "x", max_trends: 3 }));
    directorOutputSchema.parse(
      deterministicBriefing({ brands: [], stageCounts: {}, opportunityCounts: { candidate: 2 }, pendingApprovals: [], failedJobs7d: 1, activeJobs: 0, complianceFlags: 0, marginProblems7d: 0, revisitCandidates: [{ code: "OPP-0001", niche: "x", reason: "old" }] }),
    );
  });

  it("extracts mission subjects", () => {
    expect(missionSubject("Research 15 HVAC-related niches.")).toBe("HVAC-related");
    expect(missionSubject("Find 20 emerging identity-based POD niches")).toBe("identity-based");
    expect(missionSubject("Investigate whether artificial intelligence / superintelligence is a strong POD market.")).toBe("artificial intelligence / superintelligence");
  });
});
