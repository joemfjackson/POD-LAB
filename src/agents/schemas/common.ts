import { z } from "zod";
import { SCORE_DIMENSIONS } from "@/domain/scoring";

export const confidenceSchema = z.enum(["low", "medium", "high"]);
export const riskSchema = z.enum(["none", "low", "medium", "high", "critical"]);
export const evidenceKindSchema = z.enum(["measured_fact", "observed_signal", "inferred_conclusion", "assumption"]);
export const score10 = z.number().min(0).max(10);
export const text = (max = 2000) => z.string().trim().min(1).max(max);
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "hex colour like #0A0A0B");

/**
 * An evidence item. Models may cite only the numbered sources supplied in the
 * prompt (source_ref "S1".."Sn"); they cannot emit URLs. Unknown references are
 * downgraded during persistence.
 */
export const evidenceSchema = z.object({
  claim: text(600),
  kind: evidenceKindSchema,
  source_ref: z.string().regex(/^S\d{1,3}$/).nullable(),
  quote_snippet: z.string().max(500).nullable(),
  confidence: confidenceSchema,
});

export const dimensionScoreSchema = z.object({
  dimension: z.enum(SCORE_DIMENSIONS),
  score: score10,
  explanation: text(600),
});
