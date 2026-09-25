import { FilesTable, UploadForm } from "@/components/shared/files-panel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { roleAtLeast } from "@/domain/permissions";
import { getBrand } from "@/server/queries/brand";

export default async function BrandFiles({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const files = await ctx.db.from("files").select("id, name, kind, mime_type, size_bytes, created_at, path").eq("brand_id", id).order("created_at", { ascending: false });
  return (
    <div className="space-y-5">
      {ctx.role !== "viewer" ? (
        <Card>
          <CardHeader title="Upload" />
          <CardBody>
            <UploadForm brandId={id} />
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Brand files" description={`Stored under ${ctx.workspace.id.slice(0, 8)}…/${id.slice(0, 8)}…/<kind>s/`} />
        <FilesTable files={files.data ?? []} canDelete={roleAtLeast(ctx.role, "admin")} />
      </Card>
    </div>
  );
}
