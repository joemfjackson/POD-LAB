"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IMPORT_KINDS, previewImport, type ImportKind, type RowError } from "@/domain/csv";
import { requireContext } from "../context";
import { commitImport } from "../services/imports";
import { toActionError, type ActionResult } from "./result";

const kindSchema = z.enum(Object.keys(IMPORT_KINDS) as [ImportKind, ...ImportKind[]]);
const mappingSchema = z.record(z.string(), z.number().int().min(0).max(500)).optional();

export interface PreviewResult {
  headers: string[];
  mapping: Record<string, number>;
  fields: Array<{ key: string; required: boolean }>;
  missingRequired: string[];
  totalRows: number;
  validCount: number;
  sample: Array<Record<string, unknown>>;
  errors: RowError[];
}

export async function previewImportAction(kind: string, csv: string, mapping?: Record<string, number>): Promise<ActionResult<PreviewResult>> {
  try {
    await requireContext("imports.run");
    const k = kindSchema.parse(kind);
    const p = previewImport(k, z.string().max(4 * 1024 * 1024).parse(csv), mappingSchema.parse(mapping));
    const def = IMPORT_KINDS[k];
    return {
      ok: true,
      data: {
        headers: p.headers,
        mapping: p.mapping,
        fields: Object.keys(def.schema.shape).map((key) => ({ key, required: (def.required as readonly string[]).includes(key) })),
        missingRequired: p.missingRequired,
        totalRows: p.totalRows,
        validCount: p.valid.length,
        sample: p.valid.slice(0, 8).map((v) => v.data as Record<string, unknown>),
        errors: p.errors.slice(0, 200),
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function commitImportAction(input: { kind: string; csv: string; filename: string; mapping?: Record<string, number>; brandId?: string; experimentId?: string }): Promise<ActionResult<{ imported: number; errors: RowError[]; total: number }>> {
  try {
    const ctx = await requireContext("imports.run");
    const r = await commitImport(ctx.db, {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      kind: kindSchema.parse(input.kind),
      filename: z.string().max(200).parse(input.filename),
      csv: z.string().max(4 * 1024 * 1024).parse(input.csv),
      mapping: mappingSchema.parse(input.mapping),
      target: { brandId: z.uuid().optional().parse(input.brandId || undefined), experimentId: z.uuid().optional().parse(input.experimentId || undefined) },
    });
    revalidatePath("/imports");
    return { ok: true, message: `Imported ${r.imported} of ${r.total} rows${r.errors.length ? ` — ${r.errors.length} error(s) skipped` : ""}.`, data: { imported: r.imported, errors: r.errors.slice(0, 200), total: r.total } };
  } catch (e) {
    return toActionError(e);
  }
}
