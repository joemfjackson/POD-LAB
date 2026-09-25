import { serverEnv } from "@/lib/env";
import type { Json } from "@/lib/supabase/database.types";
import { checkDomain } from "@/providers/domains";
import { demoArchitect } from "../demo/architect";
import { agentMoveBrand, check, createGate, must, notify } from "../runtime/db-helpers";
import type { AgentHandler } from "../runtime/types";
import { architectOutputSchema, architectPayloadSchema, type ArchitectOutput, type ArchitectPayload } from "../schemas";

const HANDLE_PLATFORMS = ["instagram", "tiktok", "x"] as const;
const MAX_DOMAIN_CHECKS = 24;

export const brandArchitectHandler: AgentHandler<ArchitectPayload, ArchitectOutput> = {
  key: "brand_architect",
  payloadSchema: architectPayloadSchema,
  outputSchema: architectOutputSchema,

  async prepare(ctx, payload) {
    const { db, workspace } = ctx;
    const brand = must(
      await db.from("brands").select("*").eq("id", payload.brand_id).eq("workspace_id", workspace.id).single(),
      "load brand",
    );
    const opp = brand.opportunity_id
      ? (await db.from("opportunities").select("code, niche, hypothesis, audience, summary, recommended_brand_angle, recommended_customer, strongest_risks, ip_risk_notes").eq("id", brand.opportunity_id).maybeSingle()).data
      : null;
    const names = must(await db.from("brand_names").select("name, status").eq("brand_id", brand.id), "load names");
    const hypothesisNames = names.filter((n) => n.status === "hypothesis").map((n) => n.name);
    const input = {
      brand: {
        code: brand.code,
        working_title: brand.working_title,
        niche: brand.niche,
        sub_niche: brand.sub_niche,
        audience: brand.audience,
        opportunity_thesis: brand.opportunity_thesis,
        research_summary: brand.research_summary,
        hypotheses: brand.hypotheses,
      },
      opportunity: opp,
      hypothesis_names: hypothesisNames,
      rejected_names: names.filter((n) => n.status === "rejected").map((n) => n.name),
      name_count: payload.name_count,
      direction_notes: payload.direction_notes ?? null,
    };
    return {
      input,
      demo: () => demoArchitect({ brand: { working_title: brand.working_title, niche: brand.niche, audience: brand.audience }, hypothesis_names: hypothesisNames, name_count: payload.name_count }),
      sources: [],
      researchMode: ctx.demoMode ? "demo" : "model_only",
      brandId: brand.id,
    };
  },

  async persist(ctx, payload, out) {
    const { db, workspace, job } = ctx;
    const brandId = payload.brand_id;
    const isDemo = ctx.demoMode;
    await agentMoveBrand(db, { workspaceId: workspace.id, brandId, to: "branding", agentKey: "brand_architect", reason: "Brand strategy in progress" });

    // Names (update hypotheses in place; never touch final/rejected decisions)
    const existing = must(await db.from("brand_names").select("id, name, status").eq("brand_id", brandId), "load names");
    const byName = new Map(existing.map((n) => [n.name.toLowerCase(), n]));
    let nameCount = 0;
    let domainChecks = 0;
    const rdapEnabled = serverEnv().DOMAIN_RDAP_ENABLED;

    for (const c of out.name_candidates) {
      const fields = {
        rationale: c.rationale,
        memorability: c.memorability,
        spelling_risk: c.spelling_risk,
        pronunciation_risk: c.pronunciation_risk,
        collision_notes: c.collision_notes,
        trademark_notes: `PRELIMINARY: ${c.trademark_notes}`,
        trademark_risk: c.trademark_risk,
        expansion_potential: c.expansion_potential,
        visual_potential: c.visual_potential,
        agent_run_id: ctx.runId,
      };
      const prior = byName.get(c.name.toLowerCase());
      let nameId: string;
      if (prior) {
        const status = prior.status === "hypothesis" ? "proposed" : prior.status;
        check(await db.from("brand_names").update({ ...fields, status }).eq("id", prior.id), "update name");
        nameId = prior.id;
      } else {
        nameId = must(
          await db.from("brand_names").insert({ ...fields, workspace_id: workspace.id, brand_id: brandId, name: c.name, status: "proposed", is_demo: isDemo }).select("id").single(),
          "insert name",
        ).id;
      }
      nameCount++;

      for (const domain of c.domain_candidates) {
        const result = domainChecks < MAX_DOMAIN_CHECKS ? await checkDomain(domain, { rdapEnabled }) : null;
        if (result) domainChecks++;
        check(
          await db.from("domains").upsert(
            {
              workspace_id: workspace.id,
              brand_id: brandId,
              brand_name_id: nameId,
              domain: domain.toLowerCase(),
              availability: result?.availability ?? "unverified",
              checked_at: result?.checkedAt ?? null,
              check_method: result?.method ?? "none",
              notes: result?.note ?? "Not checked (check limit reached).",
            },
            { onConflict: "brand_id,domain" },
          ),
          "upsert domain",
        );
      }
      for (const handle of c.handle_candidates) {
        for (const platform of HANDLE_PLATFORMS) {
          check(
            await db.from("social_handles").upsert(
              {
                workspace_id: workspace.id,
                brand_id: brandId,
                brand_name_id: nameId,
                platform,
                handle,
                availability: "unverified",
                notes: "Handle availability has no reliable public API — verify manually.",
              },
              { onConflict: "brand_id,platform,handle", ignoreDuplicates: true },
            ),
            "upsert handle",
          );
        }
      }
    }

    const latest = await db.from("brand_identity").select("version").eq("brand_id", brandId).order("version", { ascending: false }).limit(1).maybeSingle();
    const version = (latest.data?.version ?? 0) + 1;
    // Older drafts awaiting approval are superseded by the new version.
    check(await db.from("brand_identity").update({ status: "superseded" }).eq("brand_id", brandId).in("status", ["draft", "pending_approval"]), "supersede drafts");
    const pendingGates = await db.from("approval_gates").select("id").eq("brand_id", brandId).eq("gate_type", "brand_identity_final").eq("status", "pending");
    for (const g of pendingGates.data ?? []) {
      check(await db.from("approval_gates").update({ status: "cancelled", decision_reason: "Superseded by a newer identity version" }).eq("id", g.id), "cancel stale gate");
    }
    const identity = must(
      await db
        .from("brand_identity")
        .insert({
          workspace_id: workspace.id,
          brand_id: brandId,
          version,
          status: "pending_approval",
          audience: out.audience,
          positioning: out.positioning,
          archetype: out.archetype,
          emotional_appeal: out.emotional_appeal,
          tagline: out.recommended_tagline,
          tagline_candidates: out.tagline_candidates,
          brand_story: out.brand_story,
          tone_of_voice: out.tone_of_voice,
          visual_territory: out.visual_territory,
          colors: out.colors as unknown as Json,
          fonts: out.fonts as unknown as Json,
          product_collection_ideas: out.product_collections,
          expansion_paths: out.expansion_paths,
          anti_positioning: out.anti_positioning,
          agent_run_id: ctx.runId,
          is_demo: isDemo,
        })
        .select("id")
        .single(),
      "insert identity",
    );
    check(await db.from("brands").update({ trademark_notes: out.trademark_disclaimer }).eq("id", brandId), "trademark note");

    await createGate(db, {
      workspaceId: workspace.id,
      gateType: "brand_identity_final",
      subjectType: "brand_identity",
      subjectId: identity.id,
      brandId,
      jobId: job.id,
      title: `Approve brand identity v${version}`,
      summary: `${out.positioning.slice(0, 240)} — Tagline: "${out.recommended_tagline}"`,
    });
    await notify(db, {
      workspaceId: workspace.id,
      type: "stage_ready",
      title: `Brand Architect created ${nameCount} name candidates`,
      body: "Review names and approve the identity to unlock creative work.",
      link: `/brands/${brandId}/names`,
      brandId,
    });
    return {
      summary: `Created ${nameCount} name candidates and identity v${version} (awaiting approval)`,
      waitingForApproval: true,
      brandId,
    };
  },
};
