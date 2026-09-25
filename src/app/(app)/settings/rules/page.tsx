import { ActionForm } from "@/components/ui/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/fields";
import { Notice } from "@/components/ui/misc";
import { roleAtLeast } from "@/domain/permissions";
import { updateDecisionRulesAction, updatePricingModelAction } from "@/server/actions/settings";
import { getContext } from "@/server/context";

const pctv = (v: number | string) => Math.round(Number(v) * 10000) / 100;

export default async function RulesPage() {
  const ctx = await getContext();
  const [rules, pricing] = await Promise.all([
    ctx.db.from("decision_rule_sets").select("*").eq("workspace_id", ctx.workspace.id).eq("is_default", true).maybeSingle(),
    ctx.db.from("pricing_models").select("*").eq("workspace_id", ctx.workspace.id).is("brand_id", null).eq("is_default", true).maybeSingle(),
  ]);
  const canEdit = roleAtLeast(ctx.role, "admin");
  const r = rules.data;
  const p = pricing.data;
  const num = (label: string, name: string, value: number | string, step = "1", hint?: string) => (
    <Field label={label} htmlFor={`f-${name}`} hint={hint}>
      <Input id={`f-${name}`} name={name} type="number" step={step} defaultValue={value} disabled={!canEdit} />
    </Field>
  );
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {r ? (
        <Card>
          <CardHeader title="Experiment decision rules" description="The Experiment Analyst classifies with these thresholds. Below the sample thresholds the result is always “insufficient data”." />
          <CardBody>
            <ActionForm action={updateDecisionRulesAction} submitLabel="Save rules" hidden={{ rule_set_id: r.id }}>
              <p className="text-xs font-semibold text-muted uppercase">Sufficiency</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {num("Min sessions", "min_sessions", r.min_sessions)}
                {num("Min impressions (paid)", "min_impressions", r.min_impressions)}
                {num("Min purchases", "min_purchases", r.min_purchases)}
                {num("Min ad spend ($, paid)", "min_ad_spend_usd", Number(r.min_ad_spend_usd), "0.01")}
                {num("Min days running", "min_days_running", r.min_days_running)}
              </div>
              <p className="text-xs font-semibold text-muted uppercase">Kill</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {num("Max conversion rate %", "kill_max_conversion_rate", pctv(r.kill_max_conversion_rate), "0.01")}
                {num("Max CTR %", "kill_max_ctr", pctv(r.kill_max_ctr), "0.01")}
                {num("Max contribution margin %", "kill_max_contribution_margin", pctv(r.kill_max_contribution_margin), "0.1")}
              </div>
              <p className="text-xs font-semibold text-muted uppercase">Scale / clone / iterate</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {num("Scale: min ROAS", "scale_min_roas", Number(r.scale_min_roas), "0.1")}
                {num("Scale: min contribution margin %", "scale_min_contribution_margin", pctv(r.scale_min_contribution_margin), "0.1")}
                {num("Scale: min conversion %", "scale_min_conversion_rate", pctv(r.scale_min_conversion_rate), "0.01")}
                {num("Clone: min CTR %", "clone_min_ctr", pctv(r.clone_min_ctr), "0.01")}
                {num("Iterate: min CTR %", "iterate_min_ctr", pctv(r.iterate_min_ctr), "0.01")}
                {num("Min lift for a winner %", "min_lift_for_winner", pctv(r.min_lift_for_winner), "0.1")}
              </div>
            </ActionForm>
          </CardBody>
        </Card>
      ) : (
        <Notice tone="warning">No decision rules found — use “Verify workspace defaults” on the Workspace tab.</Notice>
      )}
      {p ? (
        <Card>
          <CardHeader title="Pricing & fee assumptions" description="Used by Product & Profit for unit economics. Edit to match your payment processor, platform and shipping policy." />
          <CardBody>
            <ActionForm action={updatePricingModelAction} submitLabel="Save assumptions" hidden={{ pricing_model_id: p.id }}>
              <div className="grid gap-3 sm:grid-cols-3">
                {num("Payment processing %", "payment_processing_pct", pctv(p.payment_processing_pct), "0.01")}
                {num("Payment fixed fee ($)", "payment_processing_fixed", Number(p.payment_processing_fixed), "0.01")}
                {num("Platform fee %", "platform_fee_pct", pctv(p.platform_fee_pct), "0.01")}
                {num("Shipping charged ($)", "shipping_charged", Number(p.shipping_charged), "0.01")}
                <Field label="Free-shipping threshold ($)" htmlFor="f-free_shipping_threshold" hint="Blank = none">
                  <Input id="f-free_shipping_threshold" name="free_shipping_threshold" type="number" step="0.01" defaultValue={p.free_shipping_threshold === null ? "" : Number(p.free_shipping_threshold)} disabled={!canEdit} />
                </Field>
                {num("Refund reserve %", "refund_reserve_pct", pctv(p.refund_reserve_pct), "0.1")}
                {num("Target CAC ($)", "target_cac", Number(p.target_cac), "0.01")}
                {num("Target contribution margin %", "target_contribution_margin", pctv(p.target_contribution_margin), "0.1")}
                {num("Minimum gross margin %", "min_gross_margin", pctv(p.min_gross_margin), "0.1")}
              </div>
            </ActionForm>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
