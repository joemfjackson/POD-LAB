import { capConfidence, evidenceConfidenceCeiling, type EvidenceKind } from "@/domain/scoring";
import { nicheKey } from "@/domain/slug";
import type { Json } from "@/lib/supabase/database.types";
import { numberDocuments, type ResearchDocument } from "@/providers/research/types";
import { demoScout } from "../demo/scout";
import { agentMoveBrand, check, createGate, must, notify } from "../runtime/db-helpers";
import type { AgentContext, AgentHandler, Prepared, ResearchMode } from "../runtime/types";
import { scoutOutputSchema, scoutPayloadSchema, type ScoutOpportunity, type ScoutOutput, type ScoutPayload } from "../schemas";

function buildQueries(prompt: string, niche: string | null, depth: number): string[] {
  const subject = niche ?? prompt;
  const base = [
    subject,
    `${subject} community merchandise`,
    `${subject} reddit`,
    `${subject} t-shirt etsy`,
    `${subject} gifts`,
    `${subject} trend 2026`,
  ];
  return base.slice(0, Math.min(base.length, depth * 2 + 1));
}

export interface NormalizedEvidence {
  claim: string;
  kind: EvidenceKind;
  confidence: "low" | "medium" | "high";
  quote: string | null;
  source: ResearchDocument | null;
}

/**
 * Maps model evidence onto retrieved sources. A claim tagged as a measured
 * fact or observed signal without a valid retrieved source is downgraded to an
 * assumption — inference is never silently stored as fact.
 */
export function normalizeEvidence(items: ScoutOpportunity["evidence"], sources: readonly ResearchDocument[]): NormalizedEvidence[] {
  const byRef = new Map(sources.map((s) => [s.ref, s]));
  return items.map((e) => {
    const source = e.source_ref ? (byRef.get(e.source_ref) ?? null) : null;
    const needsSource = e.kind === "measured_fact" || e.kind === "observed_signal";
    if (needsSource && !source) {
      return { claim: `${e.claim} (unverified — no retrieved source)`, kind: "assumption", confidence: "low", quote: null, source: null };
    }
    return { claim: e.claim, kind: e.kind, confidence: e.confidence, quote: source ? e.quote_snippet : null, source };
  });
}

