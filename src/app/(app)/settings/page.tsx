import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/fields";
import { KeyValue } from "@/components/ui/misc";
import { formatUsd } from "@/domain/format";
import { roleAtLeast } from "@/domain/permissions";
import { repairDefaultsAction, updateWorkspaceAction } from "@/server/actions/settings";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Settings" };

export default async function WorkspaceSettings() {
  const ctx = await getContext();
  const w = ctx.workspace;
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString();
  const runs = await ctx.db.from("agent_runs").select("estimated_cost_usd").eq("workspace_id", w.id).gte("started_at", since);
  const today = (runs.data ?? []).reduce((s, r) => s + Number(r.estimated_cost_usd), 0);
  const canManage = roleAtLeast(ctx.role, "admin");
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Workspace & cost controls" description="Hard limits enforced before every agent run." />
        <CardBody>
          {canManage ? (
            <ActionForm action={updateWorkspaceAction} submitLabel="Save">
              <Field label="Workspace name" htmlFor="ws-name">
                <Input id="ws-name" name="name" defaultValue={w.name} required />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Daily AI budget (USD)" htmlFor="ws-budget" hint="All agents combined, per UTC day">
                  <Input id="ws-budget" name="daily_ai_budget_usd" type="number" step="0.01" min={0} defaultValue={Number(w.daily_ai_budget_usd)} />
                </Field>
                <Field label="Max candidates per mission" htmlFor="ws-cand">
                  <Input id="ws-cand" name="max_candidates" type="number" min={1} max={100} defaultValue={w.max_candidates} />
                </Field>
                <Field label="Max research depth" htmlFor="ws-depth" hint="1–5 (more sources, higher cost)">
                  <Input id="ws-depth" name="max_research_depth" type="number" min={1} max={5} defaultValue={w.max_research_depth} />
                </Field>
              </div>
            </ActionForm>
          ) : (
            <KeyValue items={[{ label: "Name", value: w.name }, { label: "Daily AI budget", value: formatUsd(Number(w.daily_ai_budget_usd)) }]} />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Today" />
        <CardBody className="space-y-3">
          <KeyValue
            columns={1}
            items={[
              { label: "AI spend today (estimated)", value: `${formatUsd(today)} of ${formatUsd(Number(w.daily_ai_budget_usd))}` },
              { label: "Your role", value: ctx.role },
              { label: "Workspace ID", value: <span className="font-mono text-xs">{w.id}</span> },
            ]}
          />
          {canManage ? <ActionForm action={repairDefaultsAction} submitLabel="Verify workspace defaults" variant="secondary" size="sm" /> : null}
        </CardBody>
      </Card>
    </div>
  );
}
