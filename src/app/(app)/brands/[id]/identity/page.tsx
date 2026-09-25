import Link from "next/link";
import { DemoBadge, StatusChip } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, KeyValue } from "@/components/ui/misc";
import { Time } from "@/components/ui/time";
import { getBrand } from "@/server/queries/brand";

interface Direction {
  key: string;
  name: string;
  mood: string;
  typography: string;
  colors: Array<{ name: string; hex: string }>;
  graphic_language: string;
  illustration_style: string;
  photography_direction: string;
  garment_placement: string;
  decoration_methods: string[];
  avoid: string[];
}

export default async function BrandIdentity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const [identities, gates] = await Promise.all([
    ctx.db.from("brand_identity").select("*").eq("brand_id", id).order("version", { ascending: false }),
    ctx.db.from("approval_gates").select("id, subject_id, status").eq("brand_id", id).eq("gate_type", "brand_identity_final").eq("status", "pending"),
  ]);
  if (!identities.data?.length) return <EmptyState title="No identity yet" description="Run the Brand Architect to propose positioning, voice, palette, typography and name candidates." />;
  return (
    <div className="space-y-5">
      {identities.data.map((i) => {
        const colors = (i.colors as Array<{ name: string; hex: string; role: string }>) ?? [];
        const fonts = (i.fonts as Array<{ family: string; role: string; rationale?: string }>) ?? [];
        const directions = (i.visual_directions as Direction[] | null) ?? [];
        const gate = gates.data?.find((g) => g.subject_id === i.id);
        return (
          <Card key={i.id} className={i.status === "superseded" || i.status === "rejected" ? "opacity-70" : undefined}>
            <CardHeader
              title={`Identity v${i.version}`}
              description={<>Created <Time value={i.created_at} /></>}
              actions={
                <>
                  <StatusChip status={i.status} />
                  <DemoBadge show={i.is_demo} />
                  {gate ? (
                    <Link href={`/approvals/${gate.id}`} className="text-xs text-accent hover:underline">
                      Review approval →
                    </Link>
                  ) : null}
                </>
              }
            />
            <CardBody className="space-y-5">
              <KeyValue
                items={[
                  { label: "Audience", value: i.audience },
                  { label: "Positioning", value: i.positioning },
                  { label: "Archetype", value: i.archetype },
                  { label: "Emotional appeal", value: i.emotional_appeal },
                  { label: "Tagline", value: i.tagline },
                  { label: "Tagline candidates", value: i.tagline_candidates.join(" · ") },
                  { label: "Tone of voice", value: i.tone_of_voice },
                  { label: "Visual territory", value: i.visual_territory },
                  { label: "Collection ideas", value: i.product_collection_ideas.join(", ") },
                  { label: "Expansion paths", value: i.expansion_paths.join("; ") },
                  { label: "Must not become", value: i.anti_positioning.join("; ") },
                ]}
              />
              {i.brand_story ? (
                <div>
                  <p className="mb-1 text-xs text-muted">Brand story</p>
                  <p className="text-sm whitespace-pre-line text-ink-2">{i.brand_story}</p>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs text-muted">Palette</p>
                  <ul className="grid grid-cols-2 gap-2">
                    {colors.map((c) => (
                      <li key={c.hex + c.name} className="flex items-center gap-2 text-xs">
                        <span aria-hidden className="h-8 w-8 shrink-0 rounded border border-line" style={{ background: c.hex }} />
                        <span>
                          <span className="block text-ink">{c.name}</span>
                          <span className="font-mono text-muted">{c.hex}</span> · <span className="text-muted">{c.role}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted">Typography</p>
                  <ul className="space-y-1.5 text-xs">
                    {fonts.map((f) => (
                      <li key={f.family + f.role}>
                        <span className="text-ink">{f.family}</span> <span className="text-muted">— {f.role}</span>
                        {f.rationale ? <span className="block text-muted">{f.rationale}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {directions.length ? (
                <div>
                  <p className="mb-2 text-xs text-muted">Visual directions (Creative Director){i.selected_direction ? ` · recommended: ${i.selected_direction}` : ""}</p>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {directions.map((d) => (
                      <div key={d.key} className="rounded-md border border-line p-3 text-xs">
                        <p className="font-semibold text-ink">{d.name}</p>
                        <div className="my-2 flex gap-1">
                          {d.colors.map((c) => (
                            <span key={c.hex} title={`${c.name} ${c.hex}`} aria-label={`${c.name} ${c.hex}`} className="h-4 w-6 rounded-sm border border-line" style={{ background: c.hex }} />
                          ))}
                        </div>
                        <p className="text-ink-2">{d.mood}</p>
                        <p className="mt-1 text-muted">Type: {d.typography}</p>
                        <p className="text-muted">Graphics: {d.graphic_language}</p>
                        <p className="text-muted">Photo: {d.photography_direction}</p>
                        <p className="text-muted">Placement: {d.garment_placement}</p>
                        <p className="text-muted">Methods: {d.decoration_methods.join(", ")}</p>
                        <p className="mt-1 text-serious">Avoid: {d.avoid.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
