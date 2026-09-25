import { EXPERIMENT_TYPES, PRIMARY_METRICS } from "@/agents/schemas";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { createExperimentAction } from "@/server/actions/experiments";

export function ExperimentForm({ brands, brandId }: { brands?: Array<{ id: string; code: string; name: string }>; brandId?: string }) {
  return (
    <ActionForm action={createExperimentAction} submitLabel="Create experiment" hidden={brandId ? { brand_id: brandId } : undefined} resetOnSuccess>
      {!brandId && brands ? (
        <Field label="Brand" htmlFor="exp-brand">
          <Select id="exp-brand" name="brand_id">
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Name" htmlFor="exp-name">
        <Input id="exp-name" name="name" required minLength={3} maxLength={200} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="What is tested" htmlFor="exp-type">
          <Select id="exp-type" name="experiment_type" defaultValue="design">
            {EXPERIMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Primary metric" htmlFor="exp-metric">
          <Select id="exp-metric" name="primary_metric" defaultValue="conversion_rate">
            {PRIMARY_METRICS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Minimum sample (sessions)" htmlFor="exp-sample">
          <Input id="exp-sample" name="minimum_sample" type="number" min={0} defaultValue={500} />
        </Field>
      </div>
      <Field label="Hypothesis" htmlFor="exp-hyp">
        <Textarea id="exp-hyp" name="hypothesis" required minLength={5} rows={2} placeholder="If we …, then … because …" />
      </Field>
      <Field label="Variants (one per line; first is the control)" htmlFor="exp-variants">
        <Textarea id="exp-variants" name="variants" required rows={3} defaultValue={"Control\nChallenger"} />
      </Field>
    </ActionForm>
  );
}
