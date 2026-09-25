import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { StorePackage, StoreSection } from "@/providers/commerce/types";
import { UserFacingError } from "./errors";

type Db = SupabaseClient<Database>;

/** Assembles the portable brand/store package from the database (RLS applies). */
export async function buildStorePackage(db: Db, storeId: string): Promise<StorePackage> {
  const store = await db.from("stores").select("*").eq("id", storeId).single();
  if (store.error) throw new UserFacingError("Store not found.");
  const s = store.data;
  const [brand, identity, pages, collections, products, bundles, files, campaigns] = await Promise.all([
    db.from("brands").select("*").eq("id", s.brand_id).single(),
    db.from("brand_identity").select("*").eq("brand_id", s.brand_id).eq("status", "final").maybeSingle(),
    db.from("store_pages").select("*").eq("store_id", storeId).order("page_type"),
    db.from("store_collections").select("*").eq("store_id", storeId).order("sort_order"),
    db
      .from("store_products")
      .select(
        "*, brand_products(code, recommendation, economics, provider_products(product_type, provider_sku, available_colors, available_sizes, product_images, fulfillment_providers(key)), design_concepts(code, title, printing_method))",
      )
      .eq("store_id", storeId)
      .order("sort_order"),
    db.from("bundles").select("name, description, bundle_price, bundle_items(brand_product_id)").eq("brand_id", s.brand_id).neq("status", "retired"),
    db.from("files").select("name, path, kind, mime_type").eq("brand_id", s.brand_id),
    db.from("campaigns").select("code, name, platform, status, is_paid, objective, content_items(count)").eq("brand_id", s.brand_id),
  ]);
  if (brand.error) throw new UserFacingError("Brand not found.");
  const pricing = await db.from("pricing_models").select("*").eq("workspace_id", s.workspace_id).or(`brand_id.eq.${s.brand_id},and(brand_id.is.null,is_default.eq.true)`).order("brand_id", { ascending: true, nullsFirst: false }).limit(1).maybeSingle();

  const collectionSlugById = new Map((collections.data ?? []).map((c) => [c.id, c.slug]));
  const slugById = new Map((products.data ?? []).map((p) => [p.id, p.slug]));
  const slugByBrandProduct = new Map((products.data ?? []).map((p) => [p.brand_product_id, p.slug]));
  const b = brand.data;
  const id = identity.data;

  return {
    format: "pod-lab.store-package",
    version: 1,
    exportedAt: new Date().toISOString(),
    isDemo: s.is_demo || b.is_demo,
    brand: {
      code: b.code,
      name: b.official_name ?? b.working_title,
      niche: b.niche,
      audience: b.audience,
      positioning: b.positioning,
      tagline: b.tagline,
      voice: b.voice,
      stage: b.stage,
    },
    identity: id
      ? {
          colors: (id.colors as Array<{ name: string; hex: string; role: string }>) ?? [],
          fonts: (id.fonts as Array<{ family: string; role: string }>) ?? [],
          story: id.brand_story,
          toneOfVoice: id.tone_of_voice,
          visualTerritory: id.visual_territory,
          archetype: id.archetype,
        }
      : null,
    store: {
      code: s.code,
      name: s.name,
      status: s.status,
      seoTitle: s.seo_title,
      seoDescription: s.seo_description,
      announcement: s.announcement,
      theme: (s.theme as Record<string, unknown>) ?? {},
      navigation: (s.navigation as Array<{ label: string; href: string }>) ?? [],
      cartStrategy: (s.cart_strategy as Record<string, unknown>) ?? {},
      emailCapture: (s.email_capture as Record<string, unknown>) ?? {},
    },
    pages: (pages.data ?? []).map((p) => ({
      pageType: p.page_type,
      slug: p.slug,
      title: p.title,
      seoTitle: p.seo_title,
      seoDescription: p.seo_description,
      sections: (p.sections as StoreSection[]) ?? [],
      isPlaceholder: p.is_placeholder,
    })),
    collections: (collections.data ?? []).map((c) => ({
      slug: c.slug,
      title: c.title,
      description: c.description,
      seoTitle: c.seo_title,
      seoDescription: c.seo_description,
      productSlugs: (products.data ?? []).filter((p) => p.store_collection_id === c.id).map((p) => p.slug),
    })),
    products: (products.data ?? []).map((p) => {
      const bp = p.brand_products;
      const pp = bp?.provider_products;
      return {
        code: bp?.code ?? "",
        slug: p.slug,
        title: p.title,
        description: p.description,
        bulletPoints: p.bullet_points,
        seoTitle: p.seo_title,
        seoDescription: p.seo_description,
        price: Number(p.price),
        compareAtPrice: p.compare_at_price === null ? null : Number(p.compare_at_price),
        badges: p.badges,
        productType: pp?.product_type ?? "other",
        provider: pp?.fulfillment_providers?.key ?? "manual",
        providerSku: pp?.provider_sku ?? "",
        colors: pp?.available_colors ?? [],
        sizes: pp?.available_sizes ?? [],
        collectionSlug: p.store_collection_id ? (collectionSlugById.get(p.store_collection_id) ?? null) : null,
        design: bp?.design_concepts ? { code: bp.design_concepts.code, title: bp.design_concepts.title, printingMethod: bp.design_concepts.printing_method } : null,
        economics: (bp?.economics as Record<string, unknown>) ?? {},
        recommendation: bp?.recommendation ?? null,
        upsellSlugs: p.upsell_product_ids.map((x) => slugById.get(x)).filter((x): x is string => Boolean(x)),
        crossSellSlugs: p.cross_sell_product_ids.map((x) => slugById.get(x)).filter((x): x is string => Boolean(x)),
        images: pp?.product_images ?? [],
      };
    }),
    bundles: (bundles.data ?? []).map((bu) => ({
      name: bu.name,
      description: bu.description,
      price: Number(bu.bundle_price),
      productSlugs: bu.bundle_items.map((i) => slugByBrandProduct.get(i.brand_product_id)).filter((x): x is string => Boolean(x)),
    })),
    pricing: pricing.data ? { ...pricing.data } : null,
    assets: (files.data ?? []).map((f) => ({ name: f.name, path: f.path, kind: f.kind, mimeType: f.mime_type })),
    campaigns: (campaigns.data ?? []).map((c) => ({
      code: c.code,
      name: c.name,
      platform: c.platform,
      status: c.status,
      isPaid: c.is_paid,
      objective: c.objective,
      contentItems: (c.content_items as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
    })),
  };
}
