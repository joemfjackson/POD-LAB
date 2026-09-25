/**
 * Experiment decision engine. Deterministic, threshold-based classification —
 * agents may narrate results but never declare winners on their own. Every
 * decision returns the checks and reasons that produced it.
 */

export type ExperimentDecision = "insufficient_data" | "keep_collecting" | "kill" | "iterate" | "clone" | "scale";

export type PrimaryMetric =
  | "ctr"
  | "conversion_rate"
  | "add_to_cart_rate"
  | "aov"
  | "roas"
  | "contribution_margin"
  | "cac"
  | "contribution_profit";

export interface DecisionRules {
  minSessions: number;
  minImpressions: number;
  minPurchases: number;
  minAdSpendUsd: number;
  minDaysRunning: number;
  killMaxConversionRate: number;
  killMaxCtr: number;
  killMaxContributionMargin: number;
  scaleMinRoas: number;
  scaleMinContributionMargin: number;
  scaleMinConversionRate: number;
  cloneMinCtr: number;
  iterateMinCtr: number;
  minLiftForWinner: number;
}

export const DEFAULT_DECISION_RULES: DecisionRules = {
  minSessions: 500,
  minImpressions: 5000,
  minPurchases: 10,
  minAdSpendUsd: 100,
  minDaysRunning: 7,
  killMaxConversionRate: 0.005,
  killMaxCtr: 0.004,
  killMaxContributionMargin: -0.1,
  scaleMinRoas: 2.5,
  scaleMinContributionMargin: 0.15,
  scaleMinConversionRate: 0.02,
  cloneMinCtr: 0.015,
  iterateMinCtr: 0.008,
  minLiftForWinner: 0.1,
};

export interface RawMetrics {
  impressions: number;
  clicks: number;
  sessions: number;
  productViews: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  grossRevenue: number;
  discounts: number;
  refunds: number;
  cogs: number;
  fulfillmentCost: number;
  shippingSubsidy: number;
  adSpend: number;
  repeatBuyers: number;
}

export const EMPTY_METRICS: RawMetrics = {
  impressions: 0,
  clicks: 0,
  sessions: 0,
  productViews: 0,
  addToCarts: 0,
  checkouts: 0,
  purchases: 0,
  grossRevenue: 0,
  discounts: 0,
  refunds: 0,
  cogs: 0,
  fulfillmentCost: 0,
  shippingSubsidy: 0,
  adSpend: 0,
  repeatBuyers: 0,
};

export interface DerivedMetrics extends RawMetrics {
  netRevenue: number;
  ctr: number | null;
  cpc: number | null;
  conversionRate: number | null;
  addToCartRate: number | null;
  checkoutRate: number | null;
  aov: number | null;
  cac: number | null;
  roas: number | null;
  grossProfit: number;
  contributionProfit: number;
  contributionMargin: number | null;
  repeatRate: number | null;
}

