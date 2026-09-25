import { ActionForm } from "@/components/ui/action-form";
import { DemoBadge, RiskChip, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { handleCheckUrl, trademarkSearchLinks } from "@/providers/domains";
import { requestGateAction } from "@/server/actions/approvals";
import { updateNameStatusAction } from "@/server/actions/brands";
import { getBrand } from "@/server/queries/brand";

export default async function BrandNames({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const [names, domains, handles] = await Promise.all([
    ctx.db.from("brand_names").select("*").eq("brand_id", id).order("status").order("memorability", { ascending: false, nullsFirst: false }),
    ctx.db.from("domains").select("*").eq("brand_id", id),
    ctx.db.from("social_handles").select("*").eq("brand_id", id),
  ]);
  if (!names.data?.length) return <EmptyState title="No name candidates" description="Run the Brand Architect to generate researched name candidates." />;
  const canEdit = ctx.role !== "viewer";
  return (
    <div className="space-y-4">
      <Notice tone="warning" title="Preliminary research only">
        Trademark notes are indicators, not legal clearance. Domain status comes from public RDAP when enabled (otherwise unverified); social handle availability must be checked manually.
      </Notice>
      <Card>
        <CardHeader title={`${names.data.length} name candidates`} />
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Status</TH>
              <TH>Memorability</TH>
              <TH>Risks</TH>
              <TH>Domains</TH>
              <TH>Handles</TH>
              <TH>Expansion / visual</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {names.data.map((n) => {
              const doms = (domains.data ?? []).filter((d) => d.brand_name_id === n.id);
              const hs = (handles.data ?? []).filter((h) => h.brand_name_id === n.id);
              return (
                <TR key={n.id}>
                  <TD className="max-w-xs">
                    <p className="font-semibold text-ink">{n.name}</p>
                    <p className="text-xs text-ink-2">{n.rationale}</p>
                    {n.collision_notes ? <p className="mt-1 text-[11px] text-muted">Collisions: {n.collision_notes}</p> : null}
                    {n.trademark_notes ? <p className="text-[11px] text-muted">TM: {n.trademark_notes}</p> : null}
                    <p className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      {trademarkSearchLinks(n.name).map((l) => (
                        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          {l.label}
                        </a>
                      ))}
                    </p>
                  </TD>
                  <TD>
                    <StatusChip status={n.status} /> <DemoBadge show={n.is_demo} />
                  </TD>
                  <TD className="tabular">{n.memorability ?? "—"}</TD>
                  <TD className="space-y-1">
                    <div className="text-[11px] text-muted">Spelling</div>
                    <RiskChip level={n.spelling_risk} />
                    <div className="text-[11px] text-muted">Pronunciation</div>
                    <RiskChip level={n.pronunciation_risk} />
                    <div className="text-[11px] text-muted">Trademark</div>
                    <RiskChip level={n.trademark_risk} />
                  </TD>
                  <TD>
                    <ul className="space-y-1 text-xs">
                      {doms.map((d) => (
                        <li key={d.id} title={d.notes ?? undefined}>
                          <span className="font-mono">{d.domain}</span> <StatusChip status={d.availability} />
                        </li>
                      ))}
                    </ul>
                  </TD>
                  <TD>
                    <ul className="space-y-1 text-xs">
                      {hs.slice(0, 6).map((h) => {
                        const url = handleCheckUrl(h.platform, h.handle);
                        return (
                          <li key={h.id}>
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                {h.platform}:@{h.handle}
                              </a>
                            ) : (
                              `${h.platform}:@${h.handle}`
                            )}{" "}
                            <span className="text-muted">({h.availability})</span>
                          </li>
                        );
                      })}
                    </ul>
                  </TD>
                  <TD className="text-xs tabular">
                    {n.expansion_potential ?? "—"} / {n.visual_potential ?? "—"}
                  </TD>
                  <TD>
                    {canEdit && n.status !== "final" ? (
                      <div className="flex flex-col gap-1.5">
                        <ActionForm action={requestGateAction} submitLabel="Make final…" size="sm" hidden={{ gate_type: "brand_name_final", subject_id: n.id }} inline />
                        {n.status !== "shortlisted" ? <ActionForm action={updateNameStatusAction} submitLabel="Shortlist" size="sm" variant="ghost" hidden={{ name_id: n.id, status: "shortlisted" }} inline /> : null}
                        {n.status !== "rejected" ? <ActionForm action={updateNameStatusAction} submitLabel="Reject" size="sm" variant="ghost" hidden={{ name_id: n.id, status: "rejected" }} inline /> : null}
                      </div>
                    ) : null}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
      <Card>
        <CardBody className="text-xs text-muted">“Make final…” creates a Brand Name → Final approval request. The name becomes official only after a human approves it.</CardBody>
      </Card>
    </div>
  );
}
