import { z } from "zod";
import { confidenceSchema, text } from "./common";

export const analystPayloadSchema = z.object({
  brand_id: z.uuid().optional(),
  experiment_ids: z.array(z.uuid()).max(50).optional(),
});
export type AnalystPayload = z.infer<typeof analystPayloadSchema>;

export const analystOutputSchema = z.object({
  experiments: z
    .array(
      z.object({
        experiment_code: z.string().regex(/^EXP-\d{4,}$/),
        narrative: text(1500),
        suggested_next_steps: z.array(z.string().max(300)).min(1).max(6),
        insight_candidates: z
          .array(
            z.object({
              title: text(200),
              body: text(800),
              claim_type: z.enum(["observation", "correlation", "hypothesis"]),
              confidence: confidenceSchema,
            }),
          )
          .max(4),
      }),
    )
    .max(50),
});
export type AnalystOutput = z.infer<typeof analystOutputSchema>;
