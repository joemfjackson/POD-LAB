import Link from "next/link";
import { AGENT_BY_KEY, isAgentKey } from "@/agents/registry";
import { StatusChip } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Time } from "@/components/ui/time";

export interface JobRowView {
  id: string;
  code: string;
  agent_key: string;
  status: string;
  attempts: number;
  max_attempts: number;
  result_summary: string | null;
  error: string | null;
  created_at: string;
  requested_by_actor: string;
  brands?: { code: string } | null;
}

export function JobsTable({ jobs, showBrand = true }: { jobs: JobRowView[]; showBrand?: boolean }) {
  if (!jobs.length) return <EmptyState title="No agent jobs yet" />;
  return (
    <Table>
      <THead>
        <tr>
          <TH>Job</TH>
          <TH>Agent</TH>
          {showBrand ? <TH>Brand</TH> : null}
          <TH>Status</TH>
          <TH>Result</TH>
          <TH>Attempts</TH>
          <TH>Created</TH>
        </tr>
      </THead>
      <TBody>
        {jobs.map((j) => (
          <TR key={j.id}>
            <TD>
              <Link href={`/agents/jobs/${j.id}`} className="font-mono text-xs text-accent hover:underline">
                {j.code}
              </Link>
            </TD>
            <TD className="text-xs whitespace-nowrap">{isAgentKey(j.agent_key) ? AGENT_BY_KEY[j.agent_key].name : j.agent_key}</TD>
            {showBrand ? <TD className="font-mono text-xs text-muted">{j.brands?.code ?? "—"}</TD> : null}
            <TD>
              <StatusChip status={j.status} />
            </TD>
            <TD className="max-w-md text-xs">
              {j.error && j.status !== "completed" ? <span className="text-critical-ink">{j.error.slice(0, 160)}</span> : <span className="text-ink-2">{j.result_summary ?? "—"}</span>}
            </TD>
            <TD className="text-xs text-muted tabular">
              {j.attempts}/{j.max_attempts}
            </TD>
            <TD className="text-xs">
              <Time value={j.created_at} />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
