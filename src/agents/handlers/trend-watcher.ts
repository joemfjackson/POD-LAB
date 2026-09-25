import { numberDocuments, type ResearchDocument } from "@/providers/research/types";
import { demoTrends } from "../demo/trends";
import { check, must, notify } from "../runtime/db-helpers";
import type { AgentHandler, ResearchMode } from "../runtime/types";
import { trendOutputSchema, trendPayloadSchema, type TrendOutput, type TrendPayload } from "../schemas";
import { normalizeEvidence } from "./opportunity-scout";

export const trendWatcherHandler: AgentHandler<TrendPayload, TrendOutput> = {
  key: "trend_watcher",
  payloadSchema: trendPayloadSchema,
  outputSchema: trendOutputSchema,

  async prepare(ctx, payload) {
    const { db, workspace } = ctx;
    const known = must(await db.from("trends").select("name, status").eq("workspace_id", workspace.id).order("detected_at", { ascending: false }).limit(100), "load trends");
    let sources: ResearchDocument[] = [];
    let researchMode: ResearchMode = ctx.demoMode ? "demo" : "model_only";
    if (!ctx.demoMode && ctx.research.live) {
      const queries = [`emerging ${payload.focus}`, `${payload.focus} trend`, `new community ${payload.focus} merchandise`];
      const results = await Promise.all(queries.map((q) => ctx.research.search(q, { maxResults: 6 })));
      sources = numberDocuments(results.flat(), 18);
      researchMode = sources.length ? "live" : "model_only";
    }
    const input = {
      focus: payload.focus,
      max_trends: payload.max_trends,
      research_mode: researchMode,
      known_trends: known.map((t) => t.name),
      sources: sources.map((s) => ({ ref: s.ref, title: s.title, publisher: s.publisher, published_at: s.publishedAt, snippet: s.snippet })),
    };
    return { input, demo: () => demoTrends({ focus: payload.focus, max_trends: payload.max_trends }), sources, researchMode };
  },

  async persist(ctx, payload, out, prepared) {
    const { db, workspace } = ctx;
    let created = 0;
    for (const t of out.trends.slice(0, payload.max_trends)) {
      const evidence = normalizeEvidence(t.evidence, prepared.sources);
      const trend = must(
        await db
          .from("trends")
          .insert({
            workspace_id: workspace.id,
            name: t.name,
            category: t.category,
            summary: `${t.summary}${t.candidate_niches.length ? `\n\nCandidate niches: ${t.candidate_niches.join(", ")}` : ""}`,
            velocity: prepared.researchMode === "live" ? t.velocity : "unknown",
            estimated_lifespan: t.estimated_lifespan,
            pod_relevance: t.pod_relevance,
            recommended_action: t.recommended_action,
            status: "new",
            research_mode: prepared.researchMode,
            agent_run_id: ctx.runId,
            detected_at: ctx.now.toISOString(),
            is_demo: prepared.researchMode === "demo",
          })
          .select("id")
          .single(),
        "insert trend",
      );
      created++;
      if (evidence.length) {
        check(
          await db.from("research_sources").insert(
            evidence.map((e) => ({
              workspace_id: workspace.id,
              trend_id: trend.id,
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
              is_demo: prepared.researchMode === "demo",
            })),
          ),
          "trend evidence",
        );
      }
    }
    await notify(db, { workspaceId: workspace.id, type: "info", title: `Trend Watcher detected ${created} trend(s)`, link: "/trends" });
    return { summary: `Detected ${created} trend(s) (${prepared.researchMode === "live" ? `${prepared.sources.length} live sources` : prepared.researchMode})`, waitingForApproval: false };
  },
};
