import type { Json } from "@/lib/supabase/database.types";
import { demoGrowth } from "../demo/growth";
import { check, createGate, must, notify } from "../runtime/db-helpers";
import type { AgentHandler } from "../runtime/types";
import { growthOutputSchema, growthPayloadSchema, type GrowthOutput, type GrowthPayload } from "../schemas";

export const growthHandler: AgentHandler<GrowthPayload, GrowthOutput> = {
  key: "growth",
  payloadSchema: growthPayloadSchema,
  outputSchema: growthOutputSchema,

  async prepare(ctx, payload) {
    const { db, workspace } = ctx;
    const brand = must(await db.from("brands").select("*").eq("id", payload.brand_id).eq("workspace_id", workspace.id).single(), "load brand");
    const identity = (await db.from("brand_identity").select("tone_of_voice, brand_story, anti_positioning").eq("brand_id", brand.id).eq("status", "final").maybeSingle()).data;
    const products = must(await db.from("brand_products").select("code, title, retail_price, recommendation").eq("brand_id", brand.id).eq("status", "approved").limit(30), "load products");
    const store = (await db.from("stores").select("name, status, seo_description").eq("brand_id", brand.id).maybeSingle()).data;
    const brandName = brand.official_name ?? brand.working_title;
    const input = {
      brand: { code: brand.code, name: brandName, niche: brand.niche, audience: brand.audience, positioning: brand.positioning, tagline: brand.tagline, voice: brand.voice },
      identity,
      products: products.map((p) => ({ code: p.code, title: p.title, price: Number(p.retail_price), recommendation: p.recommendation })),
      store,
      focus: payload.focus ?? null,
    };
    return {
      input,
      demo: () => demoGrowth({ brand: { name: brandName, niche: brand.niche, audience: brand.audience }, products: input.products }),
      sources: [],
      researchMode: ctx.demoMode ? "demo" : "model_only",
      brandId: brand.id,
    };
  },

  async persist(ctx, payload, out) {
    const { db, workspace, job } = ctx;
    const brandId = payload.brand_id;
    const isDemo = ctx.demoMode;

    const launch = must(
      await db
        .from("campaigns")
        .insert({
          workspace_id: workspace.id,
          brand_id: brandId,
          name: out.launch_campaign.name,
          platform: "multi",
          objective: out.launch_campaign.objective,
          audience: out.audience,
          status: "draft",
          is_paid: false,
          strategy: {
            summary: out.launch_campaign.summary,
            platform_strategy: out.platform_strategy,
            content_pillars: out.content_pillars,
            hooks: out.hooks,
            ugc_concepts: out.ugc_concepts,
            organic_vs_paid: out.organic_vs_paid,
            landing_page_experiments: out.landing_page_experiments,
            discount_experiments: out.discount_experiments,
          } as unknown as Json,
          agent_run_id: ctx.runId,
          is_demo: isDemo,
        })
        .select("id")
        .single(),
      "insert launch campaign",
    );

    const content = [
      ...out.calendar.map((c) => ({ platform: c.platform, content_type: c.content_type, title: c.title, body: c.hook ? `HOOK: ${c.hook}\n\n${c.body}` : c.body, day_offset: c.day })),
      ...out.content_pillars.map((p) => ({ platform: "multi", content_type: "content_pillar" as const, title: p.name, body: p.description, day_offset: null })),
      { platform: "influencer", content_type: "influencer_brief" as const, title: "Influencer brief", body: out.influencer_brief, day_offset: null },
      ...out.outreach_templates.map((t) => ({ platform: "influencer", content_type: "outreach_template" as const, title: t.name, body: t.body, day_offset: null })),
      ...out.ugc_concepts.map((u, i) => ({ platform: "multi", content_type: "ugc_concept" as const, title: `UGC concept ${i + 1}`, body: u, day_offset: null })),
      ...out.landing_page_experiments.map((l) => ({ platform: "store", content_type: "landing_page_experiment" as const, title: l.name, body: l.hypothesis, day_offset: null })),
      ...out.discount_experiments.map((d) => ({ platform: "store", content_type: "discount_experiment" as const, title: d.name, body: `${d.offer}\n\n${d.hypothesis}`, day_offset: null })),
    ];
    check(
      await db.from("content_items").insert(content.map((c) => ({ ...c, workspace_id: workspace.id, brand_id: brandId, campaign_id: launch.id, status: "draft" }))),
      "insert content",
    );

    let paidGates = 0;
    for (const p of out.paid_plan) {
      const camp = must(
        await db
          .from("campaigns")
          .insert({
            workspace_id: workspace.id,
            brand_id: brandId,
            name: `${p.platform} paid test — ${p.objective}`.slice(0, 200),
            platform: p.platform,
            objective: p.objective,
            audience: p.audience,
            status: "pending_approval",
            is_paid: true,
            proposed_budget_usd: p.proposed_budget_usd,
            strategy: { proposal: p } as unknown as Json,
            agent_run_id: ctx.runId,
            is_demo: isDemo,
          })
          .select("id, code")
          .single(),
        "insert paid campaign",
      );
      await createGate(db, {
        workspaceId: workspace.id,
        gateType: "paid_campaign_spend",
        subjectType: "campaign",
        subjectId: camp.id,
        brandId,
        jobId: job.id,
        title: `Approve paid spend: ${camp.code} (${p.platform}, $${p.proposed_budget_usd.toFixed(0)})`,
        summary: `${p.objective}. Audience: ${p.audience}. Nothing is spent without this approval.`,
        payload: { budget_usd: p.proposed_budget_usd },
      });
      paidGates++;
    }

    let experiments = 0;
    for (const e of out.experiments) {
      const exp = must(
        await db
          .from("experiments")
          .insert({
            workspace_id: workspace.id,
            brand_id: brandId,
            name: e.name,
            experiment_type: e.experiment_type,
            hypothesis: e.hypothesis,
            primary_metric: e.primary_metric,
            minimum_sample: e.minimum_sample,
            status: "draft",
            campaign_id: launch.id,
            is_demo: isDemo,
          })
          .select("id")
          .single(),
        "insert experiment",
      );
      check(
        await db.from("experiment_variants").insert(
          e.variants.map((v, i) => ({ workspace_id: workspace.id, experiment_id: exp.id, key: String.fromCharCode(65 + i), name: v.name, description: v.description, is_control: i === 0 })),
        ),
        "insert variants",
      );
      experiments++;
    }

    await notify(db, {
      workspaceId: workspace.id,
      type: "stage_ready",
      title: `Growth plan ready: ${content.length} content items, ${experiments} experiments`,
      body: paidGates ? `${paidGates} paid proposal(s) await spending approval.` : undefined,
      link: `/brands/${brandId}/growth`,
      brandId,
    });
    return {
      summary: `Created launch plan with ${content.length} content items, ${experiments} experiment(s) and ${paidGates} paid proposal(s) awaiting approval`,
      waitingForApproval: paidGates > 0,
      brandId,
    };
  },
};
