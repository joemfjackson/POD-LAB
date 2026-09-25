import type { Metadata } from "next";
import { ImportWizard } from "@/components/imports/import-wizard";
import { StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Time } from "@/components/ui/time";
import { IMPORT_KINDS, type ImportKind } from "@/domain/csv";
import { requireContext } from "@/server/context";

export const metadata: Metadata = { title: "Imports" };

const TEMPLATES: Record<ImportKind, string> = {
  fulfillment_catalog: "provider_sku,blank_name,blank_brand,product_type,available_colors,available_sizes,blank_cost,decoration_method,decoration_cost,fulfillment_fee,shipping_estimate_domestic,production_sla_days",
  products: "provider_sku,blank_name,product_type,blank_cost,decoration_cost,fulfillment_fee,shipping_estimate_domestic",
  orders: "external_order_id,order_date,sku,product_title,quantity,revenue,discount,shipping_paid,cogs,decoration_cost,fulfillment_fee,shipping_cost,payment_processing,platform_fee,ad_attribution,refunds",
  experiment_metrics: "variant_key,metric_date,impressions,clicks,sessions,product_views,add_to_carts,checkouts,purchases,gross_revenue,discounts,refunds,cogs,fulfillment_cost,shipping_subsidy,ad_spend,repeat_buyers",
};

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ kind?: string; brand?: string; experiment?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext("imports.run");
  const kind = (Object.keys(IMPORT_KINDS).includes(sp.kind ?? "") ? sp.kind : "fulfillment_catalog") as ImportKind;
  const [brands, experiments, batches] = await Promise.all([
    ctx.db.from("brands").select("id, code, working_title, official_name").eq("workspace_id", ctx.workspace.id).order("code"),
    ctx.db.from("experiments").select("id, code, name").eq("workspace_id", ctx.workspace.id).order("created_at", { ascending: false }),
    ctx.db.from("import_batches").select("*").eq("workspace_id", ctx.workspace.id).order("created_at", { ascending: false }).limit(20),
  ]);
  return (
    <>
      <PageHeader title="Imports" description="CSV importers for products, orders, experiment metrics and fulfillment catalogs — with preview, column mapping, validation and error rows. Only valid rows are written." />
      <Card className="mb-5">
        <CardHeader title="Import CSV" />
        <CardBody>
          <ImportWizard
            initialKind={kind}
            initialBrand={sp.brand}
            initialExperiment={sp.experiment}
            brands={(brands.data ?? []).map((b) => ({ id: b.id, label: `${b.code} · ${b.official_name ?? b.working_title}` }))}
            experiments={(experiments.data ?? []).map((e) => ({ id: e.id, label: `${e.code} · ${e.name}` }))}
          />
        </CardBody>
      </Card>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Recent imports" />
          <Table>
            <THead>
              <tr>
                <TH>File</TH>
                <TH>Type</TH>
                <TH className="text-right">Imported</TH>
                <TH className="text-right">Errors</TH>
                <TH>Status</TH>
                <TH>When</TH>
              </tr>
            </THead>
            <TBody>
              {(batches.data ?? []).map((b) => (
                <TR key={b.id}>
                  <TD className="text-xs">{b.filename}</TD>
                  <TD className="text-xs">{b.kind.replace(/_/g, " ")}</TD>
                  <TD className="text-right text-xs tabular">
                    {b.imported_rows}/{b.total_rows}
                  </TD>
                  <TD className="text-right text-xs tabular">{b.error_rows}</TD>
                  <TD>
                    <StatusChip status={b.status === "partial" ? "medium" : b.status === "completed" ? "completed" : "failed"} label={b.status} />
                  </TD>
                  <TD className="text-xs">
                    <Time value={b.created_at} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Column templates" description="Headers are matched by name or common aliases; you can remap before importing." />
          <CardBody className="space-y-3">
            {(Object.keys(TEMPLATES) as ImportKind[]).map((k) => (
              <div key={k}>
                <p className="text-xs text-ink-2">{IMPORT_KINDS[k].label}</p>
                <p className="font-mono text-[10px] break-all text-muted">{TEMPLATES[k]}</p>
              </div>
            ))}
            <p className="text-[11px] text-muted">Lists (colors, sizes, images) use “|” or “;” separators. Dates are YYYY-MM-DD.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
