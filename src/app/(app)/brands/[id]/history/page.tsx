import { ActivityFeed } from "@/components/shared/activity-feed";
import { JobsTable, type JobRowView } from "@/components/shared/jobs-table";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getBrand } from "@/server/queries/brand";

export default async function BrandHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const [jobs, audit] = await Promise.all([
    ctx.db.from("agent_jobs").select("id, code, agent_key, status, attempts, max_attempts, result_summary, error, created_at, requested_by_actor").eq("brand_id", id).order("created_at", { ascending: false }).limit(100),
    ctx.db.from("audit_log").select("id, actor_type, agent_key, summary, created_at, brand_id, subject_type, subject_id").eq("brand_id", id).order("created_at", { ascending: false }).limit(60),
  ]);
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Agent jobs" description="Every run keeps its input, validated output, model, prompt version, usage and cost." />
        <JobsTable jobs={(jobs.data ?? []) as JobRowView[]} showBrand={false} />
      </Card>
      <Card>
        <CardHeader title="Audit trail" />
        <CardBody>
          <ActivityFeed entries={audit.data ?? []} />
        </CardBody>
      </Card>
    </div>
  );
}
