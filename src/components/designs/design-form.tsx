import { PRINTING_METHODS } from "@/agents/schemas";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import type { Tables } from "@/lib/supabase/database.types";

type Design = Partial<Tables<"design_concepts">>;

export function DesignFields({ d, collections, idPrefix }: { d?: Design; collections: Array<{ id: string; name: string }>; idPrefix: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor={id("title")}>
          <Input id={id("title")} name="title" defaultValue={d?.title ?? ""} required maxLength={200} />
        </Field>
        <Field label="Collection" htmlFor={id("collection")}>
          <Select id={id("collection")} name="collection_id" defaultValue={d?.collection_id ?? ""}>
            <option value="">None</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Concept" htmlFor={id("concept")}>
        <Textarea id={id("concept")} name="concept" defaultValue={d?.concept ?? ""} required rows={3} maxLength={4000} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Front placement" htmlFor={id("front")}>
          <Input id={id("front")} name="front_placement" defaultValue={d?.front_placement ?? ""} />
        </Field>
        <Field label="Back placement" htmlFor={id("back")}>
          <Input id={id("back")} name="back_placement" defaultValue={d?.back_placement ?? ""} />
        </Field>
        <Field label="Sleeve placement" htmlFor={id("sleeve")}>
          <Input id={id("sleeve")} name="sleeve_placement" defaultValue={d?.sleeve_placement ?? ""} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Colors (comma separated)" htmlFor={id("colors")}>
          <Input id={id("colors")} name="colors" defaultValue={(d?.colors ?? []).join(", ")} />
        </Field>
        <Field label="Printing method" htmlFor={id("method")}>
          <Select id={id("method")} name="printing_method" defaultValue={d?.printing_method ?? ""}>
            <option value="">TBD</option>
            {PRINTING_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Preferred products (comma separated)" htmlFor={id("products")}>
          <Input id={id("products")} name="preferred_products" defaultValue={(d?.preferred_products ?? []).join(", ")} placeholder="tee, hoodie, hat" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Typography" htmlFor={id("type")}>
          <Input id={id("type")} name="typography" defaultValue={d?.typography ?? ""} />
        </Field>
        <Field label="Target buyer" htmlFor={id("buyer")}>
          <Input id={id("buyer")} name="target_buyer" defaultValue={d?.target_buyer ?? ""} />
        </Field>
      </div>
      <Field label="Illustration notes" htmlFor={id("illus")}>
        <Textarea id={id("illus")} name="illustration_notes" defaultValue={d?.illustration_notes ?? ""} rows={2} />
      </Field>
      <Field label="Image-generation prompt" htmlFor={id("gen")}>
        <Textarea id={id("gen")} name="generation_prompt" defaultValue={d?.generation_prompt ?? ""} rows={3} maxLength={4000} />
      </Field>
      <Field label="Mockup prompt" htmlFor={id("mock")}>
        <Textarea id={id("mock")} name="mockup_prompt" defaultValue={d?.mockup_prompt ?? ""} rows={2} maxLength={2000} />
      </Field>
    </>
  );
}
