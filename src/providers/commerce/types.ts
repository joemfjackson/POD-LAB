/** Portable brand/store package — the contract every store adapter consumes. */

export interface StoreSection {
  type: string;
  [key: string]: unknown;
}

export interface PackageProduct {
  code: string;
  slug: string;
  title: string;
  description: string;
  bulletPoints: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  price: number;
  compareAtPrice: number | null;
  badges: string[];
  productType: string;
  provider: string;
  providerSku: string;
  colors: string[];
  sizes: string[];
  collectionSlug: string | null;
  design: { code: string; title: string; printingMethod: string | null } | null;
  economics: Record<string, unknown>;
  recommendation: string | null;
  upsellSlugs: string[];
  crossSellSlugs: string[];
  images: string[];
}

export interface StorePackage {
  format: "pod-lab.store-package";
  version: 1;
  exportedAt: string;
  isDemo: boolean;
  brand: {
    code: string;
    name: string;
    niche: string;
    audience: string | null;
    positioning: string | null;
    tagline: string | null;
    voice: string | null;
    stage: string;
  };
  identity: {
    colors: Array<{ name: string; hex: string; role: string }>;
    fonts: Array<{ family: string; role: string }>;
    story: string | null;
    toneOfVoice: string | null;
    visualTerritory: string | null;
    archetype: string | null;
  } | null;
  store: {
    code: string;
    name: string;
    status: string;
    seoTitle: string | null;
    seoDescription: string | null;
    announcement: string | null;
    theme: Record<string, unknown>;
    navigation: Array<{ label: string; href: string }>;
    cartStrategy: Record<string, unknown>;
    emailCapture: Record<string, unknown>;
  };
  pages: Array<{
    pageType: string;
    slug: string;
    title: string;
    seoTitle: string | null;
    seoDescription: string | null;
    sections: StoreSection[];
    isPlaceholder: boolean;
  }>;
  collections: Array<{ slug: string; title: string; description: string | null; seoTitle: string | null; seoDescription: string | null; productSlugs: string[] }>;
  products: PackageProduct[];
  bundles: Array<{ name: string; description: string | null; price: number; productSlugs: string[] }>;
  pricing: Record<string, unknown> | null;
  assets: Array<{ name: string; path: string; kind: string; mimeType: string }>;
  campaigns: Array<{ code: string; name: string; platform: string; status: string; isPaid: boolean; objective: string | null; contentItems: number }>;
}

export interface ExportArtifact {
  filename: string;
  contentType: string;
  body: string;
}

export interface StoreAdapter {
  readonly key: "internal_preview" | "generic_export" | "nextjs" | "shopify" | "fulfill_engine";
  readonly label: string;
  readonly description: string;
  isConfigured(): boolean;
  /** Offline export (always available unless noted). */
  export(pkg: StorePackage): ExportArtifact | null;
  /** Remote publish. Only allowed for launch-approved stores; requires configuration. */
  publish?(pkg: StorePackage): Promise<{ externalIds: string[]; message: string }>;
}
