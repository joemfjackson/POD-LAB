/**
 * Opportunity scoring. Scores are multi-dimensional (0–10 each, with an
 * explanation). The profile helpers summarise them WITHOUT collapsing the
 * decision into one opaque number: the UI always shows every dimension, and
 * blocking weaknesses are surfaced explicitly.
 */

export const SCORE_DIMENSIONS = [
  "demand",
  "identity_strength",
  "giftability",
  "personalization",
  "product_depth",
  "content_depth",
  "margin_potential",
  "competitive_opportunity",
  "trend_resilience",
  "brandability",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const DIMENSION_META: Record<ScoreDimension, { label: string; question: string; weight: number; critical: boolean }> = {
  demand: { label: "Demand", question: "Are people actively looking for / buying this?", weight: 1.5, critical: true },
  identity_strength: { label: "Identity strength", question: "Do buyers wear this as part of who they are?", weight: 1.3, critical: false },
  giftability: { label: "Giftability", question: "Do others buy it for them?", weight: 0.8, critical: false },
  personalization: { label: "Personalization", question: "Can products be personalised meaningfully?", weight: 0.6, critical: false },
  product_depth: { label: "Product depth", question: "How many viable product categories?", weight: 0.9, critical: false },
  content_depth: { label: "Content depth", question: "Is there enough to say to sustain content?", weight: 0.8, critical: false },
  margin_potential: { label: "Margin potential", question: "Will buyers pay premium prices?", weight: 1.3, critical: true },
  competitive_opportunity: { label: "Competitive opportunity", question: "Is the space beatable on quality/positioning?", weight: 1.1, critical: true },
  trend_resilience: { label: "Trend resilience", question: "Will this still matter in 2–3 years?", weight: 0.9, critical: false },
  brandability: { label: "Brandability", question: "Can a premium, ownable brand exist here?", weight: 1.0, critical: false },
};

export interface DimensionScore {
  dimension: ScoreDimension;
  score: number;
  explanation: string;
}

export type ScoreTier = "strong" | "promising" | "mixed" | "weak" | "incomplete";

export interface ScoreProfile {
  coverage: number;
  average: number | null;
  weightedIndex: number | null;
  strengths: ScoreDimension[];
  weaknesses: ScoreDimension[];
  blockingWeaknesses: ScoreDimension[];
  spread: number | null;
  tier: ScoreTier;
  summary: string;
}

export function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.min(10, Math.max(0, v)) * 10) / 10;
}

export function scoreProfile(scores: readonly DimensionScore[]): ScoreProfile {
  const byDim = new Map<ScoreDimension, number>();
  for (const s of scores) byDim.set(s.dimension, clampScore(s.score));
  const coverage = byDim.size / SCORE_DIMENSIONS.length;

  if (byDim.size === 0) {
    return {
      coverage: 0,
      average: null,
      weightedIndex: null,
      strengths: [],
      weaknesses: [],
      blockingWeaknesses: [],
      spread: null,
      tier: "incomplete",
      summary: "No scores yet.",
    };
  }

  const values = [...byDim.values()];
  const average = round1(values.reduce((a, b) => a + b, 0) / values.length);
  let wSum = 0;
  let wTotal = 0;
  for (const [dim, v] of byDim) {
    wSum += v * DIMENSION_META[dim].weight;
    wTotal += DIMENSION_META[dim].weight;
  }
  const weightedIndex = round1(wSum / wTotal);
  const strengths = SCORE_DIMENSIONS.filter((d) => (byDim.get(d) ?? -1) >= 7);
  const weaknesses = SCORE_DIMENSIONS.filter((d) => byDim.has(d) && (byDim.get(d) ?? 11) <= 4);
  const blockingWeaknesses = weaknesses.filter((d) => DIMENSION_META[d].critical);
  const spread = round1(Math.max(...values) - Math.min(...values));

  let tier: ScoreTier;
  if (coverage < 0.7) tier = "incomplete";
  else if (blockingWeaknesses.length > 0) tier = weightedIndex >= 6 ? "mixed" : "weak";
  else if (weightedIndex >= 7.5) tier = "strong";
  else if (weightedIndex >= 6) tier = "promising";
  else if (weightedIndex >= 4.5) tier = "mixed";
  else tier = "weak";

  const parts: string[] = [];
  if (strengths.length) parts.push(`Strong on ${strengths.map((d) => DIMENSION_META[d].label.toLowerCase()).join(", ")}`);
  if (blockingWeaknesses.length)
    parts.push(`blocking weakness in ${blockingWeaknesses.map((d) => DIMENSION_META[d].label.toLowerCase()).join(", ")}`);
  else if (weaknesses.length) parts.push(`weak on ${weaknesses.map((d) => DIMENSION_META[d].label.toLowerCase()).join(", ")}`);
  if (coverage < 1) parts.push(`${SCORE_DIMENSIONS.length - byDim.size} dimension(s) unscored`);

  return {
    coverage,
    average,
    weightedIndex,
    strengths,
    weaknesses,
    blockingWeaknesses,
    spread,
    tier,
    summary: parts.length ? `${capitalize(parts.join("; "))}.` : "Balanced profile with no standout strengths or weaknesses.",
  };
}

// ---------------------------------------------------------------------------
// Evidence-based confidence
// ---------------------------------------------------------------------------

export type EvidenceKind = "measured_fact" | "observed_signal" | "inferred_conclusion" | "assumption";
export type Confidence = "low" | "medium" | "high";
export type ResearchMode = "live" | "model_only" | "demo" | "manual";

const CONF_RANK: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

/**
 * Confidence the evidence can actually support. Without live, sourced evidence
 * confidence can never exceed "low", whatever the model claims.
 */
export function evidenceConfidenceCeiling(
  evidence: ReadonlyArray<{ kind: EvidenceKind; sourced: boolean }>,
  mode: ResearchMode,
): Confidence {
  if (mode === "demo" || mode === "model_only") return "low";
  const sourced = evidence.filter((e) => e.sourced && (e.kind === "measured_fact" || e.kind === "observed_signal")).length;
  const assumptions = evidence.filter((e) => e.kind === "assumption").length;
  const ratio = evidence.length ? assumptions / evidence.length : 1;
  if (sourced >= 6 && ratio <= 0.3) return "high";
  if (sourced >= 3 && ratio <= 0.6) return "medium";
  return "low";
}

export function capConfidence(claimed: Confidence, ceiling: Confidence): Confidence {
  return CONF_RANK[claimed] <= CONF_RANK[ceiling] ? claimed : ceiling;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
