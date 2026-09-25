import { z } from "zod";
import { riskSchema, text } from "./common";

export const COMPLIANCE_CATEGORIES = [
  "trademarked_phrase", "company_name", "sports_team", "team_logo", "copyrighted_character", "celebrity",
  "protected_lyrics", "movie_tv_reference", "copied_artwork", "brand_confusion", "political_campaign_mark",
  "restricted_content", "other",
] as const;

export const compliancePayloadSchema = z.object({
  brand_id: z.uuid(),
  design_ids: z.array(z.uuid()).max(100).optional(),
});
export type CompliancePayload = z.infer<typeof compliancePayloadSchema>;

export const complianceOutputSchema = z.object({
  assessments: z
    .array(
      z.object({
        design_code: z.string().regex(/^DES-\d{4,}$/),
        additional_issues: z
          .array(
            z.object({
              category: z.enum(COMPLIANCE_CATEGORIES),
              detected_issue: text(300),
              risk_level: riskSchema,
              explanation: text(600),
              action_required: text(300),
            }),
          )
          .max(10),
      }),
    )
    .max(100),
});
export type ComplianceOutput = z.infer<typeof complianceOutputSchema>;
