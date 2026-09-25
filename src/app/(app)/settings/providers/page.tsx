import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/fields";
import { KeyValue, Notice } from "@/components/ui/misc";
import { roleAtLeast } from "@/domain/permissions";
import { encryptionConfigured } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { submitCredentialAction, updateProviderConfigAction } from "@/server/actions/settings";
import { getContext } from "@/server/context";

export default async function ProvidersPage() {
  const ctx = await getContext();
  const env = serverEnv();
  const [providers, creds] = await Promise.all([
    ctx.db.from("fulfillment_providers").select("*").eq("workspace_id", ctx.workspace.id).order("key"),
    createSupabaseAdminClient().from("provider_credentials").select("id, label, hint, status, provider_kind, provider_key").eq("workspace_id", ctx.workspace.id).in("provider_kind", ["fulfillment", "commerce"]),
  ]);
  const canEdit = roleAtLeast(ctx.role, "admin");
  const shopifyConfigured = Boolean(env.SHOPIFY_STORE_DOMAIN && env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {(providers.data ?? []).map((p) => {
          const cfg = (p.config ?? {}) as { api_base_url?: string | null; account_id?: string | null };
          const cred = creds.data?.find((c) => c.provider_kind === "fulfillment" && c.provider_key === p.key);
          return (
            <Card key={p.id}>
              <CardHeader title={p.name} description={`Adapter: ${p.adapter}`} actions={<StatusChip status={p.status} />} />
              <CardBody className="space-y-3">
                {p.adapter === "fulfill_engine" ? (
                  <Notice tone="warning" title="Requires provider connection">
                    Fulfill Engine access is pending. The adapter implements the full provider interface (listProducts, getProduct, getVariants, getPricing, createOrder, getOrder, getFulfillmentStatus) but makes no calls until the official API details are documented. See docs/fulfill-engine-plan.md.
                  </Notice>
                ) : (
                  <p className="text-xs text-muted">{p.notes}</p>
                )}
                {cred ? (
                  <p className="text-xs">
                    Credential <span className="font-mono">{cred.hint}</span> <StatusChip status={cred.status === "pending_approval" ? "pending" : cred.status} />
                  </p>
                ) : null}
                {canEdit && p.adapter === "fulfill_engine" ? (
                  <>
                    <ActionForm action={updateProviderConfigAction} submitLabel="Save configuration" size="sm" hidden={{ provider_id: p.id }}>
                      <Field label="API base URL" htmlFor={`${p.key}-url`} hint="https:// only — from official documentation">
                        <Input id={`${p.key}-url`} name="api_base_url" defaultValue={cfg.api_base_url ?? ""} placeholder="https://" />
                      </Field>
                      <Field label="Account ID" htmlFor={`${p.key}-acct`}>
                        <Input id={`${p.key}-acct`} name="account_id" defaultValue={cfg.account_id ?? ""} />
                      </Field>
                      <Field label="Notes" htmlFor={`${p.key}-notes`}>
                        <Textarea id={`${p.key}-notes`} name="notes" defaultValue={p.notes ?? ""} rows={2} />
                      </Field>
                    </ActionForm>
                    {encryptionConfigured() ? (
                      <ActionForm action={submitCredentialAction} submitLabel="Store API key (owner approval)" size="sm" variant="secondary" hidden={{ provider_kind: "fulfillment", provider_key: "fulfill_engine" }} resetOnSuccess>
                        <Field label="API key" htmlFor="fe-secret">
                          <Input id="fe-secret" name="secret" type="password" autoComplete="off" required minLength={8} />
                        </Field>
                      </ActionForm>
                    ) : null}
                  </>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader title="Commerce & storefronts" />
        <CardBody>
          <KeyValue
            items={[
              { label: "Internal preview", value: <Badge tone="good">available</Badge> },
              { label: "Generic JSON / Next.js manifest export", value: <Badge tone="good">available</Badge> },
              { label: "Shopify CSV export", value: <Badge tone="good">available</Badge> },
              {
                label: "Shopify Admin API publishing",
                value: shopifyConfigured ? <Badge tone="good">configured ({env.SHOPIFY_STORE_DOMAIN})</Badge> : <span className="text-xs text-muted">Requires provider connection: set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN (server env). Products are created as drafts only after launch approval.</span>,
              },
            ]}
          />
          <p className="mt-3 text-xs text-muted">
            AI, research and image credentials live under <Link href="/settings/ai" className="text-accent">AI provider</Link>.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
