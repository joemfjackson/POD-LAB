import { DesignGrid, type DesignCardData } from "@/components/shared/design-grid";
import { ButtonLink } from "@/components/ui/button";
import { designThumbnails } from "@/server/queries/assets";
import { getBrand } from "@/server/queries/brand";

export default async function BrandDesigns({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await getBrand(id);
  const designs = await ctx.db
    .from("design_concepts")
    .select("id, code, title, concept, status, compliance_status, printing_method, preferred_products, is_demo, collections(name)")
    .eq("brand_id", id)
    .order("created_at");
  const thumbs = await designThumbnails(ctx.db, (designs.data ?? []).map((d) => d.id));
  return (
    <>
      <div className="mb-3 flex justify-end">
        <ButtonLink href={`/design-studio?brand=${id}`} size="sm">
          Open in Design Studio
        </ButtonLink>
      </div>
      <DesignGrid designs={(designs.data ?? []).map((d) => ({ ...(d as DesignCardData), thumbnail: thumbs.get(d.id) ?? null }))} />
    </>
  );
}
