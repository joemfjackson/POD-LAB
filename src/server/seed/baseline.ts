import { AI_SI_BRAND_HYPOTHESES, AI_SI_COLLECTIONS, AI_SI_DESIGNS, AI_SI_AVOID } from "@/agents/demo/ai-si";
import { demoScout } from "@/agents/demo/scout";
import { check, must } from "@/agents/runtime/db-helpers";
import { nicheKey, slugify } from "@/domain/slug";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { ensureWorkspaceDefaults, loadMockCatalog } from "../services/workspace";

export const PL_0001 = {
  working_title: "AI / Superintelligence",
  niche: "AI / Artificial Superintelligence",
  sub_niche: "AI · AGI · ASI · singularity · human-machine · alignment",
  audience: "Technologists, researchers, founders and AI-curious professionals",
  concept:
    "A premium future-intelligence / AI / AGI / ASI / singularity / human-machine / alignment lifestyle and streetwear brand.",
  visual_positioning: "research laboratory + premium streetwear + technical typography + future intelligence culture",
};

/**
 * Baseline DEMO data: PL-0001 at "researching" with early hypotheses, the mock
 * catalog, a sample opportunity report (demo-labelled), a sample trend and a
 * sample insight. Idempotent per workspace.
 */
export async function seedBaseline(db: AdminClient, workspaceId: string, userId: string | null) {
  await ensureWorkspaceDefaults(db, workspaceId);
  await loadMockCatalog(db, workspaceId);

  const existing = await db.from("brands").select("id").eq("workspace_id", workspaceId).eq("working_title", PL_0001.working_title).maybeSingle();
  if (existing.data) return { brandId: existing.data.id, created: false };

  const brand = must(
    await db
      .from("brands")
      .insert({
        workspace_id: workspaceId,
        working_title: PL_0001.working_title,
        niche: PL_0001.niche,
        sub_niche: PL_0001.sub_niche,
        audience: PL_0001.audience,
        stage: "researching",
        opportunity_thesis: PL_0001.concept,
        hypotheses: {
          concept: PL_0001.concept,
          name_hypotheses: [...AI_SI_BRAND_HYPOTHESES],
          collection_concepts: AI_SI_COLLECTIONS.map((c) => c.name),
          visual_positioning: PL_0001.visual_positioning,
          avoid: AI_SI_AVOID,
          note: "Early hypotheses only — to be tested through Brand Architect research.",
        } as unknown as Json,
        is_demo: true,
        created_by: userId,
      })
      .select("id, code")
      .single(),
    "seed PL-0001",
  );
  check(
    await db.from("brand_stage_history").insert({ workspace_id: workspaceId, brand_id: brand.id, from_stage: null, to_stage: "researching", actor_type: "system", reason: "Seeded as the first brand" }),
    "seed history",
  );

  check(
    await db.from("brand_names").insert(
      AI_SI_BRAND_HYPOTHESES.map((name) => ({
        workspace_id: workspaceId,
        brand_id: brand.id,
        name,
        rationale: "Early hypothesis from the founding brief — not yet researched.",
        status: "hypothesis" as const,
        trademark_notes: "Not researched yet.",
        is_demo: true,
      })),
    ),
    "seed name hypotheses",
  );

  check(
    await db.from("collections").insert(
      AI_SI_COLLECTIONS.map((c, i) => ({ workspace_id: workspaceId, brand_id: brand.id, name: c.name, slug: slugify(c.name), description: c.description, theme: c.theme, status: "concept", sort_order: i, is_demo: true })),
    ),
    "seed collection concepts",
  );
  const collections = must(await db.from("collections").select("id, name").eq("brand_id", brand.id), "load collections");
  const collectionId = new Map(collections.map((c) => [c.name, c.id]));
  check(
    await db.from("design_concepts").insert(
      AI_SI_DESIGNS.map((d) => ({
        workspace_id: workspaceId,
        brand_id: brand.id,
        collection_id: collectionId.get(d.collection) ?? null,
        title: d.title,
        concept: `${d.concept} (Sample concept — not finalised IP.)`,
        front_placement: d.front,
        back_placement: d.back,
        sleeve_placement: d.sleeve,
        printing_method: d.method,
        status: "idea" as const,
        is_demo: true,
      })),
    ),
    "seed sample concepts",
  );

  // Sample opportunity research (demo-labelled; all evidence is assumption)
  const sample = demoScout({ mission: { prompt: "Investigate whether artificial intelligence / superintelligence is a strong POD market", mission_type: "investigate" }, constraints: { max_candidates: 1 }, brand: { niche: PL_0001.niche } }).opportunities[0]!;
  const mission = must(
    await db
      .from("research_missions")
      .insert({
        workspace_id: workspaceId,
        title: "Investigate AI / Superintelligence",
        prompt: "Investigate whether artificial intelligence / superintelligence is a strong POD market.",
        mission_type: "investigate",
        max_candidates: 1,
        status: "draft",
        created_by: userId,
        brand_id: brand.id,
        is_demo: true,
      })
      .select("id")
      .single(),
    "seed mission",
  );
  const opp = must(
    await db
      .from("opportunities")
      .insert({
        workspace_id: workspaceId,
        mission_id: mission.id,
        niche: sample.niche,
        niche_key: nicheKey(sample.niche),
        hypothesis: sample.hypothesis,
        audience: sample.audience,
        summary: sample.summary,
        status: "researching",
        confidence: "low",
        strongest_signal: sample.strongest_signal,
        biggest_risk: sample.biggest_risk,
        strongest_evidence: sample.strongest_evidence,
        strongest_risks: sample.strongest_risks,
        recommended_customer: sample.recommended_customer,
        recommended_brand_angle: sample.recommended_brand_angle,
        recommended_first_products: sample.recommended_first_products,
        recommended_test_strategy: sample.recommended_test_strategy,
        suggested_sub_niches: sample.suggested_sub_niches,
        seasonality: sample.seasonality,
        ip_risk_notes: sample.ip_risk_notes,
        research_mode: "demo",
        researched_at: new Date().toISOString(),
        brand_id: brand.id,
        is_demo: true,
        created_by: userId,
      })
      .select("id")
      .single(),
    "seed opportunity",
  );
  check(await db.from("brands").update({ opportunity_id: opp.id }).eq("id", brand.id), "link opportunity");
  check(
    await db.from("opportunity_scores").insert(sample.scores.map((s) => ({ workspace_id: workspaceId, opportunity_id: opp.id, dimension: s.dimension, score: s.score, explanation: s.explanation, evidence_kind: "assumption" as const }))),
    "seed scores",
  );
  const report = must(
    await db
      .from("research_reports")
      .insert({ workspace_id: workspaceId, opportunity_id: opp.id, brand_id: brand.id, mission_id: mission.id, title: "AI / Superintelligence — sample research (demo)", summary: sample.summary, research_mode: "demo", snapshot: { opportunity: sample } as unknown as Json, is_demo: true })
      .select("id")
      .single(),
    "seed report",
  );
  check(
    await db.from("research_sources").insert(
      sample.evidence.map((e) => ({ workspace_id: workspaceId, report_id: report.id, opportunity_id: opp.id, brand_id: brand.id, source_type: "none" as const, claim: e.claim, evidence_kind: "assumption" as const, confidence: "low" as const, is_demo: true })),
    ),
    "seed evidence",
  );

  check(
    await db.from("notes").insert({
      workspace_id: workspaceId,
      brand_id: brand.id,
      subject_type: "brand",
      subject_id: brand.id,
      body: `Founding brief: ${PL_0001.concept}\n\nVisual positioning: ${PL_0001.visual_positioning}.\n\nAvoid: ${AI_SI_AVOID.join(", ")}.`,
      author_id: userId,
    }),
    "seed note",
  );
  check(
    await db.from("trends").insert({
      workspace_id: workspaceId,
      name: "AI-native professions (sample)",
      category: "ai_tech",
      summary: "Sample trend record showing the Trend Watcher structure. Not researched.",
      velocity: "unknown",
      estimated_lifespan: "multi_year",
      pod_relevance: 7,
      recommended_action: "Send to Opportunity Scout",
      research_mode: "demo",
      is_demo: true,
    }),
    "seed trend",
  );
  check(
    await db.from("insights").insert({
      workspace_id: workspaceId,
      title: "Hypothesis: embroidered hats may carry higher margin than DTG tees in tech niches (sample)",
      body: "Sample user-created hypothesis to illustrate the Insights system. Not validated — needs an experiment.",
      source: "human",
      claim_type: "hypothesis",
      confidence: "low",
      brand_id: brand.id,
      created_by: userId,
      is_demo: true,
    }),
    "seed insight",
  );
  check(
    await db.from("audit_log").insert({ workspace_id: workspaceId, actor_type: "system", action: "seed.baseline", summary: `Seeded demo data: ${brand.code} AI / Superintelligence (researching)`, brand_id: brand.id }),
    "seed audit",
  );
  return { brandId: brand.id, created: true };
}
