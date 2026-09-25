import type { Metadata } from "next";
import Link from "next/link";
import { DesignFields } from "@/components/designs/design-form";
import { DesignGrid, type DesignCardData } from "@/components/shared/design-grid";
import { ActionForm } from "@/components/ui/action-form";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { createDesignAction } from "@/server/actions/designs";
import { getContext } from "@/server/context";
import { designThumbnails } from "@/server/queries/assets";

export const metadata: Metadata = { title: "Design Studio" };

const STATUSES = ["idea", "brief", "generating", "review", "revision", "approved", "production_ready", "retired"] as const;

export default async function DesignStudioPage({ searchParams }: { searchParams: Promise<{ status?: string; brand?: string; compliance?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as (typeof STATUSES)[number]) : null;
  let q = ctx.db
    .from("design_concepts")
    .select("id, code, title, concept, status, compliance_status, printing_method, preferred_products, is_demo, collections(name), brands(code)")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  if (sp.brand) q = q.eq("brand_id", sp.brand);
  if (sp.compliance === "flagged") q = q.eq("compliance_status", "flagged");
  const [designs, brands, counts, collections] = await Promise.all([
    q,
    ctx.db.from("brands").select("id, code, working_title, official_name").eq("workspace_id", ctx.workspace.id).order("code"),
    ctx.db.from("design_concepts").select("status").eq("workspace_id", ctx.workspace.id),
    ctx.db.from("collections").select("id, name, brand_id").eq("workspace_id", ctx.workspace.id),
  ]);
  const countBy = new Map<string, number>();
  for (const r of counts.data ?? []) countBy.set(r.status, (countBy.get(r.status) ?? 0) + 1);
  const thumbs = await designThumbnails(ctx.db, (designs.data ?? []).map((d) => d.id));
  const base = (s: string | null) => `/design-studio?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(sp.brand ? { brand: sp.brand } : {}) }).toString()}`;

  return (
    <>
      <PageHeader
        title="Design Studio"
        description="Visual directions, collections and production-ready design briefs. Designs reach production only after compliance screening and human approval."
        actions={
          ctx.role !== "viewer" && brands.data?.length ? (
            <Dialog trigger="New design concept" title="New design concept">
              <ActionForm action={createDesignAction} submitLabel="Create concept">
                <Field label="Brand" htmlFor="new-brand">
                  <Select id="new-brand" name="brand_id" defaultValue={sp.brand ?? brands.data[0]!.id}>
                    {brands.data.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} · {b.official_name ?? b.working_title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <DesignFields collections={(collections.data ?? []).filter((c) => !sp.brand || c.brand_id === sp.brand)} idPrefix="new" />
              </ActionForm>
            </Dialog>
          ) : null
        }
      />
      <Tabs
        label="Design status"
        items={[
          { label: "All", href: base(null), active: !status, count: counts.data?.length ?? 0 },
          ...STATUSES.map((s) => ({ label: s.replace("_", " "), href: base(s), active: status === s, count: countBy.get(s) ?? 0 })),
        ]}
      />
      <form className="mb-4 flex flex-wrap items-end gap-2" aria-label="Filter designs">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="ds-brand" className="sr-only">
          Brand
        </label>
        <Select id="ds-brand" name="brand" defaultValue={sp.brand ?? ""} className="w-64">
          <option value="">All brands</option>
          {(brands.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} · {b.official_name ?? b.working_title}
            </option>
          ))}
        </Select>
        <label htmlFor="ds-compliance" className="sr-only">
          Compliance
        </label>
        <Select id="ds-compliance" name="compliance" defaultValue={sp.compliance ?? ""} className="w-48">
          <option value="">Any compliance</option>
          <option value="flagged">Flagged only</option>
        </Select>
        <button type="submit" className={buttonClass("secondary")}>
          Filter
        </button>
        {sp.brand || sp.compliance ? (
          <Link href={base(status)} className={buttonClass("ghost")}>
            Clear
          </Link>
        ) : null}
      </form>
      <DesignGrid designs={(designs.data ?? []).map((d) => ({ ...(d as DesignCardData), thumbnail: thumbs.get(d.id) ?? null }))} showBrand />
    </>
  );
}
