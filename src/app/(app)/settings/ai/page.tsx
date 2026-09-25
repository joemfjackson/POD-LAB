import { ActionForm } from "@/components/ui/action-form";
import { Badge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/fields";
import { KeyValue, Notice } from "@/components/ui/misc";
import { roleAtLeast } from "@/domain/permissions";
import { encryptionConfigured } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getImageProvider } from "@/providers/image";
import { revokeCredentialAction, submitCredentialAction, updateAiSettingsAction } from "@/server/actions/settings";
import { getContext } from "@/server/context";

export default async function AiSettingsPage() {
  const ctx = await getContext();
  const env = serverEnv();
  const creds = await createSupabaseAdminClient().from("provider_credentials").select("id, label, hint, status, created_at, provider_kind").eq("workspace_id", ctx.workspace.id).in("provider_kind", ["ai", "research", "image"]).order("created_at", { ascending: false });
  const canEdit = roleAtLeast(ctx.role, "admin");
  const effective = ctx.workspace.ai_provider ?? env.AI_PROVIDER;
  const image = getImageProvider();
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Card>
          <CardHeader title="AI provider" description="OpenAI-compatible Chat Completions API (OpenAI, OpenRouter, Together, Groq, vLLM/Ollama gateways, Anthropic's OpenAI-compatible endpoint) or the deterministic demo provider." />
          <CardBody className="space-y-4">
            {effective === "demo" ? <Notice tone="demo">The demo provider makes no model calls. Outputs are placeholders labelled DEMO.</Notice> : null}
            <KeyValue
              items={[
                { label: "Effective provider", value: <Badge tone={effective === "demo" ? "warning" : "good"}>{effective}</Badge> },
                { label: "Environment default", value: env.AI_PROVIDER },
                { label: "Base URL (env)", value: <span className="font-mono text-xs">{env.AI_BASE_URL}</span> },
                { label: "Default model", value: ctx.workspace.ai_default_model ?? env.AI_DEFAULT_MODEL },
                { label: "API key", value: env.AI_API_KEY ? "Set via AI_API_KEY (server only)" : (creds.data ?? []).some((c) => c.provider_kind === "ai" && c.status === "active") ? "Workspace credential active" : "Not configured" },
                { label: "Structured output mode", value: env.AI_RESPONSE_FORMAT },
                { label: "Pricing for estimates", value: `$${env.AI_PRICE_INPUT_PER_MTOK}/M in · $${env.AI_PRICE_OUTPUT_PER_MTOK}/M out` },
                { label: "Execution mode", value: env.AGENT_EXECUTION_MODE },
                { label: "Web research", value: env.RESEARCH_PROVIDER === "none" ? "None — findings are labelled model knowledge/assumptions" : env.RESEARCH_PROVIDER },
                { label: "Image generation", value: image.configured ? image.label : "Requires provider connection (manual upload workflow)" },
                { label: "Domain lookups (RDAP)", value: env.DOMAIN_RDAP_ENABLED ? "Enabled" : "Disabled — domains are unverified" },
              ]}
            />
            {canEdit ? (
              <ActionForm action={updateAiSettingsAction} submitLabel="Save workspace AI settings">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Workspace provider override" htmlFor="ai-prov">
                    <Select id="ai-prov" name="ai_provider" defaultValue={ctx.workspace.ai_provider ?? ""}>
                      <option value="">Use environment ({env.AI_PROVIDER})</option>
                      <option value="demo">Demo (no AI)</option>
                      <option value="openai_compatible">OpenAI-compatible</option>
                    </Select>
                  </Field>
                  <Field label="Workspace default model" htmlFor="ai-model">
                    <Input id="ai-model" name="ai_default_model" defaultValue={ctx.workspace.ai_default_model ?? ""} placeholder={env.AI_DEFAULT_MODEL} />
                  </Field>
                </div>
              </ActionForm>
            ) : null}
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Workspace credentials" description="Encrypted with AES-256-GCM, never returned to the browser, activated only after owner approval." />
        <CardBody className="space-y-4">
          <ul className="space-y-2 text-xs">
            {(creds.data ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{c.label}</span> <span className="text-muted">{c.hint}</span> <StatusChip status={c.status === "pending_approval" ? "pending" : c.status} />
                {canEdit && c.status !== "revoked" ? <ActionForm action={revokeCredentialAction} submitLabel="Revoke" size="sm" variant="ghost" hidden={{ credential_id: c.id }} inline /> : null}
              </li>
            ))}
            {!creds.data?.length ? <li className="text-muted">No workspace credentials.</li> : null}
          </ul>
          {canEdit ? (
            encryptionConfigured() ? (
              <ActionForm action={submitCredentialAction} submitLabel="Store & request activation" resetOnSuccess>
                <Field label="Provider" htmlFor="cred-kind">
                  <Select id="cred-kind" name="provider_kind" defaultValue="ai">
                    <option value="ai">AI</option>
                    <option value="research">Web research</option>
                  </Select>
                </Field>
                <Field label="Provider key" htmlFor="cred-key" hint="openai_compatible for AI, tavily for research">
                  <Input id="cred-key" name="provider_key" defaultValue="openai_compatible" required pattern="[a-z0-9_]{2,40}" />
                </Field>
                <Field label="Secret" htmlFor="cred-secret">
                  <Input id="cred-secret" name="secret" type="password" autoComplete="off" required minLength={8} />
                </Field>
              </ActionForm>
            ) : (
              <Notice tone="warning">Set POD_LAB_ENCRYPTION_KEY on the server to store credentials in the workspace. Environment variables work without it.</Notice>
            )
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
