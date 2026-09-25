import "server-only";
import { notFound } from "next/navigation";
import { safeTheme, type SfCollection, type SfPage, type SfProduct, type SfStore } from "@/components/storefront/types";
import type { AppContext } from "../context";
import { designThumbnails } from "./assets";

/** Loads everything the storefront renderer needs for a store (RLS applies). */
export async function loadStorefront(ctx: AppContext, storeId: string) {
  const s = await ctx.db.from("stores").select("*, brands(id, code, official_name, working_title)").eq("id", storeId).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!s.data) notFound();
  const [pages, collections, products] = await Promise.all([
    ctx.db.from("store_pages").select("page_type, slug, title, sections, is_placeholder").eq("store_id", storeId),
    ctx.db.from("store_collections").select("id, slug, title, description").eq("store_id", storeId).order("sort_order"),
    ctx.db
      .from("store_products")
      .select("id, slug, title, description, bullet_points, price, compare_at_price, badges, store_collection_id, upsell_product_ids, cross_sell_product_ids, brand_products(design_id, provider_products(product_type, available_colors, available_sizes), design_concepts(title))")
      .eq("store_id", storeId)
      .order("sort_order"),
  ]);
  const designIds = (products.data ?? []).map((p) => p.brand_products?.design_id).filter((x): x is string => Boolean(x));
  const thumbs = await designThumbnails(ctx.db, designIds);
  const colSlug = new Map((collections.data ?? []).map((c) => [c.id, c.slug]));
  const brandName = s.data.brands?.official_name ?? s.data.brands?.working_title ?? s.data.name;

  const store: SfStore = {
    id: s.data.id,
    name: s.data.name,
    announcement: s.data.announcement,
    navigation: ((s.data.navigation as Array<{ label: string; href: string }>) ?? []).filter((n) => typeof n?.href === "string" && n.href.startsWith("/")),
    theme: safeTheme(s.data.theme, brandName),
    cart_strategy: (s.data.cart_strategy as SfStore["cart_strategy"]) ?? {},
    email_capture: (s.data.email_capture as SfStore["email_capture"]) ?? {},
    is_demo: s.data.is_demo,
  };
  const sfProducts: SfProduct[] = (products.data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    bullet_points: p.bullet_points,
    price: Number(p.price),
    compare_at_price: p.compare_at_price === null ? null : Number(p.compare_at_price),
    badges: p.badges,
    product_type: p.brand_products?.provider_products?.product_type ?? "other",
    colors: p.brand_products?.provider_products?.available_colors ?? [],
    sizes: p.brand_products?.provider_products?.available_sizes ?? [],
    collection_slug: p.store_collection_id ? (colSlug.get(p.store_collection_id) ?? null) : null,
    design_title: p.brand_products?.design_concepts?.title ?? null,
    image: p.brand_products?.design_id ? (thumbs.get(p.brand_products.design_id) ?? null) : null,
    upsell_ids: p.upsell_product_ids,
    cross_sell_ids: p.cross_sell_product_ids,
  }));
  return {
    raw: s.data,
    store,
    pages: (pages.data ?? []) as SfPage[],
    collections: (collections.data ?? []) as SfCollection[],
    products: sfProducts,
  };
}
