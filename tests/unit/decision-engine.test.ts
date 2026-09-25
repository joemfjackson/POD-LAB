import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECISION_RULES,
  EMPTY_METRICS,
  classifyExperiment,
  daysRunning,
  deriveMetrics,
  type RawMetrics,
  type VariantInput,
} from "@/domain/decision-engine";

const asOf = new Date("2026-09-25T00:00:00Z");
const exp = { primaryMetric: "conversion_rate" as const, minimumSample: 500, startDate: "2026-09-01", asOf };
const v = (key: string, m: Partial<RawMetrics>, isControl = key === "A"): VariantInput => ({
  id: key,
  key,
  name: `Variant ${key}`,
  isControl,
  metrics: { ...EMPTY_METRICS, ...m },
});

describe("decision engine", () => {
  it("derives funnel metrics", () => {
    const d = deriveMetrics({ ...EMPTY_METRICS, impressions: 1000, clicks: 20, sessions: 18, purchases: 2, grossRevenue: 80, adSpend: 40, cogs: 30 });
    expect(d.ctr).toBe(0.02);
    expect(d.cpc).toBe(2);
    expect(d.conversionRate).toBeCloseTo(0.111, 3);
    expect(d.aov).toBe(40);
    expect(d.cac).toBe(20);
    expect(d.roas).toBe(2);
    expect(d.contributionProfit).toBe(10);
    expect(d.ctr === null || d.ctr >= 0).toBe(true);
  });

  it("counts running days inclusively", () => {
    expect(daysRunning("2026-09-25", asOf)).toBe(1);
    expect(daysRunning(null, asOf)).toBe(0);
  });

  it("returns insufficient_data with reasons below the sample threshold", () => {
    const r = classifyExperiment(exp, [v("A", { sessions: 100, purchases: 5 })]);
    expect(r.decision).toBe("insufficient_data");
    expect(r.reasons.join(" ")).toMatch(/Sessions: 100 of 500/);
  });

  it("honours an experiment minimum sample above the rule minimum", () => {
    const r = classifyExperiment({ ...exp, minimumSample: 5000 }, [v("A", { sessions: 1000, purchases: 30, grossRevenue: 1200 })]);
    expect(r.decision).toBe("insufficient_data");
  });

  it("requires days running", () => {
    const r = classifyExperiment({ ...exp, startDate: "2026-09-23" }, [v("A", { sessions: 1000, purchases: 30, grossRevenue: 1200 })]);
    expect(r.decision).toBe("insufficient_data");
    expect(r.reasons.join(" ")).toMatch(/Days running: 3 of 7/);
  });

  it("kills when enough traffic converts far below threshold", () => {
    const r = classifyExperiment(exp, [v("A", { sessions: 1000, purchases: 1, grossRevenue: 40 })]);
    expect(r.decision).toBe("kill");
  });

  it("keeps collecting when traffic is enough but purchases are not", () => {
    const r = classifyExperiment(exp, [v("A", { sessions: 1000, purchases: 8, grossRevenue: 320 })]);
    expect(r.decision).toBe("keep_collecting");
  });

  it("scales organic winners that meet every threshold", () => {
    const r = classifyExperiment(exp, [v("A", { sessions: 1000, purchases: 30, grossRevenue: 1200, cogs: 400 })]);
    expect(r.decision).toBe("scale");
    expect(r.reasons.join(" ")).toMatch(/All scale thresholds met/);
  });

  it("scales paid winners with sufficient ROAS", () => {
    const r = classifyExperiment(exp, [
      v("A", { impressions: 60000, clicks: 1200, sessions: 1100, purchases: 30, grossRevenue: 1500, cogs: 450, adSpend: 400 }),
    ]);
    expect(r.decision).toBe("scale");
  });

  it("clones profitable high-CTR results that miss ROAS", () => {
    const r = classifyExperiment(exp, [
      v("A", { impressions: 60000, clicks: 1200, sessions: 1100, purchases: 30, grossRevenue: 1200, cogs: 300, adSpend: 600 }),
    ]);
    expect(r.decision).toBe("clone");
  });

  it("iterates when interest exists but conversion is weak", () => {
    const r = classifyExperiment(exp, [
      v("A", { impressions: 60000, clicks: 600, sessions: 1100, purchases: 12, grossRevenue: 480, cogs: 200, adSpend: 250 }),
    ]);
    expect(r.decision).toBe("iterate");
  });

  it("identifies a clear winner by lift over control", () => {
    const r = classifyExperiment(exp, [
      v("A", { sessions: 1000, purchases: 20, grossRevenue: 800, cogs: 300 }),
      v("B", { sessions: 1000, purchases: 30, grossRevenue: 1200, cogs: 450 }),
      v("C", { sessions: 1000, purchases: 21, grossRevenue: 840, cogs: 300 }),
    ]);
    expect(r.winner?.key).toBe("B");
    expect(r.winner?.clear).toBe(true);
    expect(r.winner?.lift).toBeCloseTo(0.5, 5);
  });

  it("reports no clear winner when lift is small", () => {
    const r = classifyExperiment(exp, [
      v("A", { sessions: 1000, purchases: 30, grossRevenue: 1200, cogs: 400 }),
      v("B", { sessions: 1000, purchases: 31, grossRevenue: 1240, cogs: 410 }),
    ]);
    expect(r.winner?.clear).toBe(false);
  });

  it("uses configurable thresholds", () => {
    const strict = { ...DEFAULT_DECISION_RULES, scaleMinConversionRate: 0.05 };
    const r = classifyExperiment(exp, [v("A", { sessions: 1000, purchases: 30, grossRevenue: 1200, cogs: 400 })], strict);
    expect(r.decision).not.toBe("scale");
  });
});
