import { z } from "zod";
import { hexColor, score10, text } from "./common";

export const PRINTING_METHODS = [
  "dtg", "dtf", "screen_print", "embroidery", "puff_embroidery", "liquid_3d", "sublimation", "vinyl", "other",
] as const;

export const creativePayloadSchema = z.object({
  brand_id: z.uuid(),
  mode: z.enum(["full", "derivatives"]).default("full"),
  parent_design_id: z.uuid().optional(),
  design_count: z.number().int().min(1).max(40).default(8),
  notes: z.string().max(2000).optional(),
});
export type CreativePayload = z.infer<typeof creativePayloadSchema>;

export const visualDirectionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]{2,30}$/),
  name: text(80),
  mood: text(600),
  typography: text(400),
  colors: z.array(z.object({ name: text(40), hex: hexColor })).min(2).max(6),
  graphic_language: text(500),
  illustration_style: text(400),
  photography_direction: text(400),
  garment_placement: text(400),
  decoration_methods: z.array(z.enum(PRINTING_METHODS)).min(1).max(5),
  avoid: z.array(z.string().max(200)).min(1).max(8),
});

export const designConceptSchema = z.object({
  title: z.string().trim().min(1).max(120),
  collection: text(80),
  concept: text(1000),
  front_placement: z.string().max(300).nullable(),
  back_placement: z.string().max(300).nullable(),
  sleeve_placement: z.string().max(300).nullable(),
  colors: z.array(z.string().max(40)).min(1).max(6),
  typography: text(300),
  illustration_notes: text(500),
  printing_method: z.enum(PRINTING_METHODS),
  embroidery_suitability: score10,
  liquid_3d_suitability: score10,
  preferred_products: z.array(z.string().max(40)).min(1).max(6),
  target_buyer: text(300),
  generation_prompt: text(2000),
  mockup_prompt: text(1000),
  visual_direction: z.string().max(30),
});

export const creativeOutputSchema = z.object({
  visual_directions: z.array(visualDirectionSchema).max(3),
  recommended_direction: z.string().max(30),
  collections: z.array(z.object({ name: text(80), description: text(500), theme: text(200) })).max(12),
  designs: z.array(designConceptSchema).min(1).max(40),
});
export type CreativeOutput = z.infer<typeof creativeOutputSchema>;
