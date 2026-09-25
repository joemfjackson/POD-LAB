import { z } from "zod";
import { text } from "./common";

export const PLATFORMS = [
  "tiktok", "instagram", "facebook", "pinterest", "x", "youtube_shorts", "reddit", "google_search", "seo", "email", "influencer",
] as const;

export const CONTENT_TYPES = [
  "post", "short_video_script", "hook", "caption", "email", "influencer_brief", "outreach_template",
  "ugc_concept", "landing_page_experiment", "discount_experiment", "content_pillar",
] as const;

export const EXPERIMENT_TYPES = [
  "brand_name", "positioning", "mockup", "design", "product", "price", "bundle", "homepage", "offer",
  "shipping", "ad_creative", "audience", "social_content",
] as const;

export const PRIMARY_METRICS = [
  "ctr", "conversion_rate", "add_to_cart_rate", "aov", "roas", "contribution_margin", "cac", "contribution_profit",
] as const;

export const growthPayloadSchema = z.object({ brand_id: z.uuid(), focus: z.string().max(1000).optional() });
export type GrowthPayload = z.infer<typeof growthPayloadSchema>;

export const growthOutputSchema = z.object({
  audience: text(800),
  platform_strategy: z
    .array(z.object({ platform: z.enum(PLATFORMS), role: text(300), rationale: text(500), mode: z.enum(["organic", "paid", "both"]) }))
    .min(2)
    .max(11),
  content_pillars: z.array(z.object({ name: text(60), description: text(400) })).min(2).max(6),
  launch_campaign: z.object({ name: text(100), objective: text(300), summary: text(1000) }),
  calendar: z
    .array(
      z.object({
        day: z.number().int().min(1).max(30),
        platform: z.enum(PLATFORMS),
        content_type: z.enum(CONTENT_TYPES),
        title: text(120),
        hook: z.string().max(200).nullable(),
        body: text(1500),
      }),
    )
    .min(5)
    .max(60),
  hooks: z.array(z.string().max(200)).min(3).max(20),
  influencer_brief: text(2000),
  outreach_templates: z.array(z.object({ name: text(80), body: text(1500) })).min(1).max(4),
  ugc_concepts: z.array(z.string().max(400)).min(1).max(8),
  landing_page_experiments: z.array(z.object({ name: text(100), hypothesis: text(400) })).max(5),
  discount_experiments: z.array(z.object({ name: text(100), hypothesis: text(400), offer: text(120) })).max(5),
  paid_plan: z
    .array(z.object({ platform: z.enum(PLATFORMS), objective: text(200), audience: text(300), proposed_budget_usd: z.number().min(0).max(100000) }))
    .max(6),
  organic_vs_paid: text(1000),
  experiments: z
    .array(
      z.object({
        name: text(120),
        experiment_type: z.enum(EXPERIMENT_TYPES),
        hypothesis: text(500),
        primary_metric: z.enum(PRIMARY_METRICS),
        minimum_sample: z.number().int().min(50).max(100000),
        variants: z.array(z.object({ name: text(80), description: text(300) })).min(2).max(6),
      }),
    )
    .min(1)
    .max(6),
});
export type GrowthOutput = z.infer<typeof growthOutputSchema>;
