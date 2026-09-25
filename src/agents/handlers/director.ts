import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGE_LABELS, recommendedActions, type BrandStage } from "@/domain/lifecycle";
import type { Database } from "@/lib/supabase/database.types";
import { check, must } from "../runtime/db-helpers";
import type { AgentHandler } from "../runtime/types";
import { directorOutputSchema, directorPayloadSchema, type DirectorOutput, type DirectorPayload } from "../schemas";

const DAY = 86_400_000;

export interface DirectorStats {
  brands: Array<{ id: string; code: string; name: string; stage: BrandStage; updated_at: string; stale_days: number }>;
  stageCounts: Record<string, number>;
  opportunityCounts: Record<string, number>;
  pendingApprovals: Array<{ id: string; code: string; title: string; gate_type: string; created_at: string; brand_id: string | null }>;
  failedJobs7d: number;
  activeJobs: number;
  complianceFlags: number;
  marginProblems7d: number;
  revisitCandidates: Array<{ code: string; niche: string; reason: string }>;
}

/** Real, computed workspace statistics (never model-generated). */
export async function computeDirectorStats(db: SupabaseClient<Database>, workspaceId: string, now = new Date()): Promise<DirectorStats> {
  const since7 = new Date(now.getTime() - 7 * DAY).toISOString();
  const [brands, opps, gates, failed, active, flags, margins] = await Promise.all([
    db.from("brands").select("id, code, working_title, official_name, stage, updated_at").eq("workspace_id", workspaceId),
    db.from("opportunities").select("code, niche, status, researched_at, research_mode").eq("workspace_id", workspaceId),
    db.from("approval_gates").select("id, code, title, gate_type, created_at, brand_id").eq("workspace_id", workspaceId).eq("status", "pending").order("created_at"),
    db.from("agent_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "failed").gte("updated_at", since7),
    db.from("agent_jobs").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["queued", "running"]),
    db.from("compliance_reviews").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "flagged"),
    db.from("brand_products").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("recommendation", "avoid").gte("created_at", since7),
  ]);
  for (const r of [brands, opps, gates]) check(r, "director stats");
  const brandRows = (brands.data ?? []).map((b) => ({
    id: b.id,
    code: b.code,
    name: b.official_name ?? b.working_title,
    stage: b.stage as BrandStage,
    updated_at: b.updated_at,
    stale_days: Math.floor((now.getTime() - new Date(b.updated_at).getTime()) / DAY),
  }));
  const stageCounts: Record<string, number> = {};
  for (const b of brandRows) stageCounts[b.stage] = (stageCounts[b.stage] ?? 0) + 1;
  const opportunityCounts: Record<string, number> = {};
  const revisitCandidates: DirectorStats["revisitCandidates"] = [];
  for (const o of opps.data ?? []) {
    opportunityCounts[o.status] = (opportunityCounts[o.status] ?? 0) + 1;
    if (o.status !== "candidate" && o.status !== "approved") continue;
    const age = o.researched_at ? (now.getTime() - new Date(o.researched_at).getTime()) / DAY : Infinity;
    if (age > 90) revisitCandidates.push({ code: o.code, niche: o.niche, reason: `Research is ${Number.isFinite(age) ? Math.floor(age) : "?"} days old` });
    else if (o.research_mode === "demo" || o.research_mode === "model_only")
      revisitCandidates.push({ code: o.code, niche: o.niche, reason: `Researched without live sources (${o.research_mode})` });
  }
  return {
    brands: brandRows,
    stageCounts,
    opportunityCounts,
    pendingApprovals: gates.data ?? [],
    failedJobs7d: failed.count ?? 0,
    activeJobs: active.count ?? 0,
    complianceFlags: flags.count ?? 0,
    marginProblems7d: margins.count ?? 0,
    revisitCandidates: revisitCandidates.slice(0, 10),
  };
}

export function deterministicBriefing(stats: DirectorStats): DirectorOutput {
  const priorities: DirectorOutput["priorities"] = [];
  if (stats.pendingApprovals.length)
    priorities.push({ title: `Decide ${stats.pendingApprovals.length} pending approval(s)`, reason: `Oldest: ${stats.pendingApprovals[0]!.title}`, href: "/approvals" });
  if (stats.failedJobs7d) priorities.push({ title: `Investigate ${stats.failedJobs7d} failed agent job(s)`, reason: "Failures in the last 7 days.", href: "/agents?status=failed" });
  if (stats.complianceFlags) priorities.push({ title: `Resolve ${stats.complianceFlags} compliance flag(s)`, reason: "Flagged designs cannot reach production.", href: "/approvals" });
  if (stats.marginProblems7d) priorities.push({ title: `Review ${stats.marginProblems7d} margin problem(s)`, reason: "Products rejected on unit economics this week.", href: "/products" });
  const inbox = stats.opportunityCounts.candidate ?? 0;
  if (inbox) priorities.push({ title: `Review ${inbox} candidate opportunit${inbox === 1 ? "y" : "ies"}`, reason: "Researched and waiting for a human decision.", href: "/opportunities?view=candidates" });

  const attention = stats.brands
    .filter((b) => !["killed", "archived", "paused"].includes(b.stage) && (b.stale_days >= 14 || stats.pendingApprovals.some((g) => g.brand_id === b.id)))
    .slice(0, 10)
    .map((b) => {
      const pending = stats.pendingApprovals.find((g) => g.brand_id === b.id);
      const next = recommendedActions(b.stage)[0];
      return {
        brand_code: b.code,
        reason: pending ? `Waiting on approval: ${pending.title}` : `No activity for ${b.stale_days} days in ${STAGE_LABELS[b.stage]}`,
        recommended_action: pending ? "Decide the pending approval" : (next?.label ?? "Review the brand"),
      };
    });
  const active = stats.brands.filter((b) => !["killed", "archived"].includes(b.stage)).length;
  return {
    headline: `${active} active brand(s), ${stats.pendingApprovals.length} approval(s) pending, ${stats.activeJobs} job(s) in flight.`,
    summary: `Brands by stage: ${Object.entries(stats.stageCounts).map(([k, v]) => `${STAGE_LABELS[k as BrandStage] ?? k} ${v}`).join(", ") || "none"}. Opportunities: ${Object.entries(stats.opportunityCounts).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}.`,
    priorities,
    brands_needing_attention: attention,
    revisit_candidates: stats.revisitCandidates.map((r) => ({ opportunity_code: r.code, reason: r.reason })),
    risks: [
      ...(stats.failedJobs7d ? [`${stats.failedJobs7d} agent failure(s) this week`] : []),
      ...(stats.complianceFlags ? [`${stats.complianceFlags} unresolved compliance flag(s)`] : []),
    ],
  };
}

export const directorHandler: AgentHandler<DirectorPayload, DirectorOutput> = {
  key: "director",
  payloadSchema: directorPayloadSchema,
  outputSchema: directorOutputSchema,
  async prepare(ctx, payload) {
    const stats = await computeDirectorStats(ctx.db, ctx.workspace.id, ctx.now);
    return {
      input: { period: payload.period, stats } as unknown as Record<string, unknown>,
      demo: () => deterministicBriefing(stats),
      sources: [],
      researchMode: ctx.demoMode ? "demo" : "model_only",
    };
  },
  async persist(ctx, payload, out) {
    must({ data: out, error: null }, "briefing");
    return { summary: `${payload.period === "weekly" ? "Weekly" : "Daily"} briefing: ${out.headline}`, waitingForApproval: false };
  },
};
