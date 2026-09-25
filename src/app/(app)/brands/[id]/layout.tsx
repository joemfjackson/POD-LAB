import Link from "next/link";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { RunAgentButton } from "@/components/shared/run-agent-button";
import { Badge, DemoBadge, StatusChip } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { PIPELINE_STAGES, STAGE_LABELS, recommendedActions, type BrandStage } from "@/domain/lifecycle";
import { cn } from "@/components/ui/cn";
import { getBrand } from "@/server/queries/brand";

export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, brand } = await getBrand(id);
  const stage = brand.stage as BrandStage;
  const actions = recommendedActions(stage);
  const pending = await ctx.db.from("approval_gates").select("id, title, gate_type").eq("brand_id", id).eq("status", "pending").limit(3);
  const stageIndex = PIPELINE_STAGES.indexOf(stage);
  const canRun = ctx.role !== "viewer";

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-1 text-xs text-muted">
        <Link href="/brands" className="hover:text-ink">
          Brands
        </Link>{" "}
        / <span aria-current="page">{brand.code}</span>
      </nav>
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-accent">{brand.code}</span>
          <h1 className="text-xl font-semibold tracking-tight">{brand.official_name ?? brand.working_title}</h1>
          <StatusChip status={stage} label={STAGE_LABELS[stage]} />
          <DemoBadge show={brand.is_demo} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {brand.niche}
          {brand.official_name ? ` · working title: ${brand.working_title}` : ""}
        </p>

        <ol className="mt-3 flex flex-wrap gap-1" aria-label="Lifecycle progress">
          {PIPELINE_STAGES.map((s, i) => (
            <li
              key={s}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px]",
                s === stage ? "bg-accent text-accent-ink" : stageIndex >= 0 && i < stageIndex ? "bg-accent/15 text-accent-strong" : "bg-surface-2 text-muted",
              )}
              aria-current={s === stage ? "step" : undefined}
            >
              {STAGE_LABELS[s]}
            </li>
          ))}
        </ol>

        {canRun && (actions.length || pending.data?.length) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2.5">
            <span className="text-xs text-muted">Next:</span>
            {actions.map((a) =>
              a.agent ? (
                <RunAgentButton key={a.label} agent={a.agent} brandId={brand.id} label={a.label} variant="primary" />
              ) : null,
            )}
            {(pending.data ?? []).map((g) => (
              <Link key={g.id} href={`/approvals/${g.id}`} className={buttonClass("secondary", "sm")}>
                <Badge tone="warning">approval</Badge> {g.title.slice(0, 60)}
              </Link>
            ))}
            {actions
              .filter((a) => !a.agent && a.gate && !(pending.data ?? []).some((g) => g.gate_type === a.gate))
              .map((a) => (
                <span key={a.label} className="text-xs text-muted" title={a.description}>
                  {a.label}: {a.description}
                </span>
              ))}
          </div>
        ) : null}
      </header>
      <BrandTabs brandId={brand.id} />
      {children}
    </>
  );
}
