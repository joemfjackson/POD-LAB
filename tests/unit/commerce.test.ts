import { describe, expect, it } from "vitest";
import { themeFromIdentity } from "@/agents/handlers/store-builder";
import { routeFromHref, safeTheme } from "@/components/storefront/types";
import { genericExportAdapter, productBodyHtml, shopifyAdapter, toNextjsManifest, toShopifyCsv } from "@/providers/commerce/adapters";
import type { StorePackage } from "@/providers/commerce/types";
import { FulfillEngineAdapter, MockFulfillmentAdapter } from "@/providers/fulfillment/adapters";
import { ProviderNotConfiguredError } from "@/providers/errors";
import { parseCsv } from "@/domain/csv";

const pkg: StorePackage = {
  format: "pod-lab.store-package",
  version: 1,
  exportedAt: "2026-09-25T00:00:00Z",
  isDemo: true,
  brand: { code: "PL-0001", name: "Brand", niche: "n", audience: null, positioning: null, tagline: null, voice: null, stage: "store_build" },
  identity: null,
  store: { code: "STR-0001", name: "Brand", status: "generated", seoTitle: "t", seoDescription: "d", announcement: null, theme: {}, navigation: [], cartStrategy: {}, emailCapture: {} },
  pages: [{ pageType: "home", slug: "home", title: "Home", seoTitle: null, seoDescription: null, sections: [], isPlaceholder: false }],
  collections: [{ slug: "core", title: "Core", description: null, seoTitle: null, seoDescription: null, productSlugs: ["tee"] }],
  products: [
    {
      code: "PRD-0001", slug: "tee", title: "Tee", description: "Soft <b>tee</b>", bulletPoints: ["Cotton"], seoTitle: "s", seoDescription: "d", price: 32, compareAtPrice: null, badges: [],
      productType: "tee", provider: "mock", providerSku: "DEMO-TEE", colors: ["Black"], sizes: ["S", "M"], collectionSlug: "core", design: null, economics: {}, recommendation: "launch", upsellSlugs: [], crossSellSlugs: [], images: [],
    },
  ],
  bundles: [],
  pricing: null,
  assets: [],
  campaigns: [],
};

describe("store export adapters", () => {
  it("exports the generic package as JSON", () => {
    const a = genericExportAdapter.export(pkg)!;
    expect(JSON.parse(a.body).format).toBe("pod-lab.store-package");
    expect(a.filename).toBe("pl-0001-str-0001-package.json");
  });

  it("builds a Next.js route manifest", () => {
    const m = toNextjsManifest(pkg);
    expect(m.routes.map((r) => r.path)).toEqual(["/", "/collections/core", "/products/tee"]);
  });

  it("writes a Shopify product CSV with one row per variant and escaped HTML", () => {
    const rows = parseCsv(toShopifyCsv(pkg));
    expect(rows[0]).toContain("Handle");
    expect(rows).toHaveLength(3);
    expect(rows[1]![0]).toBe("tee");
    expect(rows[1]).toContain("draft");
    expect(productBodyHtml(pkg.products[0]!)).toBe("<p>Soft &lt;b&gt;tee&lt;/b&gt;</p><ul><li>Cotton</li></ul>");
  });

  it("refuses to publish to Shopify without configuration", async () => {
    const s = shopifyAdapter({ apiVersion: "2025-07" });
    expect(s.isConfigured()).toBe(false);
    await expect(s.publish!(pkg)).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});

describe("fulfillment adapters", () => {
  it("reports Fulfill Engine as requiring a provider connection", async () => {
    const fe = new FulfillEngineAdapter({});
    expect(fe.isConfigured()).toBe(false);
    await expect(fe.listProducts()).rejects.toThrow(/Requires provider connection/);
    await expect(fe.createOrder()).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("serves the mock catalog and flags simulated orders", async () => {
    const m = new MockFulfillmentAdapter();
    const products = await m.listProducts();
    expect(products.length).toBeGreaterThan(5);
    const variants = await m.getVariants("DEMO-HOODIE");
    expect(variants.length).toBe(15);
    const order = await m.createOrder({ externalOrderId: "1", lines: [{ providerSku: "DEMO-HOODIE", variantSku: null, quantity: 1, artworkUrl: null }], shipTo: { name: "a", address1: "b", city: "c", region: "d", postalCode: "e", country: "US" } });
    expect(order.simulated).toBe(true);
  });
});

describe("storefront helpers", () => {
  it("maps storefront hrefs to preview routes", () => {
    expect(routeFromHref("/")).toEqual({ kind: "page", slug: "home" });
    expect(routeFromHref("/collections/all")).toEqual({ kind: "collection", slug: "all" });
    expect(routeFromHref("/products/tee")).toEqual({ kind: "product", slug: "tee" });
    expect(routeFromHref("/about")).toEqual({ kind: "page", slug: "about" });
  });

  it("rejects unsafe theme values before they reach inline styles", () => {
    const t = safeTheme({ colors: { background: "red;background:url(x)", text: "#FFFFFF" }, fonts: { heading: "Evil'); } body {" } }, "Name");
    expect(t.colors.background).toBe("#0B0B0C");
    expect(t.colors.text).toBe("#FFFFFF");
    expect(t.fonts.heading).toBe("Inter Tight");
    expect(t.logo_text).toBe("Name");
  });

  it("derives a legible theme from the brand identity", () => {
    const t = themeFromIdentity(
      { colors: [{ name: "Void", hex: "#0B0B0C", role: "primary background" }, { name: "Bone", hex: "#EDEAE3", role: "text" }, { name: "Signal", hex: "#FF5A1F", role: "accent" }], fonts: [{ family: "Inter Tight", role: "headlines" }] },
      "Brand",
    );
    expect(t.colors).toMatchObject({ background: "#0B0B0C", text: "#EDEAE3", accent: "#FF5A1F" });
    expect(t.colors.muted).not.toBe(t.colors.background);
    expect(t.fonts.body).toBe("Inter Tight");
  });
});
