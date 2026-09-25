import type { Metadata } from "next";
import Link from "next/link";
import { MissionForm } from "@/components/opportunities/mission-form";
import { OpportunityCard, type OpportunityCardData } from "@/components/opportunities/opportunity-card";
import { StatusChip } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/fields";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Time } from "@/components/ui/time";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Opportunities" };

const VIEWS = [
  { key: "inbox", label: "Inbox", statuses: ["inbox"] },
  { key: "researching", label: "Researching", statuses: ["researching"] },
  { key: "candidates", label: "Candidates", statuses: ["candidate"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
  { key: "archived", label: "Archived", statuses: ["archived"] },
] as const;

type Status = "inbox" | "researching" | "candidate" | "approved" | "rejected" | "archived";

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; confidence?: string; mission?: string; new?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const counts = await ctx.db.from("opportunities").select("status").eq("workspace_id", ctx.workspace.id);
  const countBy = new Map<string, number>();
  for (const r of counts.data ?? []) countBy.set(r.status, (countBy.get(r.status) ?? 0) + 1);
  const view = VIEWS.find((v) => v.key === sp.view) ?? (countBy.get("candidate") ? VIEWS[2] : VIEWS.find((v) => (countBy.get(v.statuses[0]) ?? 0) > 0) ?? VIEWS[2]);

  let q = ctx.db
    .from("opportunities")
    .select("id, code, niche, hypothesis, audience, summary, status, confidence, strongest_signal, biggest_risk, researched_at, research_mode, is_demo, opportunity_scores(dimension, score)")
    .eq("workspace_id", ctx.workspace.id)
    .in("status", view.statuses as unknown as Status[])
    .order("created_at", { ascending: false })
    .limit(120);
  if (sp.q) q = q.ilike("niche", `%${sp.q.replace(/[%_]/g, "")}%`);
  if (sp.confidence && ["low", "medium", "high"].includes(sp.confidence)) q = q.eq("confidence", sp.confidence as "low");
  if (sp.mission) q = q.eq("mission_id", sp.mission);
  const [opps, missions] = await Promise.all([
    q,
    ctx.db.from("research_missions").select("id, code, title, status, opportunities_found, created_at, mission_type").eq("workspace_id", ctx.workspace.id).order("created_at", { ascending: false }).limit(8),
  ]);

  const form = <MissionForm maxCandidates={ctx.workspace.max_candidates} maxDepth={ctx.workspace.max_research_depth} />;

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Niches discovered and scored by the Opportunity Scout. Every score shows its reasoning; evidence is separated into facts, signals, inferences and assumptions."
        actions={
          ctx.role === "viewer" ? null : (
            <Dialog trigger="New research mission" title="New research mission" defaultOpen={sp.new === "1"}>
              {form}
            </Dialog>
          )
        }
      />
      <Tabs
        label="Opportunity views"
        items={VIEWS.map((v) => ({ label: v.label, href: `/opportunities?view=${v.key}`, active: v.key === view.key, count: countBy.get(v.statuses[0]) ?? 0 }))}
      />
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search" aria-label="Filter opportunities">
        <input type="hidden" name="view" value={view.key} />
        <label className="sr-only" htmlFor="opp-q">
          Search niches
        </label>
        <Input id="opp-q" name="q" defaultValue={sp.q} placeholder="Search niches…" className="w-56" />
        <label className="sr-only" htmlFor="opp-confidence">
          Confidence
        </label>
        <Select id="opp-confidence" name="confidence" defaultValue={sp.confidence ?? ""} className="w-40">
          <option value="">Any confidence</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>
        <button type="submit" className={buttonClass("secondary")}>
          Filter
        </button>
        {sp.q || sp.confidence || sp.mission ? (
          <Link href={`/opportunities?view=${view.key}`} className={buttonClass("ghost")}>
            Clear
          </Link>
        ) : null}
      </form>

      {opps.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {opps.data.map((o) => (
            <OpportunityCard key={o.id} o={o as OpportunityCardData} />
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${view.label.toLowerCase()} opportunities`} description="Create a research mission to have the Opportunity Scout find and score niches." />
      )}

      <Card className="mt-6">
        <CardHeader title="Recent research missions" />
        <ul className="divide-y divide-line">
          {(missions.data ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <span className="font-mono text-xs text-muted">{m.code}</span>
              <Link href={`/opportunities?view=candidates&mission=${m.id}`} className="min-w-0 flex-1 truncate hover:text-accent">
                {m.title}
              </Link>
              <span className="text-xs text-muted">{m.mission_type}</span>
              <span className="text-xs text-muted tabular">{m.opportunities_found} found</span>
              <StatusChip status={m.status} />
              <Time value={m.created_at} />
            </li>
          ))}
          {!missions.data?.length ? <li className="px-4 py-3 text-xs text-muted">No missions yet.</li> : null}
        </ul>
      </Card>
    </>
  );
}
