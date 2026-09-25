import type { AdminClient } from "@/lib/supabase/admin";
import type { AgentRow, WorkspaceRow } from "./types";

export interface LimitCheck {
  ok: boolean;
  reason: string | null;
  runsToday: number;
  agentCostToday: number;
  workspaceCostToday: number;
}

function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** Enforces per-agent daily run/cost limits and the workspace daily AI budget. */
export async function checkLimits(db: AdminClient, workspace: WorkspaceRow, agent: AgentRow, now = new Date()): Promise<LimitCheck> {
  const since = startOfUtcDay(now);
  const { data, error } = await db
    .from("agent_runs")
    .select("agent_key, estimated_cost_usd")
    .eq("workspace_id", workspace.id)
    .gte("started_at", since);
  if (error) throw new Error(`limit check: ${error.message}`);
  const rows = data ?? [];
  const agentRows = rows.filter((r) => r.agent_key === agent.key);
  const runsToday = agentRows.length;
  const agentCostToday = agentRows.reduce((s, r) => s + Number(r.estimated_cost_usd), 0);
  const workspaceCostToday = rows.reduce((s, r) => s + Number(r.estimated_cost_usd), 0);

  let reason: string | null = null;
  if (!agent.enabled) reason = `${agent.name} is disabled in Settings → Agents.`;
  else if (runsToday >= agent.daily_run_limit) reason = `${agent.name} reached its daily run limit (${agent.daily_run_limit}).`;
  else if (agentCostToday >= Number(agent.daily_cost_limit_usd))
    reason = `${agent.name} reached its daily cost limit ($${Number(agent.daily_cost_limit_usd).toFixed(2)}).`;
  else if (workspaceCostToday >= Number(workspace.daily_ai_budget_usd))
    reason = `Workspace daily AI budget reached ($${Number(workspace.daily_ai_budget_usd).toFixed(2)}).`;
  return { ok: reason === null, reason, runsToday, agentCostToday, workspaceCostToday };
}
