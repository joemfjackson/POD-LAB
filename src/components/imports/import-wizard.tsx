"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ImportKind, RowError } from "@/domain/csv";
import { commitImportAction, previewImportAction, type PreviewResult } from "@/server/actions/imports";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/fields";

const KIND_LABELS: Record<ImportKind, string> = {
  fulfillment_catalog: "Fulfillment catalog",
  products: "Products (manual catalog)",
  orders: "Orders",
  experiment_metrics: "Experiment metrics",
};

export function ImportWizard({
  initialKind,
  brands,
  experiments,
  initialBrand,
  initialExperiment,
}: {
  initialKind: ImportKind;
  brands: Array<{ id: string; label: string }>;
  experiments: Array<{ id: string; label: string }>;
  initialBrand?: string;
  initialExperiment?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [brandId, setBrandId] = useState(initialBrand ?? brands[0]?.id ?? "");
  const [experimentId, setExperimentId] = useState(initialExperiment ?? experiments[0]?.id ?? "");
  const [csv, setCsv] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<{ imported: number; errors: RowError[]; total: number } | null>(null);
  const [pending, start] = useTransition();

  const runPreview = (text: string, map?: Record<string, number>) =>
    start(async () => {
      setResult(null);
      const r = await previewImportAction(kind, text, map);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      setMessage(null);
      setPreview(r.data!);
      setMapping(r.data!.mapping);
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Import type" htmlFor="imp-kind">
          <Select
            id="imp-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as ImportKind);
              setPreview(null);
            }}
          >
            {(Object.keys(KIND_LABELS) as ImportKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        {kind === "orders" ? (
          <Field label="Brand" htmlFor="imp-brand">
            <Select id="imp-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {kind === "experiment_metrics" ? (
          <Field label="Experiment" htmlFor="imp-exp">
            <Select id="imp-exp" value={experimentId} onChange={(e) => setExperimentId(e.target.value)}>
              {experiments.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="CSV file" htmlFor="imp-file" hint="UTF-8 CSV with a header row · max 4 MB · 5,000 rows">
          <Input
            id="imp-file"
            type="file"
            accept=".csv,text/csv"
            className="h-auto py-1.5"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 4 * 1024 * 1024) return setMessage({ ok: false, text: "The file is larger than 4 MB." });
              const text = await f.text();
              setCsv(text);
              setFilename(f.name);
              runPreview(text);
            }}
          />
        </Field>
      </div>

      {message ? (
        <p role="alert" className={message.ok ? "text-xs text-good-ink" : "text-xs text-critical-ink"}>
          {message.text}
        </p>
      ) : null}
      {pending ? <p className="text-xs text-muted">Validating…</p> : null}

      {preview && csv ? (
        <div className="space-y-4">
          <div className="rounded-md border border-line p-3">
            <p className="mb-2 text-xs font-semibold text-ink-2">Column mapping</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {preview.fields.map((f) => (
                <Field key={f.key} label={`${f.key.replace(/_/g, " ")}${f.required ? " *" : ""}`} htmlFor={`map-${f.key}`}>
                  <Select
                    id={`map-${f.key}`}
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => {
                      const next = { ...mapping };
                      if (e.target.value === "") delete next[f.key];
                      else next[f.key] = Number(e.target.value);
                      setMapping(next);
                    }}
                    className="h-8 text-xs"
                  >
                    <option value="">— not mapped —</option>
                    {preview.headers.map((h, i) => (
                      <option key={`${h}-${i}`} value={i}>
                        {h || `column ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            <Button size="sm" className="mt-3" onClick={() => runPreview(csv, mapping)} disabled={pending}>
              Re-validate with mapping
            </Button>
          </div>

          <p className="text-sm">
            <span className="text-ink">{preview.validCount}</span> valid of <span className="text-ink">{preview.totalRows}</span> rows ·{" "}
            <span className={preview.errors.length ? "text-critical-ink" : "text-muted"}>{preview.errors.length} error(s)</span>
            {preview.missingRequired.length ? <span className="text-critical-ink"> · missing required: {preview.missingRequired.join(", ")}</span> : null}
          </p>

          {preview.sample.length ? (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-left text-xs">
                <caption className="px-2 py-1.5 text-left text-muted">Preview (first {preview.sample.length} valid rows)</caption>
                <thead>
                  <tr className="border-b border-line text-muted">
                    {Object.keys(preview.sample[0]!).map((k) => (
                      <th key={k} className="px-2 py-1 font-medium whitespace-nowrap">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, i) => (
                    <tr key={i} className="border-b border-line/60">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-2 py-1 whitespace-nowrap text-ink-2">
                          {Array.isArray(v) ? v.join(" | ") : v === null ? "—" : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {preview.errors.length ? (
            <details open={preview.validCount === 0}>
              <summary className="cursor-pointer text-xs text-critical-ink">Error rows ({preview.errors.length})</summary>
              <ul className="mt-2 max-h-60 space-y-0.5 overflow-y-auto text-xs text-ink-2">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row} · <span className="font-mono">{e.field}</span>: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <Button
            variant="primary"
            disabled={pending || preview.validCount === 0 || preview.missingRequired.length > 0 || (kind === "orders" && !brandId) || (kind === "experiment_metrics" && !experimentId)}
            onClick={() =>
              start(async () => {
                const r = await commitImportAction({ kind, csv, filename, mapping, brandId: kind === "orders" ? brandId : undefined, experimentId: kind === "experiment_metrics" ? experimentId : undefined });
                if (!r.ok) return setMessage({ ok: false, text: r.error });
                setMessage({ ok: true, text: r.message ?? "Imported." });
                setResult(r.data ?? null);
                router.refresh();
              })
            }
          >
            Import {preview.validCount} valid row(s)
          </Button>
          {result?.errors.length ? <p className="text-xs text-muted">{result.errors.length} row error(s) were skipped and stored with the import batch.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
