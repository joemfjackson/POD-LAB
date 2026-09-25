import { z } from "zod";
import { text } from "./common";

export const productPayloadSchema = z.object({
  brand_id: z.uuid(),
  max_products: z.number().int().min(1).max(60).default(12),
  target_cac: z.number().min(0).max(500).optional(),
});
export type ProductPayload = z.infer<typeof productPayloadSchema>;

export const productOutputSchema = z.object({
  selections: z
    .array(
      z.object({
        design_code: z.string().regex(/^DES-\d{4,}$/),
        provider_sku: z.string().min(1).max(120),
        title: text(150),
        retail_price: z.number().positive().max(1000),
        compare_at_price: z.number().positive().max(2000).nullable(),
        rationale: text(500),
      }),
    )
    .min(1)
    .max(60),
  bundles: z
    .array(
      z.object({
        name: text(100),
        description: text(300),
        selection_indexes: z.array(z.number().int().min(0)).min(2).max(6),
        discount_pct: z.number().min(0).max(0.5),
      }),
    )
    .max(6),
  pricing_notes: text(1500),
});
export type ProductOutput = z.infer<typeof productOutputSchema>;