export function sumMetrics(rows: readonly Partial<RawMetrics>[]): RawMetrics {
  const out: RawMetrics = { ...EMPTY_METRICS };
  for (const row of rows) {
    for (const key of Object.keys(out) as (keyof RawMetrics)[]) {
      out[key] += Number(row[key] ?? 0);
    }
  }
  return out;
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function deriveMetrics(m: RawMetrics): DerivedMetrics {
  const netRevenue = m.grossRevenue - m.discounts - m.refunds;
  const grossProfit = netRevenue - m.cogs - m.fulfillmentCost - m.shippingSubsidy;
  const contributionProfit = grossProfit - m.adSpend;
  return {
    ...m,
    netRevenue,
    ctr: div(m.clicks, m.impressions),
    cpc: div(m.adSpend, m.clicks),
    conversionRate: div(m.purchases, m.sessions),
    addToCartRate: div(m.addToCarts, m.sessions),
    checkoutRate: div(m.checkouts, m.addToCarts),
    aov: div(m.grossRevenue - m.discounts, m.purchases),
    cac: m.adSpend > 0 ? div(m.adSpend, m.purchases) : null,
    roas: div(m.grossRevenue - m.discounts, m.adSpend),
    grossProfit,
    contributionProfit,
    contributionMargin: div(contributionProfit, netRevenue),
    repeatRate: div(m.repeatBuyers, m.purchases),
  };
}

export function metricValue(d: DerivedMetrics, metric: PrimaryMetric): number | null {
  switch (metric) {
    case "ctr":
      return d.ctr;
    case "conversion_rate":
      return d.conversionRate;
    case "add_to_cart_rate":
      return d.addToCartRate;
    case "aov":
      return d.aov;
    case "roas":
      return d.roas;
    case "contribution_margin":
      return d.contributionMargin;
    case "cac":
      return d.cac;
    case "contribution_profit":
      return d.contributionProfit;
  }
}

/** For CAC lower is better; for everything else higher is better. */
export function lowerIsBetter(metric: PrimaryMetric): boolean {
  return metric === "cac";
}

export interface VariantInput {
  id: string;
  key: string;
  name: string;
  isControl: boolean;
  metrics: RawMetrics;
}

export interface ThresholdCheck {
  name: string;
  required: number;
  actual: number;
  passed: boolean;
  unit: "count" | "usd" | "days" | "ratio";
}

export interface VariantResult {
  id: string;
  key: string;
  name: string;
  isControl: boolean;
  derived: DerivedMetrics;
  primary: number | null;
}

export interface DecisionResult {
  decision: ExperimentDecision;
  reasons: string[];
  checks: ThresholdCheck[];
  variants: VariantResult[];
  totals: DerivedMetrics;
  winner: { variantId: string; key: string; lift: number | null; clear: boolean } | null;
}

export interface ExperimentInput {
  primaryMetric: PrimaryMetric;
  minimumSample: number;
  startDate: string | null;
  asOf?: Date;
}

export function daysRunning(startDate: string | null, asOf: Date = new Date()): number {
  if (!startDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((asOf.getTime() - start) / 86_400_000) + 1);
}

export function classifyExperiment(
  experiment: ExperimentInput,
  variants: readonly VariantInput[],
  rules: DecisionRules = DEFAULT_DECISION_RULES,
): DecisionResult {
  const results: VariantResult[] = variants.map((v) => {
    const derived = deriveMetrics(v.metrics);
    return { id: v.id, key: v.key, name: v.name, isControl: v.isControl, derived, primary: metricValue(derived, experiment.primaryMetric) };
  });
  const totals = deriveMetrics(sumMetrics(variants.map((v) => v.metrics)));
  const paid = totals.adSpend > 0 || totals.impressions > 0;
  const days = daysRunning(experiment.startDate, experiment.asOf);
  const reasons: string[] = [];

  // Traffic sufficiency — required for ANY decision.
  const minSessions = Math.max(rules.minSessions, experiment.minimumSample);
  const checks: ThresholdCheck[] = [
    { name: "Sessions", required: minSessions, actual: totals.sessions, passed: totals.sessions >= minSessions, unit: "count" },
    { name: "Days running", required: rules.minDaysRunning, actual: days, passed: days >= rules.minDaysRunning, unit: "days" },
  ];
  if (paid) {
    checks.push(
      { name: "Impressions", required: rules.minImpressions, actual: totals.impressions, passed: totals.impressions >= rules.minImpressions, unit: "count" },
      { name: "Ad spend", required: rules.minAdSpendUsd, actual: round2(totals.adSpend), passed: totals.adSpend >= rules.minAdSpendUsd, unit: "usd" },
    );
  }
  const purchaseCheck: ThresholdCheck = {
    name: "Purchases",
    required: rules.minPurchases,
    actual: totals.purchases,
    passed: totals.purchases >= rules.minPurchases,
    unit: "count",
  };
  checks.push(purchaseCheck);

  const variantsWithTraffic = results.filter((r) => r.derived.sessions > 0);
  const failedTraffic = checks.filter((c) => c !== purchaseCheck && !c.passed);
  if (failedTraffic.length > 0 || variantsWithTraffic.length === 0) {
    for (const c of failedTraffic) reasons.push(`${c.name}: ${fmtCheck(c.actual, c.unit)} of ${fmtCheck(c.required, c.unit)} required.`);
    if (variantsWithTraffic.length === 0) reasons.push("No variant has recorded sessions yet.");
    return { decision: "insufficient_data", reasons, checks, variants: results, totals, winner: null };
  }

  const winner = pickWinner(results, experiment.primaryMetric, rules.minLiftForWinner);
  const best = results.find((r) => r.id === winner?.variantId) ?? variantsWithTraffic[0]!;
  const b = best.derived;

  if (winner) {
    reasons.push(
      winner.clear
        ? `Variant ${winner.key} leads on ${label(experiment.primaryMetric)}${winner.lift !== null ? ` by ${pctStr(winner.lift)}` : ""}.`
        : `No clear winner on ${label(experiment.primaryMetric)} (lift below ${pctStr(rules.minLiftForWinner)}).`,
    );
  }

  // Kill: enough traffic, and even the best variant is clearly failing.
  const convFail = b.conversionRate !== null && b.conversionRate < rules.killMaxConversionRate;
  const ctrFail = paid && b.ctr !== null && b.ctr < rules.killMaxCtr;
  const marginFail =
    purchaseCheck.passed && b.contributionMargin !== null && b.contributionMargin < rules.killMaxContributionMargin;
  if (convFail && (ctrFail || !paid || totals.purchases === 0)) {
    reasons.push(`Best conversion rate ${pctStr(b.conversionRate)} is below the kill threshold ${pctStr(rules.killMaxConversionRate)}.`);
    if (ctrFail) reasons.push(`Best CTR ${pctStr(b.ctr)} is below ${pctStr(rules.killMaxCtr)}.`);
    return { decision: "kill", reasons, checks, variants: results, totals, winner };
  }
  if (marginFail) {
    reasons.push(
      `Best contribution margin ${pctStr(b.contributionMargin)} is below the kill threshold ${pctStr(rules.killMaxContributionMargin)}.`,
    );
    return { decision: "kill", reasons, checks, variants: results, totals, winner };
  }

  if (!purchaseCheck.passed) {
    reasons.push(
      `Traffic is sufficient but purchases (${totals.purchases}) are below the ${rules.minPurchases} needed for a positive decision.`,
    );
    return { decision: "keep_collecting", reasons, checks, variants: results, totals, winner };
  }

  const scaleChecks = [
    { ok: b.contributionMargin !== null && b.contributionMargin >= rules.scaleMinContributionMargin, text: `contribution margin ${pctStr(b.contributionMargin)} ≥ ${pctStr(rules.scaleMinContributionMargin)}` },
    { ok: b.conversionRate !== null && b.conversionRate >= rules.scaleMinConversionRate, text: `conversion rate ${pctStr(b.conversionRate)} ≥ ${pctStr(rules.scaleMinConversionRate)}` },
  ];
  if (b.adSpend > 0) {
    scaleChecks.push({ ok: b.roas !== null && b.roas >= rules.scaleMinRoas, text: `ROAS ${b.roas?.toFixed(2) ?? "—"} ≥ ${rules.scaleMinRoas}` });
  }
  if (scaleChecks.every((c) => c.ok)) {
    reasons.push(`All scale thresholds met: ${scaleChecks.map((c) => c.text).join("; ")}.`);
    return { decision: "scale", reasons, checks, variants: results, totals, winner };
  }
  const missed = scaleChecks.filter((c) => !c.ok).map((c) => c.text.replace("≥", "below"));

  const positive = b.contributionProfit > 0;
  if (positive && ((b.ctr !== null && b.ctr >= rules.cloneMinCtr) || (winner?.clear ?? false))) {
    reasons.push(`Profitable (${usd(b.contributionProfit)} contribution) with a replicable signal; scale blocked by: ${missed.join(", ")}.`);
    return { decision: "clone", reasons, checks, variants: results, totals, winner };
  }

  if ((b.ctr === null || b.ctr >= rules.iterateMinCtr) && (b.contributionMargin ?? 0) > rules.killMaxContributionMargin) {
    reasons.push(`Interest exists but economics/conversion need work: ${missed.join(", ")}.`);
    return { decision: "iterate", reasons, checks, variants: results, totals, winner };
  }

  reasons.push(`Weak engagement and no thresholds met: ${missed.join(", ")}.`);
  return { decision: "kill", reasons, checks, variants: results, totals, winner };
}

function pickWinner(
  results: readonly VariantResult[],
  metric: PrimaryMetric,
  minLift: number,
): DecisionResult["winner"] {
  const scored = results.filter((r) => r.primary !== null && r.derived.sessions > 0);
  if (scored.length === 0) return null;
  const lower = lowerIsBetter(metric);
  const sorted = [...scored].sort((a, b) => (lower ? a.primary! - b.primary! : b.primary! - a.primary!));
  const top = sorted[0]!;
  if (sorted.length === 1) return { variantId: top.id, key: top.key, lift: null, clear: false };
  const baseline = scored.find((r) => r.isControl && r.id !== top.id) ?? sorted[1]!;
  const base = baseline.primary!;
  let lift: number | null = null;
  if (base !== 0) lift = lower ? (base - top.primary!) / Math.abs(base) : (top.primary! - base) / Math.abs(base);
  return { variantId: top.id, key: top.key, lift, clear: lift !== null && lift >= minLift };
}

function label(metric: PrimaryMetric): string {
  return metric.replace(/_/g, " ");
}
function pctStr(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(2)}%`;
}
function usd(v: number): string {
  return `$${v.toFixed(2)}`;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function fmtCheck(v: number, unit: ThresholdCheck["unit"]): string {
  if (unit === "usd") return `$${v.toFixed(2)}`;
  if (unit === "ratio") return pctStr(v);
  return String(v);
}
