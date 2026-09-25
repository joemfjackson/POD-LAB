import { uniqueSlug } from "@/domain/slug";
import type { Json } from "@/lib/supabase/database.types";
import { demoStore } from "../demo/store";
import { check, createGate, must, notify } from "../runtime/db-helpers";
import type { AgentHandler } from "../runtime/types";
import { storeOutputSchema, storePayloadSchema, type StoreOutput, type StorePayload } from "../schemas";
import { loadPricingModel } from "./pricing-model";

export type StoreSection =
  | { type: "hero"; eyebrow: string | null; headline: string; subheadline: string; cta_label: string; cta_href: string }
  | { type: "value_props"; items: Array<{ title: string; body: string }> }
  | { type: "featured_collections"; title: string; collection_slugs: string[] }
  | { type: "product_grid"; title: string; product_slugs: string[] }
  | { type: "story"; headline: string; body: string }
  | { type: "email_capture"; headline: string; body: string; incentive: string | null }
  | { type: "faq"; title: string; items: Array<{ question: string; answer: string }> }
  | { type: "rich_text"; title: string | null; body: string }
  | { type: "contact"; intro: string; response_time: string }
  | { type: "size_guide"; intro: string; rows: Array<{ product: string; product_type: string; sizes: string[] }> }
  | { type: "placeholder_notice"; body: string };

interface Identity {
  colors: Array<{ name: string; hex: string; role: string }>;
  fonts: Array<{ family: string; role: string }>;
}

export function themeFromIdentity(identity: Identity | null, brandName: string) {
  const colors = identity?.colors ?? [];
  const find = (re: RegExp) => colors.find((c) => re.test(`${c.role} ${c.name}`))?.hex;
  const background = find(/background|primary bg|void|ink|black/i) ?? "#0B0B0C";
  const text = find(/text|light|bone|chalk|white/i) ?? "#EDEAE3";
  const accent = find(/accent|signal/i) ?? colors[colors.length - 1]?.hex ?? "#FF5A1F";
  // muted copy must stay readable: blend text toward background instead of using a dark swatch
  const muted = blend(text, background, 0.65);
  const heading = identity?.fonts.find((f) => /head|display|wordmark/i.test(f.role))?.family ?? identity?.fonts[0]?.family ?? "Inter Tight";
  const body = identity?.fonts.find((f) => /body/i.test(f.role))?.family ?? heading;
  return { colors: { background, surface: mix(background), text, muted, accent }, fonts: { heading, body }, logo_text: brandName };
}

