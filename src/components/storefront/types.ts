export interface SfTheme {
  colors: { background: string; surface: string; text: string; muted: string; accent: string };
  fonts: { heading: string; body: string };
  logo_text: string;
}

export interface SfProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  bullet_points: string[];
  price: number;
  compare_at_price: number | null;
  badges: string[];
  product_type: string;
  colors: string[];
  sizes: string[];
  collection_slug: string | null;
  design_title: string | null;
  image: string | null;
  upsell_ids: string[];
  cross_sell_ids: string[];
}

export interface SfCollection {
  slug: string;
  title: string;
  description: string | null;
}

export interface SfPage {
  page_type: string;
  slug: string;
  title: string;
  sections: Array<Record<string, unknown> & { type: string }>;
  is_placeholder: boolean;
}

export interface SfStore {
  id: string;
  name: string;
  announcement: string | null;
  navigation: Array<{ label: string; href: string }>;
  theme: SfTheme;
  cart_strategy: { free_shipping_message?: string | null; upsell_message?: string; bundle_message?: string | null };
  email_capture: { headline?: string; body?: string; incentive?: string | null };
  is_demo: boolean;
}

export type SfRoute = { kind: "page"; slug: string } | { kind: "collection"; slug: string } | { kind: "product"; slug: string };

export const DEFAULT_THEME: SfTheme = {
  colors: { background: "#0B0B0C", surface: "#161618", text: "#EDEAE3", muted: "#8b8b95", accent: "#FF5A1F" },
  fonts: { heading: "Inter Tight", body: "Inter" },
  logo_text: "Store",
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const FONT = /^[A-Za-z0-9 ]{2,40}$/;

/** Validates theme values from the database before they reach inline styles. */
export function safeTheme(raw: unknown, fallbackName: string): SfTheme {
  const t = (raw ?? {}) as Partial<SfTheme>;
  const c = (t.colors ?? {}) as Partial<SfTheme["colors"]>;
  const f = (t.fonts ?? {}) as Partial<SfTheme["fonts"]>;
  const pick = (v: unknown, d: string, re: RegExp) => (typeof v === "string" && re.test(v) ? v : d);
  return {
    colors: {
      background: pick(c.background, DEFAULT_THEME.colors.background, HEX),
      surface: pick(c.surface, DEFAULT_THEME.colors.surface, HEX),
      text: pick(c.text, DEFAULT_THEME.colors.text, HEX),
      muted: pick(c.muted, DEFAULT_THEME.colors.muted, HEX),
      accent: pick(c.accent, DEFAULT_THEME.colors.accent, HEX),
    },
    fonts: { heading: pick(f.heading, DEFAULT_THEME.fonts.heading, FONT), body: pick(f.body, DEFAULT_THEME.fonts.body, FONT) },
    logo_text: typeof t.logo_text === "string" && t.logo_text.trim() ? t.logo_text.slice(0, 60) : fallbackName,
  };
}

/** Maps a storefront href ("/collections/x", "/about") to a preview route. */
export function routeFromHref(href: string): SfRoute {
  const clean = href.split("?")[0] ?? "/";
  if (clean === "/" || clean === "") return { kind: "page", slug: "home" };
  const m = /^\/(collections|products)\/([a-z0-9-]+)/.exec(clean);
  if (m?.[1] === "collections") return { kind: "collection", slug: m[2]! };
  if (m?.[1] === "products") return { kind: "product", slug: m[2]! };
  return { kind: "page", slug: clean.replace(/^\//, "").replace(/\/$/, "") || "home" };
}
