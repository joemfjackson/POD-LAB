import { toCsv } from "@/domain/csv";
import { ProviderNotConfiguredError, ProviderTransientError, fetchWithTimeout } from "../errors";
import type { ExportArtifact, StoreAdapter, StorePackage } from "./types";

const slugName = (pkg: StorePackage) => `${pkg.brand.code.toLowerCase()}-${pkg.store.code.toLowerCase()}`;

export const internalPreviewAdapter: StoreAdapter = {
  key: "internal_preview",
  label: "Internal preview",
  description: "Rendered inside POD Lab at /stores/[id]/preview. No external deployment.",
  isConfigured: () => true,
  export: () => null,
};

export const genericExportAdapter: StoreAdapter = {
  key: "generic_export",
  label: "Generic JSON package",
  description: "Complete brand + store package (brand, identity, products, pages, SEO, pricing, assets, campaigns).",
  isConfigured: () => true,
  export: (pkg): ExportArtifact => ({
    filename: `${slugName(pkg)}-package.json`,
    contentType: "application/json",
    body: JSON.stringify(pkg, null, 2),
  }),
};

/** Route manifest for a custom Next.js storefront (one entry per page to generate). */
export function toNextjsManifest(pkg: StorePackage) {
  return {
    format: "pod-lab.nextjs-storefront",
    version: 1,
    site: {
      name: pkg.store.name,
      seo: { title: pkg.store.seoTitle, description: pkg.store.seoDescription },
      theme: pkg.store.theme,
      navigation: pkg.store.navigation,
      announcement: pkg.store.announcement,
    },
    routes: [
      ...pkg.pages.map((p) => ({ path: p.pageType === "home" ? "/" : `/${p.slug}`, type: "page", title: p.title, seo: { title: p.seoTitle, description: p.seoDescription }, sections: p.sections })),
      ...pkg.collections.map((c) => ({ path: `/collections/${c.slug}`, type: "collection", title: c.title, seo: { title: c.seoTitle, description: c.seoDescription }, productSlugs: c.productSlugs })),
      ...pkg.products.map((p) => ({ path: `/products/${p.slug}`, type: "product", title: p.title, seo: { title: p.seoTitle, description: p.seoDescription }, product: p })),
    ],
  };
}

export const nextjsAdapter: StoreAdapter = {
  key: "nextjs",
  label: "Custom Next.js storefront",
  description: "Route manifest that a Next.js storefront can statically generate from.",
  isConfigured: () => true,
  export: (pkg) => ({
    filename: `${slugName(pkg)}-nextjs-manifest.json`,
    contentType: "application/json",
    body: JSON.stringify(toNextjsManifest(pkg), null, 2),
  }),
};