function blend(a: string, b: string, weightA: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * weightA + ((pb >> shift) & 255) * (1 - weightA));
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex: string): string {
  // slightly lighter surface derived from the background
  const n = Number.parseInt(hex.slice(1), 16);
  const lift = (v: number) => Math.min(255, v + 18);
  const r = lift((n >> 16) & 255);
  const g = lift((n >> 8) & 255);
  const b = lift(n & 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const storeBuilderHandler: AgentHandler<StorePayload, StoreOutput> = {
  key: "store_builder",
  payloadSchema: storePayloadSchema,
  outputSchema: storeOutputSchema,

  async prepare(ctx, payload) {
    const { db, workspace } = ctx;
    const brand = must(await db.from("brands").select("*").eq("id", payload.brand_id).eq("workspace_id", workspace.id).single(), "load brand");
    const identity = (await db.from("brand_identity").select("*").eq("brand_id", brand.id).eq("status", "final").maybeSingle()).data;
    if (!identity) throw new Error("Store Builder requires an approved brand identity.");
    const products = must(
      await db
        .from("brand_products")
        .select("id, code, title, slug, retail_price, compare_at_price, recommendation, collection_id, provider_products(product_type, available_sizes, available_colors), design_concepts(title, concept)")
        .eq("brand_id", brand.id)
        .eq("status", "approved"),
      "load products",
    );
    if (products.length === 0) throw new Error("No approved products. Approve the product assortment before building the store.");
    const collectionIds = [...new Set(products.map((p) => p.collection_id).filter((x): x is string => Boolean(x)))];
    const collections = collectionIds.length ? must(await db.from("collections").select("id, name, description").in("id", collectionIds), "load collections") : [];
    const pricing = await loadPricingModel(db, workspace.id, brand.id);
    const brandName = brand.official_name ?? brand.working_title;
    const input = {
      brand: { code: brand.code, name: brandName, niche: brand.niche, audience: brand.audience, positioning: brand.positioning, tagline: brand.tagline, voice: brand.voice, story: identity.brand_story },
      identity: { tone_of_voice: identity.tone_of_voice, visual_territory: identity.visual_territory, anti_positioning: identity.anti_positioning },
      collections: collections.map((c) => ({ name: c.name, description: c.description })),
      products: products.map((p) => ({
        code: p.code,
        title: p.title,
        product_type: p.provider_products?.product_type ?? "other",
        price: Number(p.retail_price),
        compare_at_price: p.compare_at_price === null ? null : Number(p.compare_at_price),
        design_concept: p.design_concepts?.concept ?? null,
        sizes: p.provider_products?.available_sizes ?? [],
      })),
      free_shipping_threshold: pricing?.free_shipping_threshold === null || pricing?.free_shipping_threshold === undefined ? null : Number(pricing.free_shipping_threshold),
    };
    return {
      input,
      demo: () => demoStore({ brand: input.brand, collections: input.collections, products: input.products, free_shipping_threshold: input.free_shipping_threshold }),
      sources: [],
      researchMode: ctx.demoMode ? "demo" : "model_only",
      brandId: brand.id,
    };
  },

  async persist(ctx, payload, out) {
    const { db, workspace, job } = ctx;
    const brandId = payload.brand_id;
    const brand = must(await db.from("brands").select("official_name, working_title").eq("id", brandId).single(), "load brand");
    const identity = (await db.from("brand_identity").select("colors, fonts").eq("brand_id", brandId).eq("status", "final").maybeSingle()).data;
    const theme = themeFromIdentity(identity ? { colors: identity.colors as Identity["colors"], fonts: identity.fonts as Identity["fonts"] } : null, out.store_name || brand.official_name || brand.working_title);

    const products = must(
      await db
        .from("brand_products")
        .select("id, code, title, slug, retail_price, compare_at_price, collection_id, collections(name, slug, description), provider_products(product_type, available_sizes)")
        .eq("brand_id", brandId)
        .eq("status", "approved"),
      "load products",
    );

    const existing = (await db.from("stores").select("id, version, status").eq("brand_id", brandId).order("created_at").limit(1).maybeSingle()).data;
    const storeFields = {
      name: out.store_name,
      status: "generated",
      provider: "internal_preview",
      theme: theme as unknown as Json,
      navigation: out.navigation as unknown as Json,
      seo_title: out.seo_title,
      seo_description: out.seo_description,
      announcement: out.announcement,
      cart_strategy: out.cart_strategy as unknown as Json,
      email_capture: out.email_capture as unknown as Json,
      agent_run_id: ctx.runId,
      is_demo: ctx.demoMode,
    };
    let storeId: string;
    let version = 1;
    if (existing?.status === "live") {
      throw new Error("This store is live. Pause it before regenerating so a new version can go through launch approval.");
    }
    if (existing) {
      version = existing.version + 1;
      storeId = existing.id;
      check(await db.from("stores").update({ ...storeFields, version, launch_approved_at: null }).eq("id", storeId), "update store");
      check(await db.from("store_products").delete().eq("store_id", storeId), "clear products");
      check(await db.from("store_collections").delete().eq("store_id", storeId), "clear collections");
      check(await db.from("store_pages").delete().eq("store_id", storeId), "clear pages");
      const stale = await db.from("approval_gates").select("id").eq("subject_id", storeId).eq("gate_type", "store_launch").eq("status", "pending");
      for (const g of stale.data ?? []) {
        check(await db.from("approval_gates").update({ status: "cancelled", decision_reason: `Superseded by store version ${version}` }).eq("id", g.id), "cancel stale gate");
      }
    } else {
      storeId = must(await db.from("stores").insert({ ...storeFields, workspace_id: workspace.id, brand_id: brandId }).select("id").single(), "insert store").id;
    }

    // Collections (from the products' brand collections + model copy)
    const copyByName = new Map(out.collections.map((c) => [c.collection_name.toLowerCase(), c]));
    const storeCollectionIds = new Map<string, { id: string; slug: string }>();
    const collectionSlugs = new Set<string>();
    let sort = 0;
    for (const p of products) {
      const c = p.collections;
      if (!p.collection_id || !c || storeCollectionIds.has(p.collection_id)) continue;
      const copy = copyByName.get(c.name.toLowerCase());
      const slug = uniqueSlug(c.slug, collectionSlugs);
      collectionSlugs.add(slug);
      const row = must(
        await db
          .from("store_collections")
          .insert({
            workspace_id: workspace.id,
            store_id: storeId,
            collection_id: p.collection_id,
            title: copy?.title ?? c.name,
            slug,
            description: copy?.description ?? c.description,
            seo_title: copy?.seo_title ?? null,
            seo_description: copy?.seo_description ?? null,
            sort_order: sort++,
          })
          .select("id, slug")
          .single(),
        "insert store collection",
      );
      storeCollectionIds.set(p.collection_id, row);
    }

    // Products (copy by product code; fall back to catalog data when the model skipped one)
    const copyByCode = new Map(out.products.map((p) => [p.product_code, p]));
    const storeProductIdByCode = new Map<string, string>();
    const productSlugs: string[] = [];
    const productSlugSet = new Set<string>();
    let pSort = 0;
    for (const p of products) {
      const copy = copyByCode.get(p.code);
      const slug = uniqueSlug(p.slug, productSlugSet);
      productSlugSet.add(slug);
      const row = must(
        await db
          .from("store_products")
          .insert({
            workspace_id: workspace.id,
            store_id: storeId,
            brand_product_id: p.id,
            store_collection_id: p.collection_id ? (storeCollectionIds.get(p.collection_id)?.id ?? null) : null,
            title: copy?.title ?? p.title,
            slug,
            description: copy?.description ?? "",
            bullet_points: copy?.bullet_points ?? [],
            seo_title: copy?.seo_title ?? null,
            seo_description: copy?.seo_description ?? null,
            price: Number(p.retail_price),
            compare_at_price: p.compare_at_price === null ? null : Number(p.compare_at_price),
            badges: copy?.badges ?? [],
            sort_order: pSort++,
          })
          .select("id")
          .single(),
        "insert store product",
      );
      storeProductIdByCode.set(p.code, row.id);
      productSlugs.push(slug);
    }
    for (const u of out.upsells) {
      const id = storeProductIdByCode.get(u.product_code);
      if (!id) continue;
      const map = (codes: string[]) => codes.map((c) => storeProductIdByCode.get(c)).filter((x): x is string => Boolean(x) && x !== id);
      check(await db.from("store_products").update({ upsell_product_ids: map(u.upsell_codes), cross_sell_product_ids: map(u.cross_sell_codes) }).eq("id", id), "upsells");
    }

    const collectionSlugList = [...storeCollectionIds.values()].map((c) => c.slug);
    const sizeRows = products.map((p) => ({ product: p.title, product_type: p.provider_products?.product_type ?? "other", sizes: p.provider_products?.available_sizes ?? [] }));
    const pages: Array<{ page_type: string; slug: string; title: string; sections: StoreSection[]; is_placeholder?: boolean; seo_title?: string; seo_description?: string }> = [
      {
        page_type: "home",
        slug: "home",
        title: out.store_name,
        seo_title: out.seo_title,
        seo_description: out.seo_description,
        sections: [
          { type: "hero", ...out.hero, cta_href: "/collections/all" },
          { type: "value_props", items: out.value_props },
          { type: "featured_collections", title: "Collections", collection_slugs: collectionSlugList },
          { type: "product_grid", title: "Shop the drop", product_slugs: productSlugs.slice(0, 8) },
          { type: "story", ...out.brand_story_section },
          { type: "email_capture", ...out.email_capture },
          { type: "faq", title: "FAQ", items: out.faq.slice(0, 4) },
        ],
      },
      { page_type: "about", slug: "about", title: out.about.headline, sections: [{ type: "story", headline: out.about.headline, body: out.about.body }] },
      { page_type: "contact", slug: "contact", title: "Contact", sections: [{ type: "contact", ...out.contact }] },
      { page_type: "faq", slug: "faq", title: "FAQ", sections: [{ type: "faq", title: "Frequently asked questions", items: out.faq }] },
      { page_type: "shipping", slug: "shipping", title: "Shipping", sections: [{ type: "rich_text", title: "Shipping", body: out.shipping_copy }] },
      { page_type: "returns", slug: "returns", title: "Returns", sections: [{ type: "rich_text", title: "Returns", body: out.returns_copy }] },
      { page_type: "size_guide", slug: "size-guide", title: "Size guide", sections: [{ type: "size_guide", intro: out.size_guide_intro, rows: sizeRows }] },
      {
        page_type: "privacy",
        slug: "privacy",
        title: "Privacy policy",
        is_placeholder: true,
        sections: [{ type: "placeholder_notice", body: "Privacy policy placeholder. Replace with a policy reviewed for your jurisdiction, payment provider and analytics tools before launch." }],
      },
      {
        page_type: "terms",
        slug: "terms",
        title: "Terms of service",
        is_placeholder: true,
        sections: [{ type: "placeholder_notice", body: "Terms of service placeholder. Replace with reviewed terms before launch." }],
      },
    ];
    check(
      await db.from("store_pages").insert(
        pages.map((p) => ({
          workspace_id: workspace.id,
          store_id: storeId,
          page_type: p.page_type,
          slug: p.slug,
          title: p.title,
          seo_title: p.seo_title ?? `${p.title} | ${out.store_name}`.slice(0, 70),
          seo_description: p.seo_description ?? null,
          sections: p.sections as unknown as Json,
          is_placeholder: p.is_placeholder ?? false,
          version,
        })),
      ),
      "insert pages",
    );

    await createGate(db, {
      workspaceId: workspace.id,
      gateType: "store_launch",
      subjectType: "store",
      subjectId: storeId,
      brandId,
      jobId: job.id,
      title: `Approve launch of ${out.store_name} (v${version})`,
      summary: `${products.length} products, ${collectionSlugList.length} collections, ${pages.length} pages. Privacy/terms are placeholders and must be replaced before going live.`,
    });
    await notify(db, { workspaceId: workspace.id, type: "store_built", title: `Store Builder generated ${out.store_name} v${version}`, link: `/stores/${storeId}/preview`, brandId });
    return { summary: `Generated store v${version}: ${pages.length} pages, ${products.length} products, ${collectionSlugList.length} collections`, waitingForApproval: true, brandId };
  },
};
