import Link from "next/link";
import { DemoBadge, StatusChip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/domain/format";

export interface ExperimentRowView {
  id: string;
  code: string;
  name: string;
  experiment_type: string;
  primary_metric: string;
  status: string;
  decision: string | null;
  override_decision: string | null;
  start_date: string | null;
  is_demo: boolean;
  brands?: { code: string } | null;
  experiment_variants?: Array<{ key: string }>;
}

export function ExperimentsTable({ experiments, showBrand = true }: { experiments: ExperimentRowView[]; showBrand?: boolean }) {
  if (!experiments.length) return <EmptyState title="No experiments" description="Create an experiment or let the Growth Agent propose them." />;
  return (
    <Table>
      <THead>
        <tr>
          <TH>ID</TH>
          <TH>Experiment</TH>
          {showBrand ? <TH>Brand</TH> : null}
          <TH>Tests</TH>
          <TH>Metric</TH>
          <TH>Variants</TH>
          <TH>Status</TH>
          <TH>Analyst decision</TH>
          <TH>Started</TH>
        </tr>
      </THead>
      <TBody>
        {experiments.map((e) => (
          <TR key={e.id}>
            <TD className="font-mono text-xs text-muted">{e.code}</TD>
            <TD>
              <Link href={`/experiments/${e.id}`} className="text-ink hover:text-accent">
                {e.name}
              </Link>{" "}
              <DemoBadge show={e.is_demo} />
            </TD>
            {showBrand ? <TD className="font-mono text-xs text-muted">{e.brands?.code}</TD> : null}
            <TD className="text-xs">{e.experiment_type.replace(/_/g, " ")}</TD>
            <TD className="text-xs">{e.primary_metric.replace(/_/g, " ")}</TD>
            <TD className="text-xs tabular">{e.experiment_variants?.length ?? "—"}</TD>
            <TD>
              <StatusChip status={e.status} />
            </TD>
            <TD>
              {e.override_decision ? (
                <>
                  <StatusChip status={e.override_decision} /> <span className="text-[10px] text-muted">override</span>
                </>
              ) : (
                <StatusChip status={e.decision ?? "insufficient_data"} label={e.decision ? undefined : "not analysed"} />
              )}
            </TD>
            <TD className="text-xs text-muted">{formatDate(e.start_date)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
