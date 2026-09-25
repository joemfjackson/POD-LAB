import { SCORE_DIMENSIONS, DIMENSION_META } from "@/domain/scoring";
import type { ScoutOpportunity, ScoutOutput } from "../schemas";
import { DEMO_LABEL, isAiSiSubject, missionSubject, scoreBetween, seededRandom, titleCase } from "./util";

const ANGLES = [
  { suffix: "professionals", audience: "working professionals who identify strongly with the craft", products: ["tee", "hat", "hoodie"] },
  { suffix: "apprentices & new entrants", audience: "people early in the path, proud of joining", products: ["tee", "sticker", "hat"] },
  { suffix: "business owners", audience: "owner-operators who want premium merch for themselves and crews", products: ["hoodie", "hat", "jacket"] },
  { suffix: "families & partners", audience: "gift buyers: partners, parents and kids of the community", products: ["tee", "mug", "tote"] },
  { suffix: "veterans & lifers", audience: "long-tenured members who value heritage and insider references", products: ["hat", "hoodie", "tee"] },
  { suffix: "women in the community", audience: "an under-served segment with few well-designed options", products: ["crewneck", "tee", "tote"] },
  { suffix: "hobbyists", audience: "weekend enthusiasts who talk about it constantly", products: ["tee", "sticker", "mug"] },
  { suffix: "competitive scene", audience: "people who compete, rank and travel for events", products: ["hoodie", "hat", "tee"] },
  { suffix: "students", audience: "people training or studying for it", products: ["tee", "hoodie", "sticker"] },
  { suffix: "content creators", audience: "creators and fans of the online side of the community", products: ["hoodie", "tee", "poster"] },
  { suffix: "collectors", audience: "people who collect gear and memorabilia", products: ["poster", "hat", "tee"] },
  { suffix: "local clubs", audience: "clubs and meetups ordering group merch", products: ["tee", "hat", "tote"] },
];

function opportunity(niche: string, audience: string, products: string[], seed: string): ScoutOpportunity {
  const rand = seededRandom(seed);
  const scores = SCORE_DIMENSIONS.map((dimension) => ({
    dimension,
    score: scoreBetween(rand, 3.5, 8.8),
    explanation: `Demo placeholder for ${DIMENSION_META[dimension].label.toLowerCase()}: "${DIMENSION_META[dimension].question}" — not researched.`,
  }));
  return {
    niche,
    hypothesis: `${niche} may support an identity-driven brand with premium positioning. (Demo hypothesis — unvalidated.)`,
    audience,
    summary: `${DEMO_LABEL} This placeholder shows the structure of an Opportunity Scout report for "${niche}".`,
    scores,
    evidence: [
      {
        claim: `No live research was performed for ${niche}; all statements are assumptions for demonstration.`,
        kind: "assumption",
        source_ref: null,
        quote_snippet: null,
        confidence: "low",
      },
      {
        claim: `Identity-based communities often buy apparel that signals membership (general assumption, not measured for ${niche}).`,
        kind: "assumption",
        source_ref: null,
        quote_snippet: null,
        confidence: "low",
      },
    ],
    strongest_evidence: ["Demo: no evidence gathered — configure an AI and research provider for a real run."],
    strongest_risks: ["Demo: demand is unmeasured.", "Demo: competitive landscape unknown."],
    strongest_signal: "Demo placeholder — no signal measured.",
    biggest_risk: "Unvalidated demand (demo data).",
    recommended_customer: audience,
    recommended_brand_angle: `Premium, insider-coded brand for ${niche.toLowerCase()} (demo suggestion).`,
    recommended_first_products: products,
    recommended_test_strategy: "Small organic test: 6–8 designs, mockup-only landing page, measure CTR and email sign-ups before production (demo suggestion).",
    suggested_sub_niches: [],
    seasonality: "unknown",
    trend_durability: "Unknown — not researched (demo).",
    ip_risk_notes: "Not screened in demo mode. Run IP / Compliance on any concepts.",
    geographic_notes: "",
    cultural_risk_notes: "",
    confidence: "low",
    research_dimensions: {
      demand_indicators: "Not measured (demo).",
      community_size: "Not measured (demo).",
      community_engagement: "Not measured (demo).",
      purchase_intent: "Not measured (demo).",
      passion_level: "Not measured (demo).",
      personalization_opportunity: "Not assessed (demo).",
      viable_design_count_estimate: Math.round(10 + rand() * 30),
      viable_product_categories: products,
      average_selling_price_range_usd: null,
      likely_margin: "Not assessed (demo).",
      market_saturation: "Not assessed (demo).",
      competitor_quality: "Not assessed (demo).",
      social_media_potential: "Not assessed (demo).",
      organic_search_potential: "Not assessed (demo).",
      advertising_addressability: "Not assessed (demo).",
      repeat_purchase_potential: "Not assessed (demo).",
      premium_positioning_potential: "Not assessed (demo).",
      subcollection_potential: "Not assessed (demo).",
    },
  };
}

function aiSiOpportunity(seed: string): ScoutOpportunity {
  const base = opportunity(
    "AI / Artificial Superintelligence",
    "Technologists, researchers, founders and AI-curious professionals who see themselves as early to the intelligence transition",
    ["tee", "hoodie", "hat"],
    seed,
  );
  return {
    ...base,
    hypothesis:
      "A premium future-intelligence lifestyle / streetwear brand (research lab × technical typography × premium streetwear) can own AI/AGI/ASI identity merch that today is dominated by jokey or cliché designs. (Sample hypothesis.)",
    recommended_brand_angle: "Research-laboratory aesthetic: issued-equipment utility, technical typography, restraint — no robots, brains or circuit clichés.",
    recommended_first_products: ["heavyweight tee", "premium hoodie", "embroidered dad hat"],
    suggested_sub_niches: ["Alignment / AI safety", "Singularity & acceleration", "Human // Machine", "Research lab uniform", "PRE-AGI era markers"],
    seasonality: "evergreen",
    trend_durability: "Sample assumption: long-running theme while AI remains a dominant cultural topic; specific memes will rotate.",
    ip_risk_notes: "Avoid AI company and product names, model names, chat-assistant logos and film references (e.g. well-known fictional AI systems).",
  };
}

export function demoScout(input: { mission: { prompt: string; mission_type: string }; constraints: { max_candidates: number }; brand?: { niche: string } | null }): ScoutOutput {
  const subjectText = input.brand?.niche ?? missionSubject(input.mission.prompt);
  const seed = `${input.mission.prompt}|${subjectText}`;
  if (input.mission.mission_type !== "discover" || isAiSiSubject(subjectText)) {
    const opp = isAiSiSubject(subjectText) ? aiSiOpportunity(seed) : opportunity(titleCase(subjectText), `People who identify with ${subjectText}`, ["tee", "hoodie", "hat"], seed);
    return { mission_summary: `${DEMO_LABEL} Investigated one opportunity: ${opp.niche}.`, method_note: "Demo provider: no model call, no web research. Every claim is labelled as an assumption.", opportunities: [opp] };
  }
  const subject = titleCase(subjectText.replace(/[- ]related$/i, ""));
  const n = Math.min(input.constraints.max_candidates, ANGLES.length);
  const opportunities = ANGLES.slice(0, n).map((a, i) => opportunity(`${subject} ${a.suffix}`, `${a.audience} (${subject})`, a.products, `${seed}|${i}`));
  return {
    mission_summary: `${DEMO_LABEL} Generated ${opportunities.length} placeholder opportunities for "${subject}".`,
    method_note: "Demo provider: no model call, no web research. Every claim is labelled as an assumption.",
    opportunities,
  };
}
