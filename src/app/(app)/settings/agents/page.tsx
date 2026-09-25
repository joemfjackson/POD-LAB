import { AGENT_BY_KEY, isAgentKey } from "@/agents/registry";
import { ACTIVE_PROMPT_VERSION } from "@/agents/prompts/registry";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/fields";
import { Notice } from "@/components/ui/misc";
import { roleAtLeast } from "@/domain/permissions";
import { updateAgentConfigAction } from "@/server/actions/settings";
import { getContext } from "@/server/context";

export default async function AgentSettingsPage() {
  const ctx = await getContext();
  const agents = await ctx.db.from("agents").select("*").eq("workspace_id", ctx.workspace.id).order("phase").order("name");
  const canEdit = roleAtLeast(ctx.role, "admin");
  return (
    <div className="space-y-4">
      <Notice tone="info">Per-agent overrides take precedence over the workspace default and the environment (AI_MODEL_&lt;AGENT_KEY&gt;). Prompts are versioned in code (src/agents/prompts) and every run records the prompt version it used.</Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        {(agents.data ?? []).map((a) => {
          const def = isAgentKey(a.key) ? AGENT_BY_KEY[a.key] : null;
          return (
            <Card key={a.id}>
              <CardHeader title={a.name} description={`${a.key} · prompt ${a.key}_v${isAgentKey(a.key) ? ACTIVE_PROMPT_VERSION[a.key] : "?"} · schema ${def?.schemaVersion ?? "?"}`} />
              <CardBody>
                <ActionForm action={updateAgentConfigAction} submitLabel="Save" size="sm" hidden={{ key: a.key }}>
                  <Checkbox name="enabled" defaultChecked={a.enabled} label="Enabled" disabled={!canEdit} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Provider" htmlFor={`${a.key}-prov`}>
                      <Select id={`${a.key}-prov`} name="provider" defaultValue={a.provider ?? ""} disabled={!canEdit}>
                        <option value="">Workspace default</option>
                        <option value="demo">Demo (no AI)</option>
                        <option value="openai_compatible">OpenAI-compatible</option>
                      </Select>
                    </Field>
                    <Field label="Model" htmlFor={`${a.key}-model`}>
                      <Input id={`${a.key}-model`} name="model" defaultValue={a.model ?? ""} placeholder="default" disabled={!canEdit} />
                    </Field>
                    <Field label={`Temperature (default ${def?.defaultTemperature ?? "—"})`} htmlFor={`${a.key}-temp`}>
                      <Input id={`${a.key}-temp`} name="temperature" type="number" step="0.05" min={0} max={2} defaultValue={a.temperature ?? ""} disabled={!canEdit} />
                    </Field>
                    <Field label={`Max output tokens (default ${def?.defaultMaxOutputTokens ?? "—"})`} htmlFor={`${a.key}-tok`}>
                      <Input id={`${a.key}-tok`} name="max_output_tokens" type="number" min={256} max={64000} defaultValue={a.max_output_tokens ?? ""} disabled={!canEdit} />
                    </Field>
                    <Field label="Daily run limit" htmlFor={`${a.key}-runs`}>
                      <Input id={`${a.key}-runs`} name="daily_run_limit" type="number" min={0} defaultValue={a.daily_run_limit} disabled={!canEdit} />
                    </Field>
                    <Field label="Daily cost limit (USD)" htmlFor={`${a.key}-cost`}>
                      <Input id={`${a.key}-cost`} name="daily_cost_limit_usd" type="number" step="0.01" min={0} defaultValue={Number(a.daily_cost_limit_usd)} disabled={!canEdit} />
                    </Field>
                  </div>
                </ActionForm>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
