import type { Metadata } from "next";
import { FilesTable, UploadForm } from "@/components/shared/files-panel";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { roleAtLeast } from "@/domain/permissions";
import { getContext } from "@/server/context";

export const metadata: Metadata = { title: "Files" };

const KINDS = ["design", "mockup", "logo", "research", "export", "import", "other"] as const;

export default async function FilesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  const ctx = await getContext();
  let q = ctx.db.from("files").select("id, name, kind, mime_type, size_bytes, created_at, path").eq("workspace_id", ctx.workspace.id).order("created_at", { ascending: false }).limit(300);
  if (KINDS.includes(sp.kind as (typeof KINDS)[number])) q = q.eq("kind", sp.kind as (typeof KINDS)[number]);
  const files = await q;
  return (
    <>
      <PageHeader title="Files" description="Private Supabase Storage organised as workspace/brand/designs|mockups|logos|research|exports. Metadata lives in the database; downloads use short-lived signed URLs." />
      {ctx.role !== "viewer" ? (
        <Card className="mb-5">
          <CardHeader title="Upload workspace file" />
          <CardBody>
            <UploadForm />
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader
          title="All files"
          actions={
            <form className="flex items-center gap-2" aria-label="Filter files">
              <label htmlFor="fkind" className="sr-only">
                Kind
              </label>
              <Select id="fkind" name="kind" defaultValue={sp.kind ?? ""} className="h-8 w-36 text-xs">
                <option value="">All kinds</option>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Filter
              </button>
            </form>
          }
        />
        <FilesTable files={files.data ?? []} canDelete={roleAtLeast(ctx.role, "admin")} />
      </Card>
    </>
  );
}