const SHOPIFY_COLUMNS = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
  "Variant SKU", "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price",
  "Variant Compare At Price", "Variant Requires Shipping", "Variant Taxable",
  "Image Src", "SEO Title", "SEO Description", "Status",
] as const;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function productBodyHtml(p: { description: string; bulletPoints: string[] }): string {
  const bullets = p.bulletPoints.length ? `<ul>${p.bulletPoints.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : "";
  return `<p>${escapeHtml(p.description)}</p>${bullets}`;
}

/** Shopify product CSV (Admin → Products → Import). Products import as drafts. */
export function toShopifyCsv(pkg: StorePackage): string {
  const rows: Array<Record<string, unknown>> = [];
  for (const p of pkg.products) {
    const sizes = p.sizes.length ? p.sizes : ["Default Title"];
    const colors = p.colors.length ? p.colors : [null];
    let first = true;
    for (const color of colors) {
      for (const size of sizes) {
        const base: Record<string, unknown> = {
          Handle: p.slug,
          "Option1 Name": first ? (p.sizes.length ? "Size" : "Title") : undefined,
          "Option1 Value": size,
          "Option2 Name": first && color ? "Color" : undefined,
          "Option2 Value": color ?? undefined,
          "Variant SKU": [p.providerSku, color, size].filter((x) => x && x !== "Default Title").join("-").replace(/\s+/g, "").toUpperCase(),
          "Variant Inventory Policy": "continue",
          "Variant Fulfillment Service": "manual",
          "Variant Price": p.price.toFixed(2),
          "Variant Compare At Price": p.compareAtPrice ? p.compareAtPrice.toFixed(2) : undefined,
          "Variant Requires Shipping": "TRUE",
          "Variant Taxable": "TRUE",
        };
        if (first) {
          Object.assign(base, {
            Title: p.title,
            "Body (HTML)": productBodyHtml(p),
            Vendor: pkg.brand.name,
            Type: p.productType,
            Tags: [p.collectionSlug, ...p.badges].filter(Boolean).join(", "),
            Published: "FALSE",
            "Image Src": p.images[0],
            "SEO Title": p.seoTitle,
            "SEO Description": p.seoDescription,
            Status: "draft",
          });
        }
        rows.push(base);
        first = false;
      }
    }
  }
  return toCsv(SHOPIFY_COLUMNS, rows);
}

export interface ShopifyConfig {
  storeDomain?: string;
  accessToken?: string;
  apiVersion: string;
}

/**
 * Shopify adapter. CSV export works offline. Remote publishing uses the Admin
 * GraphQL API (productCreate + productVariantsBulkCreate, products created as
 * DRAFT) and only runs when a store domain and Admin API token are configured.
 */
export function shopifyAdapter(cfg: ShopifyConfig): StoreAdapter {
  const configured = Boolean(cfg.storeDomain && cfg.accessToken);
  return {
    key: "shopify",
    label: "Shopify",
    description: "Product CSV export (works offline). Draft product publishing via Admin API when connected.",
    isConfigured: () => configured,
    export: (pkg) => ({ filename: `${slugName(pkg)}-shopify-products.csv`, contentType: "text/csv", body: toShopifyCsv(pkg) }),
    async publish(pkg) {
      if (!configured) throw new ProviderNotConfiguredError("Shopify", "set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN");
      if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(cfg.storeDomain!)) throw new Error("SHOPIFY_STORE_DOMAIN must look like your-store.myshopify.com");
      const endpoint = `https://${cfg.storeDomain}/admin/api/${cfg.apiVersion}/graphql.json`;
      const gql = async <T,>(query: string, variables: Record<string, unknown>): Promise<T> => {
        const res = await fetchWithTimeout(endpoint, {
          method: "POST",
          timeoutMs: 30_000,
          headers: { "content-type": "application/json", "x-shopify-access-token": cfg.accessToken! },
          body: JSON.stringify({ query, variables }),
        });
        if (res.status === 429 || res.status >= 500) throw new ProviderTransientError(`Shopify returned ${res.status}`);
        const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
        if (!res.ok || json.errors?.length) throw new Error(`Shopify error: ${json.errors?.map((e) => e.message).join("; ") ?? res.status}`);
        return json.data as T;
      };
      const ids: string[] = [];
      for (const p of pkg.products) {
        const sizes = p.sizes.length ? p.sizes : ["One size"];
        const created = await gql<{ productCreate: { product: { id: string } | null; userErrors: Array<{ message: string }> } }>(
          `mutation ($product: ProductCreateInput!) { productCreate(product: $product) { product { id } userErrors { field message } } }`,
          {
            product: {
              title: p.title,
              handle: p.slug,
              descriptionHtml: productBodyHtml(p),
              vendor: pkg.brand.name,
              productType: p.productType,
              tags: [p.collectionSlug, ...p.badges].filter(Boolean),
              status: "DRAFT",
              seo: { title: p.seoTitle, description: p.seoDescription },
              productOptions: [{ name: "Size", values: sizes.map((name) => ({ name })) }],
            },
          },
        );
        const productId = created.productCreate.product?.id;
        if (!productId) throw new Error(`Shopify productCreate failed: ${created.productCreate.userErrors.map((e) => e.message).join("; ")}`);
        await gql(
          `mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkCreate(productId: $productId, variants: $variants, strategy: REMOVE_STANDALONE_VARIANT) { userErrors { field message } } }`,
          {
            productId,
            variants: sizes.map((size) => ({
              price: p.price.toFixed(2),
              compareAtPrice: p.compareAtPrice ? p.compareAtPrice.toFixed(2) : null,
              optionValues: [{ optionName: "Size", name: size }],
            })),
          },
        );
        ids.push(productId);
      }
      return { externalIds: ids, message: `Created ${ids.length} draft product(s) in Shopify.` };
    },
  };
}

/** Fulfill Engine store sync placeholder — mapping only until the API is documented. */
export function fulfillEngineStoreAdapter(configured: boolean): StoreAdapter {
  return {
    key: "fulfill_engine",
    label: "Fulfill Engine",
    description: "Product → provider SKU mapping export. Live sync requires provider connection.",
    isConfigured: () => configured,
    export: (pkg) => ({
      filename: `${slugName(pkg)}-fulfillment-mapping.json`,
      contentType: "application/json",
      body: JSON.stringify(
        {
          format: "pod-lab.fulfillment-mapping",
          version: 1,
          brand: pkg.brand.code,
          products: pkg.products.map((p) => ({
            productCode: p.code,
            slug: p.slug,
            provider: p.provider,
            providerSku: p.providerSku,
            colors: p.colors,
            sizes: p.sizes,
            design: p.design,
          })),
        },
        null,
        2,
      ),
    }),
    async publish() {
      throw new ProviderNotConfiguredError("Fulfill Engine", "store sync awaits official API documentation");
    },
  };
}
