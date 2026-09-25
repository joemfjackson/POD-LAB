import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { createMissionAction } from "@/server/actions/agents";

export function MissionForm({ maxCandidates, maxDepth, brandId, trendId, defaultPrompt }: { maxCandidates: number; maxDepth: number; brandId?: string; trendId?: string; defaultPrompt?: string }) {
  return (
    <ActionForm action={createMissionAction} submitLabel="Create mission & run Scout" pendingLabel="Scout is researching…" hidden={{ brand_id: brandId, trend_id: trendId }}>
      <Field label="Title" htmlFor="mission-title">
        <Input id="mission-title" name="title" required minLength={3} maxLength={300} placeholder="Find 20 emerging identity-based POD niches" defaultValue={defaultPrompt ? `Investigate: ${defaultPrompt}`.slice(0, 300) : undefined} />
      </Field>
      <Field label="Mission brief" htmlFor="mission-prompt" hint="What should the Scout find or investigate? Be specific about audience or constraints.">
        <Textarea id="mission-prompt" name="prompt" required minLength={3} maxLength={4000} rows={4} defaultValue={defaultPrompt} placeholder="Find underserved professions with strong merchandise identity." />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type" htmlFor="mission-type">
          <Select id="mission-type" name="mission_type" defaultValue={defaultPrompt ? "investigate" : "discover"}>
            <option value="discover">Discover (many niches)</option>
            <option value="investigate">Investigate (one niche)</option>
          </Select>
        </Field>
        <Field label="Max candidates" htmlFor="mission-max" hint={`Workspace cap: ${maxCandidates}`}>
          <Input id="mission-max" name="max_candidates" type="number" min={1} max={maxCandidates} defaultValue={Math.min(10, maxCandidates)} />
        </Field>
        <Field label="Research depth" htmlFor="mission-depth" hint={`1–${maxDepth}; deeper = more sources, higher cost`}>
          <Input id="mission-depth" name="research_depth" type="number" min={1} max={maxDepth} defaultValue={1} />
        </Field>
      </div>
    </ActionForm>
  );
}
