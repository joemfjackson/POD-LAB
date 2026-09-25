import type { Metadata } from "next";
import Link from "next/link";
import { DemoBadge, StatusChip } from "@/components/ui/badge";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/fields";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Time } from "@/components/ui/time";
import { BRAND_STAGES, STAGE_LABELS, type BrandStage } from "@/domain/lifecycle";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ stage?: string; q?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  let q = ctx.db
    .from("brands")
    .select("id, code, working_title, official_name, niche, stage, audience, updated_at, is_demo, design_concepts(count), brand_products(count), experiments(count)")
    .eq("workspace_id", ctx.workspace.id)
    .order("code");
  const stage = BRAND_STAGES.includes(sp.stage as BrandStage) ? (sp.stage as BrandStage) : null;
  if (stage) q = q.eq("stage", stage);
  if (sp.q) {
    const term = sp.q.replace(/[%,()]/g, "");
    q = q.or(`working_title.ilike.%${term}%,official_name.ilike.%${term}%,niche.ilike.%${term}%,code.ilike.%${term}%`);
  }
  const brands = await q;
  const count = (v: unknown) => (v as Array<{ count: number }> | null)?.[0]?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Brands"
        description="Every brand keeps a permanent structured Brand Record — research, identity, designs, products, store, campaigns, experiments, decisions and agent history."
        actions={ctx.role !== "viewer" ? <ButtonLink href="/brands/new" variant="primary">New brand</ButtonLink> : null}
      />
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search" aria-label="Filter brands">
        <label htmlFor="brand-q" className="sr-only">
          Search
        </label>
        <Input id="brand-q" name="q" defaultValue={sp.q} placeholder="Search by name, niche or PL code…" className="w-64" />
        <label htmlFor="brand-stage" className="sr-only">
          Stage
        </label>
        <Select id="brand-stage" name="stage" defaultValue={stage ?? ""} className="w-48">
          <option value="">All stages</option>
          {BRAND_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClass("secondary")}>
          Filter
        </button>
      </form>
      {brands.data?.length ? (
        <Card>
          <Table>
            <THead>
              <tr>
                <TH>ID</TH>
                <TH>Brand</TH>
                <TH>Niche</TH>
                <TH>Stage</TH>
                <TH className="text-right">Designs</TH>
                <TH className="text-right">Products</TH>
                <TH className="text-right">Experiments</TH>
                <TH>Updated</TH>
              </tr>
            </THead>
            <TBody>
              {brands.data.map((b) => (
                <TR key={b.id}>
                  <TD className="font-mono text-xs text-muted">{b.code}</TD>
                  <TD>
                    <Link href={`/brands/${b.id}`} className="font-medium text-ink hover:text-accent">
                      {b.official_name ?? b.working_title}
                    </Link>{" "}
                    <DemoBadge show={b.is_demo} />
                    {b.official_name ? <p className="text-xs text-muted">{b.working_title}</p> : null}
                  </TD>
                  <TD className="max-w-xs text-xs text-ink-2">{b.niche}</TD>
                  <TD>
                    <StatusChip status={b.stage} label={STAGE_LABELS[b.stage as BrandStage]} />
                  </TD>
                  <TD className="text-right tabular">{count(b.design_concepts)}</TD>
                  <TD className="text-right tabular">{count(b.brand_products)}</TD>
                  <TD className="text-right tabular">{count(b.experiments)}</TD>
                  <TD className="text-xs">
                    <Time value={b.updated_at} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <EmptyState title="No brands match" description="Approving an opportunity creates a Brand Record automatically, or create one manually." />
      )}
    </>
  );
}
