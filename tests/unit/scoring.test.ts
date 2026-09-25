import { describe, expect, it } from "vitest";
import {
  SCORE_DIMENSIONS,
  capConfidence,
  clampScore,
  evidenceConfidenceCeiling,
  scoreProfile,
  type DimensionScore,
} from "@/domain/scoring";

const all = (score: number): DimensionScore[] =>
  SCORE_DIMENSIONS.map((dimension) => ({ dimension, score, explanation: "x" }));

describe("opportunity scoring", () => {
  it("clamps and rounds scores", () => {
    expect(clampScore(12)).toBe(10);
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(7.26)).toBe(7.3);
    expect(clampScore(Number.NaN)).toBe(0);
  });

  it("returns an incomplete profile when nothing is scored", () => {
    const p = scoreProfile([]);
    expect(p.tier).toBe("incomplete");
    expect(p.weightedIndex).toBeNull();
  });

  it("classifies a strong balanced profile", () => {
    const p = scoreProfile(all(8));
    expect(p.tier).toBe("strong");
    expect(p.strengths).toHaveLength(SCORE_DIMENSIONS.length);
    expect(p.blockingWeaknesses).toEqual([]);
    expect(p.weightedIndex).toBe(8);
  });

  it("surfaces blocking weaknesses instead of hiding them in an average", () => {
    const scores = all(9).map((s) => (s.dimension === "demand" ? { ...s, score: 2 } : s));
    const p = scoreProfile(scores);
    expect(p.blockingWeaknesses).toEqual(["demand"]);
    expect(p.tier).toBe("mixed");
    expect(p.summary).toMatch(/blocking weakness in demand/i);
  });

  it("marks partially scored profiles incomplete", () => {
    const p = scoreProfile(all(8).slice(0, 5));
    expect(p.tier).toBe("incomplete");
    expect(p.summary).toMatch(/unscored/);
  });

  it("caps confidence at low without live sourced evidence", () => {
    const evidence = Array.from({ length: 10 }, () => ({ kind: "measured_fact" as const, sourced: true }));
    expect(evidenceConfidenceCeiling(evidence, "model_only")).toBe("low");
    expect(evidenceConfidenceCeiling(evidence, "demo")).toBe("low");
    expect(evidenceConfidenceCeiling(evidence, "live")).toBe("high");
  });

  it("scales confidence ceiling with sourced evidence and assumptions", () => {
    const medium = [
      ...Array.from({ length: 3 }, () => ({ kind: "observed_signal" as const, sourced: true })),
      ...Array.from({ length: 3 }, () => ({ kind: "assumption" as const, sourced: false })),
    ];
    expect(evidenceConfidenceCeiling(medium, "live")).toBe("medium");
    const unsourced = Array.from({ length: 8 }, () => ({ kind: "measured_fact" as const, sourced: false }));
    expect(evidenceConfidenceCeiling(unsourced, "live")).toBe("low");
  });

  it("never lets claimed confidence exceed the ceiling", () => {
    expect(capConfidence("high", "low")).toBe("low");
    expect(capConfidence("medium", "high")).toBe("medium");
    expect(capConfidence("low", "medium")).toBe("low");
  });
});
