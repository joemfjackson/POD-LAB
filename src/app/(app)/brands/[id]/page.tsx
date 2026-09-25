import { ActivityFeed } from "@/components/shared/activity-feed";
import { ActionForm } from "@/components/ui/action-form";
import { StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { KeyValue } from "@/components/ui/misc";
import { Time } from "@/components/ui/time";
import { formatDate, formatUsd } from "@/domain/format";
import { STAGE_LABELS, directTargets, type BrandStage } from "@/domain/lifecycle";
import { brandDecisionAction, transitionBrandAction, updateBrandAction } from "@/server/actions/brands";
import { getBrand } from "@/server/queries/brand";

export default async function BrandOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, brand } = await getBrand(id);
  const db = ctx.db;
  const [identity, names, handles, collections, designs, products, store, campaigns, experiments, fin, decisions, history, activity, files, notes, pausedFrom] = await Promise.all([
    db.from("brand_identity").select("colors, fonts, tagline, tone_of_voice, positioning").eq("brand_id", id).eq("status", "final").maybeSingle(),
    db.from("brand_names").select("name, status").eq("brand_id", id),
    db.from("social_handles").select("platform, handle, brand_names!inner(status)").eq("brand_id", id).eq("brand_names.status", "final").limit(8),
    db.from("collections").select("name").eq("brand_id", id).order("sort_order"),
    db.from("design_concepts").select("status").eq("brand_id", id),
    db.from("brand_products").select("status").eq("brand_id", id),
    db.from("stores").select("id, code, name, status").eq("brand_id", id).maybeSingle(),
    db.from("campaigns").select("status").eq("brand_id", id),
    db.from("experiments").select("status, decision").eq("brand_id", id),
    db.from("financial_metrics").select("revenue, gross_profit, contribution_profit").eq("brand_id", id),
    db.from("brand_decisions").select("id, decision, reason, source, created_at, users:decided_by(display_name)").eq("brand_id", id).order("created_at", { ascending: false }).limit(10),
    db.from("brand_stage_history").select("id, from_stage, to_stage, actor_type, reason, created_at").eq("brand_id", id).order("created_at", { ascending: false }).limit(15),
    db.from("audit_log").select("id, actor_type, agent_key, summary, created_at, brand_id, subject_type, subject_id").eq("brand_id", id).order("created_at", { ascending: false }).limit(10),
    db.from("files").select("id", { count: "exact", head: true }).eq("brand_id", id),
    db.from("notes").select("id", { count: "exact", head: true }).eq("brand_id", id),
    db.from("brand_stage_history").select("from_stage").eq("brand_id", id).eq("to_stage", "paused").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const stage = brand.stage as BrandStage;
  const finalName = names.data?.find((n) => n.status === "final")?.name;
  const colors = (identity.data?.colors as Array<{ name: string; hex: string }> | undefined) ?? [];
  const fonts = (identity.data?.fonts as Array<{ family: string; role: string }> | undefined) ?? [];
  const sum = (k: "revenue" | "gross_profit" | "contribution_profit") => (fin.data ?? []).reduce((s, r) => s + Number(r[k]), 0);
  const countBy = (rows: Array<{ status: string }> | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return [...m.entries()].map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`).join(", ") || "none";
  };
  const targets = directTargets(stage, (pausedFrom.data?.from_stage as BrandStage | null) ?? null);
  const canEdit = ctx.role !== "viewer";

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Card>
          <CardHeader title="Brand Record" description="The permanent structured record for this brand." />
          <CardBody>
            <KeyValue
              items={[
                { label: "ID", value: <span className="font-mono">{brand.code}</span> },
                { label: "Stage", value: STAGE_LABELS[stage] },
                { label: "Working title", value: brand.working_title },
                { label: "Official name", value: finalName ?? brand.official_name ?? "Not final yet" },
                { label: "Niche", value: brand.niche },
                { label: "Sub-niche", value: brand.sub_niche },
                { label: "Audience", value: brand.audience },
                { label: "Created", value: formatDate(brand.created_at) },
                { label: "Opportunity thesis", value: brand.opportunity_thesis },
                { label: "Positioning", value: brand.positioning ?? identity.data?.positioning },
                { label: "Tagline", value: brand.tagline },
                { label: "Voice", value: brand.voice },
                {
                  label: "Colors",
                  value: colors.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {colors.map((c) => (
                        <span key={c.hex + c.name} className="inline-flex items-center gap-1 text-xs">
                          <span aria-hidden className="h-3 w-3 rounded-sm border border-line" style={{ background: c.hex }} />
                          {c.name} <span className="font-mono text-muted">{c.hex}</span>
                        </span>
                      ))}
                    </span>
                  ) : null,
                },
                { label: "Fonts", value: fonts.map((f) => `${f.family} (${f.role})`).join(", ") || null },
                { label: "Domain", value: brand.domain },
                { label: "Social handles (final name, unverified)", value: (handles.data ?? []).map((h) => `${h.platform}:@${h.handle}`).join(", ") || null },
                { label: "Trademark notes", value: brand.trademark_notes },
                { label: "Research summary", value: brand.research_summary },
                { label: "Risk summary", value: brand.risk_summary },
                { label: "Collections", value: (collections.data ?? []).map((c) => c.name).join(", ") || null },
                { label: "Designs", value: countBy(designs.data) },
                { label: "Products", value: countBy(products.data) },
                { label: "Store", value: store.data ? `${store.data.code} ${store.data.name} (${store.data.status})` : null },
                { label: "Campaigns", value: countBy(campaigns.data) },
                { label: "Experiments", value: countBy(experiments.data) },
                { label: "Financial performance", value: `Revenue ${formatUsd(sum("revenue"))} · Gross ${formatUsd(sum("gross_profit"))} · Contribution ${formatUsd(sum("contribution_profit"))}` },
                { label: "Files / notes", value: `${files.count ?? 0} files · ${notes.count ?? 0} notes` },
              ]}
            />
          </CardBody>
        </Card>

        {canEdit ? (
          <Card>
            <CardHeader title="Edit record" />
            <CardBody>
              <details>
                <summary className="cursor-pointer text-xs text-muted">Edit working fields</summary>
                <div className="mt-3">
                  <ActionForm action={updateBrandAction} submitLabel="Save" hidden={{ brand_id: brand.id }}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Working title" htmlFor="wt">
                        <Input id="wt" name="working_title" defaultValue={brand.working_title} required />
                      </Field>
                      <Field label="Niche" htmlFor="niche">
                        <Input id="niche" name="niche" defaultValue={brand.niche} required />
                      </Field>
                      <Field label="Sub-niche" htmlFor="sub">
                        <Input id="sub" name="sub_niche" defaultValue={brand.sub_niche ?? ""} />
                      </Field>
                      <Field label="Domain" htmlFor="domain">
                        <Input id="domain" name="domain" defaultValue={brand.domain ?? ""} />
                      </Field>
                    </div>
                    <Field label="Audience" htmlFor="aud">
                      <Textarea id="aud" name="audience" defaultValue={brand.audience ?? ""} rows={2} />
                    </Field>
                    <Field label="Opportunity thesis" htmlFor="thesis">
                      <Textarea id="thesis" name="opportunity_thesis" defaultValue={brand.opportunity_thesis ?? ""} rows={3} />
                    </Field>
                  </ActionForm>
                </div>
              </details>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Stage history" />
          <CardBody>
            <ol className="space-y-2">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <Time value={h.created_at} />
                  <span className="text-muted">{h.from_stage ? STAGE_LABELS[h.from_stage as BrandStage] : "—"}</span>→
                  <StatusChip status={h.to_stage} label={STAGE_LABELS[h.to_stage as BrandStage]} />
                  <span className="text-muted">({h.actor_type})</span>
                  <span className="text-ink-2">{h.reason}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        {canEdit ? (
          <Card>
            <CardHeader title="Decision" description="Kill / iterate / clone / scale. Scaling requires admin approval." />
            <CardBody>
              <ActionForm action={brandDecisionAction} submitLabel="Record decision" hidden={{ brand_id: brand.id }} resetOnSuccess>
                <Field label="Decision" htmlFor="decision">
                  <Select id="decision" name="decision" defaultValue="iterate">
                    <option value="keep_collecting">Keep collecting data</option>
                    <option value="iterate">Iterate</option>
                    <option value="clone">Clone into a new brand</option>
                    <option value="scale">Scale (requests approval)</option>
                    <option value="pause">Pause</option>
                    <option value="kill">Kill</option>
                  </Select>
                </Field>
                <Field label="Reason" htmlFor="decision-reason">
                  <Textarea id="decision-reason" name="reason" required minLength={3} rows={2} />
                </Field>
              </ActionForm>
            </CardBody>
          </Card>
        ) : null}
        {canEdit && targets.length ? (
          <Card>
            <CardHeader title="Move stage" description="Only transitions that don't need an approval gate are offered." />
            <CardBody>
              <ActionForm action={transitionBrandAction} submitLabel="Move" hidden={{ brand_id: brand.id }} resetOnSuccess>
                <Field label="To stage" htmlFor="to">
                  <Select id="to" name="to">
                    {targets.map((t) => (
                      <option key={t} value={t}>
                        {STAGE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reason" htmlFor="stage-reason">
                  <Input id="stage-reason" name="reason" required minLength={3} />
                </Field>
              </ActionForm>
            </CardBody>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Decisions" />
          <CardBody>
            {decisions.data?.length ? (
              <ul className="space-y-2 text-xs">
                {decisions.data.map((d) => (
                  <li key={d.id}>
                    <StatusChip status={d.decision} /> <span className="text-ink-2">{d.reason}</span>
                    <span className="block text-muted">
                      {(d.users as { display_name: string | null } | null)?.display_name ?? d.source} · <Time value={d.created_at} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">No decisions recorded.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <CardBody>
            <ActivityFeed entries={activity.data ?? []} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
