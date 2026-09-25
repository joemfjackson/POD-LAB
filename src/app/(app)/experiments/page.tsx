import type { Metadata } from "next";
import { ExperimentForm } from "@/components/shared/experiment-form";
import { ExperimentsTable, type ExperimentRowView } from "@/components/shared/experiments-table";
import { RunAgentButton } from "@/components/shared/run-agent-button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Experiments" };

const STATUSES = ["draft", "running", "paused", "completed", "cancelled"] as const;

export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<{ status?: string; decision?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as (typeof STATUSES)[number]) : null;
  let q = ctx.db
    .from("experiments")
    .select("id, code, name, experiment_type, primary_metric, status, decision, override_decision, start_date, is_demo, brands(code), experiment_variants!experiment_variants_experiment_id_fkey(key)")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (sp.decision) q = q.eq("decision", sp.decision);
  const [exps, brands] = await Promise.all([q, ctx.db.from("brands").select("id, code, working_title, official_name").eq("workspace_id", ctx.workspace.id).order("code")]);
  return (
    <>
      <PageHeader
        title="Experiments"
        description="Hypothesis → metric → minimum sample → variants → decision. Decisions come from configurable thresholds, never from agent opinion."
        actions={
          ctx.role !== "viewer" ? (
            <>
              <RunAgentButton agent="experiment_analyst" label="Analyse running experiments" variant="secondary" size="md" />
              <ButtonLink href="/imports?kind=experiment_metrics">Import metrics</ButtonLink>
              {brands.data?.length ? (
                <Dialog trigger="New experiment" title="New experiment">
                  <ExperimentForm brands={brands.data.map((b) => ({ id: b.id, code: b.code, name: b.official_name ?? b.working_title }))} />
                </Dialog>
              ) : null}
            </>
          ) : null
        }
      />
      <Tabs label="Experiment status" items={[{ label: "All", href: "/experiments", active: !status }, ...STATUSES.map((s) => ({ label: s, href: `/experiments?status=${s}`, active: status === s }))]} />
      <Card>
        <ExperimentsTable experiments={(exps.data ?? []) as ExperimentRowView[]} />
      </Card>
    </>
  );
}
