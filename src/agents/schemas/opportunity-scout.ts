import { z } from "zod";
import { confidenceSchema, dimensionScoreSchema, evidenceSchema, text } from "./common";

export const scoutPayloadSchema = z.object({
  mission_id: z.uuid().optional(),
  brand_id: z.uuid().optional(),
  opportunity_id: z.uuid().optional(),
  prompt: z.string().min(3).max(4000),
  mission_type: z.enum(["discover", "investigate", "revisit"]).default("discover"),
  max_candidates: z.number().int().min(1).max(100).default(10),
  research_depth: z.number().int().min(1).max(5).default(1),
});
export type ScoutPayload = z.infer<typeof scoutPayloadSchema>;

export const researchDimensionsSchema = z.object({
  demand_indicators: text(600),
  community_size: text(400),
  community_engagement: text(400),
  purchase_intent: text(400),
  passion_level: text(400),
  personalization_opportunity: text(400),
  viable_design_count_estimate: z.number().int().min(0).max(1000),
  viable_product_categories: z.array(z.string().max(80)).max(15),
  average_selling_price_range_usd: z.object({ low: z.number().min(0), high: z.number().min(0) }).nullable(),
  likely_margin: text(400),
  market_saturation: text(400),
  competitor_quality: text(400),
  social_media_potential: text(400),
  organic_search_potential: text(400),
  advertising_addressability: text(400),
  repeat_purchase_potential: text(400),
  premium_positioning_potential: text(400),
  subcollection_potential: text(400),
});

export const scoutOpportunitySchema = z.object({
  niche: text(200),
  hypothesis: text(800),
  audience: text(500),
  summary: text(1500),
  scores: z.array(dimensionScoreSchema).min(7).max(10),
  evidence: z.array(evidenceSchema).min(1).max(25),
  strongest_evidence: z.array(z.string().max(400)).min(1).max(6),
  strongest_risks: z.array(z.string().max(400)).min(1).max(6),
  strongest_signal: text(400),
  biggest_risk: text(400),
  recommended_customer: text(500),
  recommended_brand_angle: text(500),
  recommended_first_products: z.array(z.string().max(120)).min(1).max(8),
  recommended_test_strategy: text(800),
  suggested_sub_niches: z.array(z.string().max(120)).max(10),
  seasonality: z.enum(["evergreen", "seasonal", "mixed", "unknown"]),
  trend_durability: text(400),
  ip_risk_notes: text(600),
  geographic_notes: z.string().max(600),
  cultural_risk_notes: z.string().max(600),
  confidence: confidenceSchema,
  research_dimensions: researchDimensionsSchema,
});

export const scoutOutputSchema = z.object({
  mission_summary: text(1500),
  method_note: text(600),
  opportunities: z.array(scoutOpportunitySchema).min(1).max(100),
});

export type ScoutOutput = z.infer<typeof scoutOutputSchema>;
export type ScoutOpportunity = z.infer<typeof scoutOpportunitySchema>;
