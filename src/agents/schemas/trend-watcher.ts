import { z } from "zod";
import { evidenceSchema, score10, text } from "./common";

export const TREND_CATEGORIES = [
  "emerging_term", "social", "hobby", "profession", "cultural_shift", "seasonal", "meme", "product",
  "ai_tech", "aesthetic", "ecommerce", "other",
] as const;

export const trendPayloadSchema = z.object({
  focus: z.string().max(1000).default("Emerging identity-driven communities with merchandise potential"),
  max_trends: z.number().int().min(1).max(30).default(8),
});
export type TrendPayload = z.infer<typeof trendPayloadSchema>;

export const trendOutputSchema = z.object({
  scan_summary: text(1000),
  trends: z
    .array(
      z.object({
        name: text(120),
        category: z.enum(TREND_CATEGORIES),
        summary: text(800),
        velocity: z.enum(["spiking", "rising", "stable", "declining", "unknown"]),
        estimated_lifespan: z.enum(["weeks", "months", "seasonal_recurring", "multi_year", "evergreen", "unknown"]),
        pod_relevance: score10,
        recommended_action: text(400),
        candidate_niches: z.array(z.string().max(120)).max(6),
        evidence: z.array(evidenceSchema).min(1).max(10),
      }),
    )
    .min(1)
    .max(30),
});
export type TrendOutput = z.infer<typeof trendOutputSchema>;
