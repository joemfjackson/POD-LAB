import { ActionForm } from "@/components/ui/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/fields";
import { Time } from "@/components/ui/time";
import { addNoteAction } from "@/server/actions/brands";
import { getBrand } from "@/server/queries/brand";

export default async function BrandNotes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const notes = await ctx.db.from("notes").select("id, body, subject_type, created_at, users:author_id(display_name)").eq("brand_id", id).order("created_at", { ascending: false });
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-3 xl:col-span-2">
        {(notes.data ?? []).map((n) => (
          <Card key={n.id}>
            <CardBody>
              <p className="mb-1 text-xs text-muted">
                {(n.users as { display_name: string | null } | null)?.display_name ?? "—"} · <Time value={n.created_at} /> · {n.subject_type}
              </p>
              <p className="text-sm whitespace-pre-line text-ink-2">{n.body}</p>
            </CardBody>
          </Card>
        ))}
        {!notes.data?.length ? <p className="text-xs text-muted">No notes yet.</p> : null}
      </div>
      {ctx.role !== "viewer" ? (
        <Card>
          <CardHeader title="Add note" />
          <CardBody>
            <ActionForm action={addNoteAction} submitLabel="Add note" hidden={{ brand_id: id, subject_type: "brand", subject_id: id }} resetOnSuccess>
              <Field label="Note" htmlFor="note-body">
                <Textarea id="note-body" name="body" required rows={5} maxLength={20000} />
              </Field>
            </ActionForm>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
