import { slugify } from "@/domain/slug";
import type { Json } from "@/lib/supabase/database.types";
import { demoCreative } from "../demo/creative";
import { agentMoveBrand, check, must, notify } from "../runtime/db-helpers";
import type { AgentHandler } from "../runtime/types";
import { creativeOutputSchema, creativePayloadSchema, type CreativeOutput, type CreativePayload } from "../schemas";

export const creativeDirectorHandler: AgentHandler<CreativePayload, CreativeOutput> = {
  key: "creative_director",
  payloadSchema: creativePayloadSchema,
  outputSchema: creativeOutputSchema,

  async prepare(ctx, payload) {
    const { db, workspace } = ctx;
    const brand = must(await db.from("brands").select("*").eq("id", payload.brand_id).eq("workspace_id", workspace.id).single(), "load brand");
    const identity = (
      await db.from("brand_identity").select("*").eq("brand_id", brand.id).in("status", ["final", "pending_approval"]).order("status").order("version", { ascending: false }).limit(1).maybeSingle()
    ).data;
    if (payload.mode === "full" && identity?.status !== "final") {
      throw new Error("Creative Director requires an approved (final) brand identity. Approve the identity gate first.");
    }
    const parent = payload.parent_design_id
      ? must(await db.from("design_concepts").select("code, title, concept, collection_id, collections(name)").eq("id", payload.parent_design_id).eq("workspace_id", workspace.id).single(), "load parent design")
      : null;
    if (payload.mode === "derivatives" && !parent) throw new Error("Derivative mode requires parent_design_id");
    const existing = must(await db.from("design_concepts").select("code, title, status").eq("brand_id", brand.id), "load designs");
    const collections = must(await db.from("collections").select("name, description").eq("brand_id", brand.id), "load collections");
    const brandName = brand.official_name ?? brand.working_title;
    const input = {
      mode: payload.mode,
      design_count: payload.design_count,
      notes: payload.notes ?? null,
      brand: { code: brand.code, name: brandName, niche: brand.niche, audience: brand.audience, positioning: brand.positioning, voice: brand.voice, tagline: brand.tagline },
      identity: identity
        ? { visual_territory: identity.visual_territory, colors: identity.colors, fonts: identity.fonts, anti_positioning: identity.anti_positioning, collections: identity.product_collection_ideas }
        : null,
      parent: parent ? { code: parent.code, title: parent.title, concept: parent.concept, collection: parent.collections?.name ?? null } : null,
      existing_designs: existing.map((d) => d.title),
      existing_collections: collections,
    };
    return {
      input,
      demo: () =>
        demoCreative({
          brand: { niche: brand.niche, name: brandName },
          identity: identity ? { colors: (identity.colors as Array<{ name: string; hex: string }>) ?? [] } : null,
          mode: payload.mode,
          parent: input.parent,
          design_count: payload.design_count,
        }),
      sources: [],
      researchMode: ctx.demoMode ? "demo" : "model_only",
      brandId: brand.id,
    };
  },

  async persist(ctx, payload, out) {
    const { db, workspace } = ctx;
    const brandId = payload.brand_id;
    const isDemo = ctx.demoMode;

    if (out.visual_directions.length) {
      const identity = (await db.from("brand_identity").select("id").eq("brand_id", brandId).eq("status", "final").maybeSingle()).data;
      if (identity) {
        check(
          await db.from("brand_identity").update({ visual_directions: out.visual_directions as unknown as Json, selected_direction: out.recommended_direction }).eq("id", identity.id),
          "store visual directions",
        );
      }
    }

    const collectionIds = new Map<string, string>();
    const existingCollections = must(await db.from("collections").select("id, name, slug").eq("brand_id", brandId), "load collections");
    for (const c of existingCollections) collectionIds.set(c.name.toLowerCase(), c.id);
    let order = existingCollections.length;
    const ensureCollection = async (name: string, description?: string, theme?: string) => {
      const key = name.toLowerCase();
      const found = collectionIds.get(key);
      if (found) return found;
      const row = must(
        await db
          .from("collections")
          .upsert(
            { workspace_id: workspace.id, brand_id: brandId, name, slug: slugify(name), description: description ?? null, theme: theme ?? null, sort_order: order++, is_demo: isDemo },
            { onConflict: "brand_id,slug" },
          )
          .select("id")
          .single(),
        "upsert collection",
      );
      collectionIds.set(key, row.id);
      return row.id;
    };
    for (const c of out.collections) await ensureCollection(c.name, c.description, c.theme);

    // Existing "idea" concepts with the same title (e.g. seeded hypotheses) are upgraded in place.
    const ideas = must(await db.from("design_concepts").select("id, title, current_revision").eq("brand_id", brandId).eq("status", "idea"), "load idea designs");
    const ideaByTitle = new Map(ideas.map((d) => [d.title.trim().toLowerCase(), d]));
    const createdIds: string[] = [];
    for (const d of out.designs.slice(0, payload.design_count)) {
      const collectionId = await ensureCollection(d.collection);
      const fields = {
        collection_id: collectionId,
        title: d.title,
        concept: d.concept,
        front_placement: d.front_placement,
        back_placement: d.back_placement,
        sleeve_placement: d.sleeve_placement,
        colors: d.colors,
        typography: d.typography,
        illustration_notes: d.illustration_notes,
        printing_method: d.printing_method,
        embroidery_suitability: d.embroidery_suitability,
        liquid_3d_suitability: d.liquid_3d_suitability,
        preferred_products: d.preferred_products,
        target_buyer: d.target_buyer,
        generation_prompt: d.generation_prompt,
        mockup_prompt: d.mockup_prompt,
        visual_direction: d.visual_direction,
        status: "review" as const,
        compliance_status: "pending" as const,
        agent_run_id: ctx.runId,
      };
      const idea = payload.mode === "full" ? ideaByTitle.get(d.title.trim().toLowerCase()) : undefined;
      let designId: string;
      let revision = 1;
      if (idea) {
        revision = idea.current_revision + 1;
        check(await db.from("design_concepts").update({ ...fields, current_revision: revision }).eq("id", idea.id), "upgrade idea design");
        designId = idea.id;
        ideaByTitle.delete(d.title.trim().toLowerCase());
      } else {
        designId = must(
          await db
            .from("design_concepts")
            .insert({ ...fields, workspace_id: workspace.id, brand_id: brandId, parent_design_id: payload.parent_design_id ?? null, is_demo: isDemo })
            .select("id")
            .single(),
          "insert design",
        ).id;
      }
      createdIds.push(designId);
      check(
        await db.from("design_revisions").insert({
          workspace_id: workspace.id,
          design_id: designId,
          revision_number: revision,
          snapshot: d as unknown as Json,
          change_notes: payload.mode === "derivatives" ? "Derivative created by Creative Director" : idea ? "Idea expanded into a production brief by Creative Director" : "Initial brief by Creative Director",
          actor_type: "agent",
        }),
        "insert revision",
      );
    }

    await agentMoveBrand(db, { workspaceId: workspace.id, brandId, to: "creative", agentKey: "creative_director", reason: "Creative work in progress" });
    await notify(db, {
      workspaceId: workspace.id,
      type: "stage_ready",
      title: `Creative Director created ${createdIds.length} design concept${createdIds.length === 1 ? "" : "s"}`,
      body: "Compliance screening has been queued automatically.",
      link: `/brands/${brandId}/designs`,
      brandId,
    });

    return {
      summary: `Created ${createdIds.length} design concept(s) across ${collectionIds.size} collection(s)${out.visual_directions.length ? " and 3 visual directions" : ""}`,
      waitingForApproval: false,
      brandId,
      // Compliance screening is cheap, rules-first and never spends money, so the Director chains it automatically.
      followUps: createdIds.length
        ? [{ agentKey: "ip_compliance", payload: { brand_id: brandId, design_ids: createdIds }, brandId, priority: 50, dedupeKey: `ip_compliance:${ctx.job.id}` }]
        : [],
    };
  },
};
