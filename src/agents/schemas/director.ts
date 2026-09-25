import { z } from "zod";
import { text } from "./common";

export const directorPayloadSchema = z.object({ period: z.enum(["daily", "weekly"]).default("daily") });
export type DirectorPayload = z.infer<typeof directorPayloadSchema>;

export const directorOutputSchema = z.object({
  headline: text(200),
  summary: text(2000),
  priorities: z.array(z.object({ title: text(160), reason: text(400), href: z.string().regex(/^\/[a-zA-Z0-9\-/?=&_]*$/).nullable() })).max(8),
  brands_needing_attention: z
    .array(z.object({ brand_code: z.string().regex(/^PL-\d{4,}$/), reason: text(400), recommended_action: text(200) }))
    .max(10),
  revisit_candidates: z.array(z.object({ opportunity_code: z.string().regex(/^OPP-\d{4,}$/), reason: text(300) })).max(10),
  risks: z.array(z.string().max(400)).max(8),
});
export type DirectorOutput = z.infer<typeof directorOutputSchema>;
