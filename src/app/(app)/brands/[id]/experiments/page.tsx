import { ExperimentForm } from "@/components/shared/experiment-form";
import { ExperimentsTable, type ExperimentRowView } from "@/components/shared/experiments-table";
import { RunAgentButton } from "@/components/shared/run-agent-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getBrand } from "@/server/queries/brand";

export default async function BrandExperiments({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const exps = await ctx.db.from("experiments").select("id, code, name, experiment_type, primary_metric, status, decision, override_decision, start_date, is_demo, experiment_variants!experiment_variants_experiment_id_fkey(key)").eq("brand_id", id).order("created_at", { ascending: false });
  const canEdit = ctx.role !== "viewer";
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Experiments" actions={canEdit ? <RunAgentButton agent="experiment_analyst" brandId={id} label="Run Experiment Analyst" /> : null} />
        <ExperimentsTable experiments={(exps.data ?? []) as ExperimentRowView[]} showBrand={false} />
      </Card>
      {canEdit ? (
        <Card>
          <CardHeader title="New experiment" />
          <CardBody>
            <ExperimentForm brandId={id} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
