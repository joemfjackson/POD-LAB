import { z } from "zod";
import { hexColor, riskSchema, score10, text } from "./common";

export const architectPayloadSchema = z.object({
  brand_id: z.uuid(),
  direction_notes: z.string().max(2000).optional(),
  name_count: z.number().int().min(3).max(30).default(12),
});
export type ArchitectPayload = z.infer<typeof architectPayloadSchema>;

export const nameCandidateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  rationale: text(600),
  memorability: score10,
  spelling_risk: riskSchema,
  pronunciation_risk: riskSchema,
  domain_candidates: z.array(z.string().regex(/^[a-z0-9-]+(\.[a-z]{2,})+$/i)).min(1).max(5),
  handle_candidates: z.array(z.string().regex(/^[A-Za-z0-9._]{1,30}$/)).min(1).max(4),
  collision_notes: text(600),
  trademark_notes: text(600),
  trademark_risk: riskSchema,
  expansion_potential: score10,
  visual_potential: score10,
});

export const architectOutputSchema = z.object({
  audience: text(800),
  positioning: text(1000),
  archetype: text(200),
  emotional_appeal: text(600),
  brand_story: text(2500),
  tone_of_voice: text(800),
  visual_territory: text(1000),
  tagline_candidates: z.array(z.string().trim().min(2).max(120)).min(3).max(10),
  recommended_tagline: text(120),
  colors: z.array(z.object({ name: text(40), hex: hexColor, role: text(80) })).min(3).max(8),
  fonts: z.array(z.object({ family: text(60), role: text(60), rationale: text(300) })).min(1).max(4),
  product_collections: z.array(z.string().max(120)).min(2).max(12),
  expansion_paths: z.array(z.string().max(300)).min(1).max(8),
  anti_positioning: z.array(z.string().max(300)).min(1).max(8),
  name_candidates: z.array(nameCandidateSchema).min(3).max(30),
  trademark_disclaimer: text(400),
});
export type ArchitectOutput = z.infer<typeof architectOutputSchema>;
