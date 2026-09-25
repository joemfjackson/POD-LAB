import type { StoreOutput } from "../schemas";
import { isAiSiSubject } from "./util";

export function demoStore(input: {
  brand: { name: string; niche: string; tagline: string | null; positioning: string | null; story: string | null };
  collections: Array<{ name: string; description: string | null }>;
  products: Array<{ code: string; title: string; product_type: string; price: number; design_concept: string | null }>;
  free_shipping_threshold: number | null;
}): StoreOutput {
  const { brand } = input;
  const aiSi = isAiSiSubject(brand.niche);
  const tagline = brand.tagline ?? `Built for ${brand.niche.toLowerCase()}.`;
  const codes = input.products.map((p) => p.code);
  return {
    store_name: brand.name,
    seo_title: `${brand.name} — ${tagline}`.slice(0, 70),
    seo_description: `${brand.positioning ?? `Apparel for ${brand.niche}.`}`.slice(0, 170),
    announcement: input.free_shipping_threshold ? `Free shipping on orders over $${input.free_shipping_threshold.toFixed(0)}` : "Printed on demand — made for you",
    navigation: [
      { label: "Shop", href: "/collections/all" },
      ...input.collections.slice(0, 3).map((c) => ({ label: c.name.slice(0, 30), href: `/collections/${c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` })),
      { label: "About", href: "/about" },
    ],
    hero: {
      eyebrow: aiSi ? "Issue 001 — Research in progress" : "New collection",
      headline: aiSi ? "Dress for the intelligence transition." : `${brand.name}: ${tagline}`.slice(0, 90),
      subheadline: (brand.positioning ?? `Premium apparel for ${brand.niche.toLowerCase()}.`).slice(0, 240),
      cta_label: "Shop the collection",
    },
    value_props: [
      { title: "Printed to order", body: "Each piece is produced when you order it — no overstock, no waste." },
      { title: "Heavyweight blanks", body: "Chosen for fit and durability, specified per product." },
      { title: "Original designs", body: "Every concept is designed in-house and screened before production." },
    ],
    brand_story_section: { headline: "Why we exist", body: brand.story ?? `A brand for people who take ${brand.niche.toLowerCase()} seriously.` },
    collections: input.collections.map((c) => ({
      collection_name: c.name,
      title: c.name,
      description: c.description ?? `The ${c.name} collection.`,
      seo_title: `${c.name} | ${brand.name}`.slice(0, 70),
      seo_description: (c.description ?? `Shop the ${c.name} collection from ${brand.name}.`).slice(0, 170),
    })),
    products: input.products.map((p) => ({
      product_code: p.code,
      title: p.title,
      description: `${p.design_concept ?? p.title} Printed on demand on a ${p.product_type.replace("_", " ")} chosen for quality.`,
      bullet_points: ["Printed on demand", `Product type: ${p.product_type.replace("_", " ")}`, "See size guide for fit"],
      seo_title: `${p.title} | ${brand.name}`.slice(0, 70),
      seo_description: `${p.title} from ${brand.name}. ${tagline}`.slice(0, 170),
      badges: [],
    })),
    upsells: input.products.map((p, i) => ({
      product_code: p.code,
      upsell_codes: codes.filter((_, j) => j !== i).slice(0, 2),
      cross_sell_codes: codes.filter((_, j) => j !== i).slice(2, 4),
    })),
    faq: [
      { question: "How long does production take?", answer: "Items are printed to order. Production and shipping times are shown at checkout once a fulfillment provider is connected." },
      { question: "What sizes do you offer?", answer: "Available sizes are listed on each product page; see the size guide for measurements from the blank manufacturer." },
      { question: "Can I return an item?", answer: "See our returns policy for eligibility — made-to-order items are handled case by case." },
      { question: "Where do you ship?", answer: "Shipping regions depend on the fulfillment provider and are confirmed at checkout." },
    ],
    about: { headline: `About ${brand.name}`, body: brand.story ?? `${brand.name} makes considered apparel for ${brand.niche.toLowerCase()}.` },
    contact: { intro: "Questions about an order or a collaboration? Get in touch.", response_time: "We aim to reply within 2 business days" },
    shipping_copy: "Every order is printed on demand. Shipping options, costs and delivery estimates are calculated at checkout based on your address. (Placeholder — confirm with your fulfillment provider before launch.)",
    returns_copy: "Because items are made to order, returns are accepted for misprints, damage or defects reported within 30 days of delivery. (Placeholder policy — review before launch.)",
    size_guide_intro: "Measurements are supplied by the blank manufacturer. When between sizes, size up for a relaxed fit.",
    email_capture: { headline: "Join the list", body: "New drops, restocks and behind-the-scenes notes. No spam.", incentive: null },
    cart_strategy: {
      free_shipping_message: input.free_shipping_threshold ? `You're close to free shipping (orders over $${input.free_shipping_threshold.toFixed(0)}).` : null,
      upsell_message: "Complete the set",
      bundle_message: "Bundle any two pieces and save",
    },
  };
}
