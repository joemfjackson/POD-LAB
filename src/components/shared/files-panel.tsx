import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/fields";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Time } from "@/components/ui/time";
import type { Tables } from "@/lib/supabase/database.types";
import { deleteFileAction, uploadFileAction } from "@/server/actions/files";

export function UploadForm({ brandId, designId, defaultKind = "other" }: { brandId?: string | null; designId?: string | null; defaultKind?: string }) {
  return (
    <ActionForm action={uploadFileAction} submitLabel="Upload" hidden={{ brand_id: brandId, design_id: designId }} resetOnSuccess>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Field label="File" htmlFor={`file-${designId ?? brandId ?? "ws"}`} hint="PNG, JPEG, WebP, GIF, PDF, CSV, JSON or TXT · max 4 MB">
          <Input id={`file-${designId ?? brandId ?? "ws"}`} name="file" type="file" required accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.csv,.json,.txt,.md" className="h-auto py-1.5" />
        </Field>
        <Field label="Kind" htmlFor={`kind-${designId ?? brandId ?? "ws"}`}>
          <Select id={`kind-${designId ?? brandId ?? "ws"}`} name="kind" defaultValue={defaultKind}>
            {["design", "mockup", "logo", "research", "other"].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </ActionForm>
  );
}

export function FilesTable({ files, canDelete }: { files: Array<Pick<Tables<"files">, "id" | "name" | "kind" | "mime_type" | "size_bytes" | "created_at" | "path">>; canDelete: boolean }) {
  if (!files.length) return <EmptyState title="No files yet" description="Upload artwork, mockups, logos or research documents. Files are stored privately in Supabase Storage." />;
  return (
    <Table>
      <THead>
        <tr>
          <TH>Name</TH>
          <TH>Kind</TH>
          <TH>Type</TH>
          <TH className="text-right">Size</TH>
          <TH>Uploaded</TH>
          <TH>
            <span className="sr-only">Actions</span>
          </TH>
        </tr>
      </THead>
      <TBody>
        {files.map((f) => (
          <TR key={f.id}>
            <TD>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {f.name}
              </a>
              <p className="max-w-xs truncate font-mono text-[10px] text-muted" title={f.path}>
                {f.path}
              </p>
            </TD>
            <TD>
              <Badge>{f.kind}</Badge>
            </TD>
            <TD className="text-xs text-muted">{f.mime_type}</TD>
            <TD className="text-right text-xs tabular">{(f.size_bytes / 1024).toFixed(0)} KB</TD>
            <TD className="text-xs">
              <Time value={f.created_at} />
            </TD>
            <TD>
              <div className="flex items-center gap-2">
                <a href={`/api/files/${f.id}?download=1`} className="text-xs text-ink-2 hover:text-ink">
                  Download
                </a>
                {canDelete ? <ActionForm action={deleteFileAction} submitLabel="Delete" variant="ghost" size="sm" hidden={{ file_id: f.id }} confirm={`Delete ${f.name}? This cannot be undone.`} inline /> : null}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
