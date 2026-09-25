import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignFields } from "@/components/designs/design-form";
import { RunAgentButton } from "@/components/shared/run-agent-button";
import { UploadForm } from "@/components/shared/files-panel";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, DemoBadge, RiskChip, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/fields";
import { KeyValue, Notice, Pre } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Time } from "@/components/ui/time";
import { getImageProvider } from "@/providers/image";
import { requestGateAction } from "@/server/actions/approvals";
import { generateDesignImageAction, setDesignStatusAction, updateDesignAction } from "@/server/actions/designs";
import { getContext } from "@/server/context";
import { signedUrlMap } from "@/server/queries/assets";

export const metadata: Metadata = { title: "Design" };

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getContext();
  const res = await ctx.db.from("design_concepts").select("*, collections(name), brands(id, code, working_title, official_name)").eq("id", id).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (!res.data) notFound();
  const d = res.data;
  const [assets, revisions, reviews, gates, collections, children] = await Promise.all([
    ctx.db.from("design_assets").select("id, kind, source, provider, revision, created_at, files(id, path, name, mime_type)").eq("design_id", id).order("created_at", { ascending: false }),
    ctx.db.from("design_revisions").select("id, revision_number, change_notes, actor_type, created_at, snapshot").eq("design_id", id).order("revision_number", { ascending: false }),
    ctx.db.from("compliance_reviews").select("*, compliance_issues(*)").eq("design_id", id).order("created_at", { ascending: false }),
    ctx.db.from("approval_gates").select("id, code, gate_type, status, title, created_at").eq("subject_id", id).order("created_at", { ascending: false }),
    ctx.db.from("collections").select("id, name").eq("brand_id", d.brand_id).order("sort_order"),
    ctx.db.from("design_concepts").select("id, code, title, status").eq("parent_design_id", id),
  ]);
  const urls = await signedUrlMap(ctx.db, (assets.data ?? []).map((a) => a.files?.path ?? "").filter(Boolean));
  const imageProvider = getImageProvider();
  const canEdit = ctx.role !== "viewer";
  const pendingProduction = gates.data?.some((g) => g.gate_type === "design_production" && g.status === "pending");
  const latestReview = reviews.data?.[0];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Design Studio", href: "/design-studio" }, { label: d.brands?.code ?? "", href: d.brands ? `/brands/${d.brands.id}/designs` : undefined }, { label: d.code }]}
        eyebrow={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs text-muted">{d.code}</span>
            <StatusChip status={d.status} />
            <StatusChip status={d.compliance_status} label={`IP: ${d.compliance_status.replace("_", " ")}`} />
            <Badge tone="muted">rev {d.current_revision}</Badge>
            <DemoBadge show={d.is_demo} />
          </div>
        }
        title={d.title}
        description={d.concept}
        actions={
          canEdit ? (
            <>
              {!pendingProduction && !["production_ready", "retired"].includes(d.status) ? (
                <ActionForm action={requestGateAction} submitLabel="Request production approval" variant="primary" hidden={{ gate_type: "design_production", subject_id: d.id }} inline />
              ) : null}
              <RunAgentButton agent="ip_compliance" brandId={d.brand_id} label="Run IP / Compliance" params={{ design_ids: d.id }} />
              <RunAgentButton agent="creative_director" brandId={d.brand_id} label="Create derivatives" params={{ mode: "derivatives", parent_design_id: d.id, design_count: 3 }} />
            </>
          ) : null
        }
      />
      {d.compliance_status === "flagged" ? (
        <div className="mb-4">
          <Notice tone="critical" title="Compliance flag">
            This concept cannot go to production until an admin overrides the flag (with notes) or the design is revised.{" "}
            <Link href="/approvals" className="text-accent hover:underline">
              Open approvals
            </Link>
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader title="Production brief" />
            <CardBody>
              <KeyValue
                items={[
                  { label: "Brand", value: d.brands ? `${d.brands.code} · ${d.brands.official_name ?? d.brands.working_title}` : "—" },
                  { label: "Collection", value: d.collections?.name },
                  { label: "Front placement", value: d.front_placement },
                  { label: "Back placement", value: d.back_placement },
                  { label: "Sleeve placement", value: d.sleeve_placement },
                  { label: "Colors", value: d.colors.join(", ") },
                  { label: "Typography", value: d.typography },
                  { label: "Illustration notes", value: d.illustration_notes },
                  { label: "Printing method", value: d.printing_method?.replace(/_/g, " ") },
                  { label: "Embroidery suitability", value: d.embroidery_suitability !== null ? `${d.embroidery_suitability}/10` : null },
                  { label: "Liquid 3D suitability", value: d.liquid_3d_suitability !== null ? `${d.liquid_3d_suitability}/10` : null },
                  { label: "Preferred products", value: d.preferred_products.join(", ") },
                  { label: "Target buyer", value: d.target_buyer },
                  { label: "Visual direction", value: d.visual_direction },
                ]}
              />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted">Generation prompt</p>
                  <Pre value={d.generation_prompt ?? "—"} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted">Mockup prompt</p>
                  <Pre value={d.mockup_prompt ?? "—"} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Artwork & mockups" description={imageProvider.configured ? `Image generation: ${imageProvider.label}` : "Image generation requires provider connection — upload artwork manually or configure IMAGE_PROVIDER."} />
            <CardBody className="space-y-4">
              {assets.data?.length ? (
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {assets.data.map((a) => {
                    const url = a.files?.path ? urls.get(a.files.path) : undefined;
                    return (
                      <li key={a.id} className="overflow-hidden rounded-md border border-line">
                        {url && a.files?.mime_type.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element -- signed URL from private storage
                          <img src={url} alt={`${d.title} ${a.kind}`} className="aspect-square w-full object-cover" />
                        ) : (
                          <div className="grid aspect-square place-items-center text-xs text-muted">{a.files?.name ?? "file"}</div>
                        )}
                        <p className="px-2 py-1 text-[11px] text-muted">
                          {a.kind} · {a.source}
                          {a.provider ? ` · ${a.provider}` : ""} · rev {a.revision}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted">No artwork yet.</p>
              )}
              {canEdit ? (
                <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
                  <UploadForm brandId={d.brand_id} designId={d.id} defaultKind="design" />
                  <div className="space-y-2">
                    <p className="text-xs text-muted">Generate from prompt</p>
                    {imageProvider.configured ? (
                      <div className="flex flex-wrap gap-2">
                        <ActionForm action={generateDesignImageAction} submitLabel="Generate artwork" hidden={{ design_id: d.id, kind: "artwork" }} inline size="sm" />
                        <ActionForm action={generateDesignImageAction} submitLabel="Generate mockup" variant="secondary" hidden={{ design_id: d.id, kind: "mockup" }} inline size="sm" />
                      </div>
                    ) : (
                      <p className="rounded-md border border-dashed border-line p-3 text-xs text-muted">Requires provider connection. Set IMAGE_PROVIDER=openai_compatible and IMAGE_API_KEY, or use the manual upload workflow.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {canEdit ? (
            <Card>
              <CardHeader title="Edit brief" description="Saving creates a new revision and re-runs compliance screening. Approved designs return to review." />
              <CardBody>
                <details>
                  <summary className="cursor-pointer text-xs text-muted">Edit fields</summary>
                  <div className="mt-3">
                    <ActionForm action={updateDesignAction} submitLabel="Save revision" hidden={{ design_id: d.id }}>
                      <DesignFields d={d} collections={collections.data ?? []} idPrefix="edit" />
                      <Field label="Change notes" htmlFor="change_notes">
                        <Input id="change_notes" name="change_notes" maxLength={1000} placeholder="What changed and why" />
                      </Field>
                    </ActionForm>
                  </div>
                </details>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Compliance" description="Automated screening only — not legal advice." />
            <CardBody className="space-y-3">
              {latestReview ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusChip status={latestReview.status} />
                    <RiskChip level={latestReview.risk_level} />
                    <Badge tone="muted">{latestReview.screening_method.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-ink-2">{latestReview.summary}</p>
                  {latestReview.compliance_issues.map((i) => (
                    <div key={i.id} className="rounded-md border border-line p-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge>{i.category.replace(/_/g, " ")}</Badge>
                        <RiskChip level={i.risk_level} />
                      </div>
                      <p className="mt-1 text-ink">{i.detected_issue}</p>
                      <p className="mt-0.5 text-muted">{i.explanation}</p>
                      {i.evidence ? <p className="mt-0.5 text-muted italic">{i.evidence}</p> : null}
                      <p className="mt-1 text-ink-2">Action: {i.action_required}</p>
                    </div>
                  ))}
                  {latestReview.human_override ? <p className="text-xs text-serious">Overridden: {latestReview.override_notes}</p> : null}
                  <p className="text-[11px] text-muted">{latestReview.disclaimer}</p>
                </>
              ) : (
                <p className="text-xs text-muted">Not screened yet.</p>
              )}
            </CardBody>
          </Card>

          {canEdit ? (
            <Card>
              <CardHeader title="Status" />
              <CardBody>
                <ActionForm action={setDesignStatusAction} submitLabel="Update status" hidden={{ design_id: d.id }}>
                  <Field label="Set status" htmlFor="status" hint="Approved / production ready are set only through the approval gate.">
                    <Select id="status" name="status" defaultValue={["idea", "brief", "review", "revision", "retired"].includes(d.status) ? d.status : "review"}>
                      {["idea", "brief", "review", "revision", "retired"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Approvals" />
            <CardBody>
              {gates.data?.length ? (
                <ul className="space-y-1.5 text-xs">
                  {gates.data.map((g) => (
                    <li key={g.id}>
                      <Link href={`/approvals/${g.id}`} className="font-mono text-accent">
                        {g.code}
                      </Link>{" "}
                      {g.gate_type.replace(/_/g, " ")} <StatusChip status={g.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">None yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Revision history" />
            <CardBody>
              <ol className="space-y-2 text-xs">
                {(revisions.data ?? []).map((r) => (
                  <li key={r.id}>
                    <span className="font-mono text-ink">r{r.revision_number}</span> <span className="text-ink-2">{r.change_notes}</span>
                    <span className="block text-muted">
                      {r.actor_type} · <Time value={r.created_at} />
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          {children.data?.length ? (
            <Card>
              <CardHeader title="Derivatives" />
              <CardBody>
                <ul className="space-y-1 text-xs">
                  {children.data.map((c) => (
                    <li key={c.id}>
                      <Link href={`/design-studio/${c.id}`} className="text-accent">
                        {c.code}
                      </Link>{" "}
                      {c.title} <StatusChip status={c.status} />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
