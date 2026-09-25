import type { TrendOutput } from "../schemas";
import { DEMO_LABEL } from "./util";

export function demoTrends(input: { focus: string; max_trends: number }): TrendOutput {
  const base: TrendOutput["trends"] = [
    { name: "AI-native professions", category: "ai_tech", summary: "New job titles built around AI tooling (demo example).", velocity: "unknown", estimated_lifespan: "multi_year", pod_relevance: 7, recommended_action: "Send to Opportunity Scout for investigation.", candidate_niches: ["Prompt engineers", "AI researchers", "ML ops engineers"], evidence: [] },
    { name: "Quiet-luxury workwear", category: "aesthetic", summary: "Understated premium utility aesthetics (demo example).", velocity: "unknown", estimated_lifespan: "months", pod_relevance: 6, recommended_action: "Watch; consider as a visual direction.", candidate_niches: ["Tradespeople premium apparel"], evidence: [] },
    { name: "Hobby revival communities", category: "hobby", summary: "Analog hobbies with strong identity (demo example).", velocity: "unknown", estimated_lifespan: "multi_year", pod_relevance: 7, recommended_action: "Send to Opportunity Scout.", candidate_niches: ["Film photographers", "Mechanical keyboard builders", "Balloon artists"], evidence: [] },
    { name: "Sports-parent identity", category: "social", summary: "Parents identifying with their kids' sports (demo example).", velocity: "unknown", estimated_lifespan: "evergreen", pod_relevance: 8, recommended_action: "Send to Opportunity Scout; strong giftability hypothesis.", candidate_niches: ["Travel-ball parents", "Swim parents", "Hockey parents"], evidence: [] },
  ];
  return {
    scan_summary: `${DEMO_LABEL} Focus: ${input.focus}`,
    trends: base.slice(0, Math.max(1, Math.min(input.max_trends, base.length))).map((t) => ({
      ...t,
      evidence: [{ claim: "Demo placeholder — no trend data was retrieved.", kind: "assumption" as const, source_ref: null, quote_snippet: null, confidence: "low" as const }],
    })),
  };
}