export const opportunityScoutHandler: AgentHandler<ScoutPayload, ScoutOutput> = {
  key: "opportunity_scout",
  payloadSchema: scoutPayloadSchema,
  outputSchema: scoutOutputSchema,

  async prepare(ctx: AgentContext, payload): Promise<Prepared<ScoutOutput>> {
    const { db, workspace } = ctx;
    const maxCandidates = payload.mission_type === "discover" ? Math.min(payload.max_candidates, workspace.max_candidates) : 1;
    const depth = Math.min(payload.research_depth, workspace.max_research_depth);

    const brand = payload.brand_id
      ? must(await db.from("brands").select("id, code, working_title, niche, sub_niche, audience, hypotheses").eq("id", payload.brand_id).eq("workspace_id", workspace.id).single(), "load brand")
      : null;
    const existing = await db
      .from("opportunities")
      .select("code, niche, status, researched_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(200);
    check(existing, "load existing opportunities");

    let sources: ResearchDocument[] = [];
    let researchMode: ResearchMode = ctx.demoMode ? "demo" : "model_only";
    if (!ctx.demoMode && ctx.research.live) {
      const queries = buildQueries(payload.prompt, brand?.niche ?? null, depth);
      const results = await Promise.all(queries.map((q) => ctx.research.search(q, { maxResults: 5 })));
      sources = numberDocuments(results.flat(), 10 * depth);
      researchMode = sources.length > 0 ? "live" : "model_only";
    }

    const input = {
      mission: { prompt: payload.prompt, mission_type: payload.mission_type },
      constraints: { max_candidates: maxCandidates, research_depth: depth, research_mode: researchMode },
      brand: brand ? { code: brand.code, working_title: brand.working_title, niche: brand.niche, sub_niche: brand.sub_niche, audience: brand.audience, hypotheses: brand.hypotheses } : null,
      already_researched: (existing.data ?? []).map((o) => ({ code: o.code, niche: o.niche, status: o.status })),
      sources: sources.map((s) => ({ ref: s.ref, title: s.title, publisher: s.publisher, published_at: s.publishedAt, snippet: s.snippet })),
    };
    return {
      input,
      demo: () => demoScout({ mission: input.mission, constraints: { max_candidates: maxCandidates }, brand: brand ? { niche: brand.niche } : null }),
      sources,
      researchMode,
      brandId: brand?.id ?? null,
      opportunityId: payload.opportunity_id ?? null,
    };
  },

  async persist(ctx, payload, output, prepared) {
    const { db, workspace, job } = ctx;
    const maxCandidates = payload.mission_type === "discover" ? Math.min(payload.max_candidates, workspace.max_candidates) : 1;
    const isDemo = prepared.researchMode === "demo";
    const created: Array<{ id: string; code: string; niche: string }> = [];
    const duplicates: string[] = [];
    let gateCreated = false;

    for (const [index, opp] of output.opportunities.slice(0, maxCandidates).entries()) {
      const key = nicheKey(opp.niche);
      const evidence = normalizeEvidence(opp.evidence, prepared.sources);
      const ceiling = evidenceConfidenceCeiling(
        evidence.map((e) => ({ kind: e.kind, sourced: e.source !== null })),
        prepared.researchMode,
      );
      const confidence = capConfidence(opp.confidence, ceiling);

      // Resolve target: explicit opportunity (investigate/revisit) → brand's linked opportunity → dedupe by niche key.
      let targetId: string | null = index === 0 ? (payload.opportunity_id ?? null) : null;
      if (!targetId && index === 0 && prepared.brandId) {
        const linked = await db.from("opportunities").select("id").eq("brand_id", prepared.brandId).order("created_at").limit(1).maybeSingle();
        targetId = linked.data?.id ?? null;
      }
      if (!targetId) {
        const dupe = await db.from("opportunities").select("id, code, status").eq("workspace_id", workspace.id).eq("niche_key", key).maybeSingle();
        if (dupe.data) {
          duplicates.push(dupe.data.code);
          continue;
        }
      }

      const fields = {
        niche: opp.niche,
        niche_key: key,
        hypothesis: opp.hypothesis,
        audience: opp.audience,
        summary: opp.summary,
        confidence,
        strongest_signal: opp.strongest_signal,
        biggest_risk: opp.biggest_risk,
        strongest_evidence: opp.strongest_evidence,
        strongest_risks: opp.strongest_risks,
        recommended_customer: opp.recommended_customer,
        recommended_brand_angle: opp.recommended_brand_angle,
        recommended_first_products: opp.recommended_first_products,
        recommended_test_strategy: opp.recommended_test_strategy,
        suggested_sub_niches: opp.suggested_sub_niches,
        seasonality: opp.seasonality,
        ip_risk_notes: opp.ip_risk_notes,
        geographic_notes: opp.geographic_notes || null,
        cultural_risk_notes: opp.cultural_risk_notes || null,
        researched_at: ctx.now.toISOString(),
        research_mode: prepared.researchMode,
        is_demo: isDemo,
      };

      let row: { id: string; code: string; status: string };
      if (targetId) {
        // Keep the niche key of an existing record to avoid colliding with another opportunity.
        const { niche_key: _key, ...rest } = fields;
        const current = must(await db.from("opportunities").select("status").eq("id", targetId).single(), "load opportunity");
        // re-research never demotes an already approved opportunity
        const status = current.status === "approved" ? "approved" : "candidate";
        row = must(
          await db.from("opportunities").update({ ...rest, status }).eq("id", targetId).eq("workspace_id", workspace.id).select("id, code, status").single(),
          "update opportunity",
        );
      } else {
        row = must(
          await db
            .from("opportunities")
            .insert({ ...fields, workspace_id: workspace.id, mission_id: payload.mission_id ?? null, status: "candidate", brand_id: prepared.brandId ?? null })
            .select("id, code, status")
            .single(),
          "insert opportunity",
        );
      }
      created.push({ id: row.id, code: row.code, niche: opp.niche });

      check(await db.from("opportunity_scores").delete().eq("opportunity_id", row.id), "clear scores");
      check(
        await db.from("opportunity_scores").insert(
          opp.scores.map((s) => ({
            workspace_id: workspace.id,
            opportunity_id: row.id,
            dimension: s.dimension,
            score: Math.round(Math.min(10, Math.max(0, s.score)) * 10) / 10,
            explanation: s.explanation,
            evidence_kind: prepared.researchMode === "live" ? ("inferred_conclusion" as const) : ("assumption" as const),
          })),
        ),
        "insert scores",
      );

      const report = must(
        await db
          .from("research_reports")
          .insert({
            workspace_id: workspace.id,
            opportunity_id: row.id,
            brand_id: prepared.brandId ?? null,
            mission_id: payload.mission_id ?? null,
            agent_run_id: ctx.runId,
            report_type: "opportunity",
            title: `${opp.niche} — opportunity research`,
            summary: opp.summary,
            research_mode: prepared.researchMode,
            snapshot: { opportunity: opp, method_note: output.method_note, confidence_ceiling: ceiling, confidence_claimed: opp.confidence } as unknown as Json,
            is_demo: isDemo,
          })
          .select("id")
          .single(),
        "insert report",
      );

      if (evidence.length) {
        check(
          await db.from("research_sources").insert(
            evidence.map((e) => ({
              workspace_id: workspace.id,
              report_id: report.id,
              opportunity_id: row.id,
              brand_id: prepared.brandId ?? null,
              source_type: e.source?.sourceType ?? ("none" as const),
              source_url: e.source?.url ?? null,
              source_title: e.source?.title ?? null,
              publisher: e.source?.publisher ?? null,
              published_at: e.source?.publishedAt ?? null,
              retrieved_at: e.source?.retrievedAt ?? null,
              claim: e.claim,
              quote_snippet: e.quote,
              evidence_kind: e.kind,
              confidence: e.confidence,
              is_demo: isDemo,
            })),
          ),
          "insert evidence",
        );
      }

      if (prepared.brandId && index === 0) {
        check(await db.from("opportunities").update({ brand_id: prepared.brandId }).eq("id", row.id), "link brand");
        check(
          await db
            .from("brands")
            .update({ research_summary: opp.summary, risk_summary: opp.biggest_risk, opportunity_id: row.id, audience: opp.audience })
            .eq("id", prepared.brandId),
          "update brand research",
        );
        if (row.status === "approved") continue;
        await agentMoveBrand(db, { workspaceId: workspace.id, brandId: prepared.brandId, to: "researching", agentKey: "opportunity_scout", reason: "Research started" });
        await agentMoveBrand(db, { workspaceId: workspace.id, brandId: prepared.brandId, to: "candidate", agentKey: "opportunity_scout", reason: "Research complete; awaiting human approval" });
        const gate = await createGate(db, {
          workspaceId: workspace.id,
          gateType: "opportunity_approval",
          subjectType: "opportunity",
          subjectId: row.id,
          brandId: prepared.brandId,
          jobId: job.id,
          title: `Approve opportunity ${row.code}: ${opp.niche}`,
          summary: `Confidence ${confidence}. Strongest signal: ${opp.strongest_signal}. Biggest risk: ${opp.biggest_risk}.`,
        });
        gateCreated = gate !== null;
      }
    }

    if (payload.mission_id) {
      check(
        await db.from("research_missions").update({ status: "completed", opportunities_found: created.length }).eq("id", payload.mission_id),
        "complete mission",
      );
    }

    await notify(db, {
      workspaceId: workspace.id,
      type: "stage_ready",
      title: `Opportunity Scout generated ${created.length} opportunit${created.length === 1 ? "y" : "ies"}`,
      body: duplicates.length ? `Skipped ${duplicates.length} already-researched niche(s): ${duplicates.join(", ")}` : undefined,
      link: prepared.brandId ? `/brands/${prepared.brandId}/research` : "/opportunities?view=candidates",
      brandId: prepared.brandId,
    });

    const modeNote = prepared.researchMode === "live" ? `${prepared.sources.length} live sources` : prepared.researchMode === "demo" ? "demo mode" : "no live sources";
    return {
      summary: `Generated ${created.length} opportunit${created.length === 1 ? "y" : "ies"}${duplicates.length ? ` (${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"} skipped)` : ""} — ${modeNote}`,
      waitingForApproval: gateCreated,
      brandId: prepared.brandId,
    };
  },
};
