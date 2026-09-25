import { z } from "zod";
import { text } from "./common";

export const storePayloadSchema = z.object({ brand_id: z.uuid() });
export type StorePayload = z.infer<typeof storePayloadSchema>;

const faqItem = z.object({ question: text(200), answer: text(800) });

export const storeOutputSchema = z.object({
  store_name: text(80),
  seo_title: text(70),
  seo_description: text(170),
  announcement: z.string().max(140).nullable(),
  navigation: z.array(z.object({ label: text(30), href: z.string().regex(/^\/[a-z0-9\-/]*$/) })).min(2).max(8),
  hero: z.object({ eyebrow: z.string().max(60).nullable(), headline: text(90), subheadline: text(240), cta_label: text(30) }),
  value_props: z.array(z.object({ title: text(60), body: text(200) })).min(2).max(4),
  brand_story_section: z.object({ headline: text(90), body: text(1200) }),
  collections: z
    .array(z.object({ collection_name: text(80), title: text(80), description: text(400), seo_title: text(70), seo_description: text(170) }))
    .max(12),
  products: z
    .array(
      z.object({
        product_code: z.string().regex(/^PRD-\d{4,}$/),
        title: text(120),
        description: text(1200),
        bullet_points: z.array(z.string().max(160)).min(2).max(6),
        seo_title: text(70),
        seo_description: text(170),
        badges: z.array(z.string().max(24)).max(3),
      }),
    )
    .min(1)
    .max(60),
  upsells: z.array(z.object({ product_code: z.string(), upsell_codes: z.array(z.string()).max(4), cross_sell_codes: z.array(z.string()).max(4) })).max(60),
  faq: z.array(faqItem).min(3).max(12),
  about: z.object({ headline: text(90), body: text(2000) }),
  contact: z.object({ intro: text(400), response_time: text(80) }),
  shipping_copy: text(1500),
  returns_copy: text(1500),
  size_guide_intro: text(600),
  email_capture: z.object({ headline: text(80), body: text(240), incentive: z.string().max(120).nullable() }),
  cart_strategy: z.object({ free_shipping_message: z.string().max(140).nullable(), upsell_message: text(140), bundle_message: z.string().max(140).nullable() }),
});
export type StoreOutput = z.infer<typeof storeOutputSchema>;
