import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENT_BY_KEY } from "@/agents/registry";
import { check } from "@/agents/runtime/db-helpers";
import { recommendedActions, type BrandStage, type GateType } from "@/domain/lifecycle";
import { canDecideGate, gateMinRole, type WorkspaceRole } from "@/domain/permissions";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { describeDbError, UserFacingError } from "./errors";

export type Decision = "approved" | "rejected" | "revision_requested";

/**
 * Human decision on an approval gate. The database function enforces the role
 * and applies side effects atomically; afterwards the Director marks the
 * originating job complete and announces what is unlocked next.
 */
export async function decideGate(
  db: SupabaseClient<Database>,
  admin: AdminClient,
  params: { gateId: string; decision: Decision; reason: string | null; role: WorkspaceRole | null },
) {
  const gate = await db.from("approval_gates").select("*").eq("id", params.gateId).single();
  if (gate.error || !gate.data) throw new UserFacingError("Approval request not found.");
  if (!canDecideGate(params.role, gate.data.gate_type as GateType)) {
    throw new UserFacingError(`Only ${gateMinRole(gate.data.gate_type as GateType)}s or above can decide this approval.`);
  }
  const res = await db.rpc("decide_approval_gate", { p_gate_id: params.gateId, p_decision: params.decision, p_reason: params.reason ?? undefined });
  if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not record the decision."));
  const decided = res.data;

  if (decided.job_id) {
    const open = await admin.from("approval_gates").select("id", { count: "exact", head: true }).eq("job_id", decided.job_id).eq("status", "pending");
    if ((open.count ?? 0) === 0) {
      check(await admin.from("agent_jobs").update({ status: "completed" }).eq("id", decided.job_id).eq("status", "waiting_for_approval"), "complete job");
    }
  }

  const brandId = decided.brand_id;
  if (brandId && params.decision === "approved") {
    const brand = await admin.from("brands").select("stage, code, workspace_id").eq("id", brandId).maybeSingle();
    if (brand.data) {
      const next = recommendedActions(brand.data.stage as BrandStage).find((a) => a.agent);
      await admin.from("notifications").insert({
        workspace_id: brand.data.workspace_id,
        type: "stage_ready",
        title: `${brand.data.code} is ready: ${next ? `run ${AGENT_BY_KEY[next.agent!].name}` : "next stage unlocked"}`,
        body: next?.description ?? null,
        link: `/brands/${brandId}`,
        brand_id: brandId,
      });
    }
  }
  return decided;
}

/** Human-initiated approval request (e.g. design → production, brand name → final). */
export async function requestGate(
  db: SupabaseClient<Database>,
  params: {
    workspaceId: string;
    userId: string;
    gateType: GateType;
    subjectType: string;
    subjectId: string;
    brandId: string | null;
    title: string;
    summary?: string;
    payload?: Record<string, unknown>;
  },
) {
  const existing = await db.from("approval_gates").select("*").eq("gate_type", params.gateType).eq("subject_id", params.subjectId).eq("status", "pending").maybeSingle();
  if (existing.data) return existing.data;
  const res = await db
    .from("approval_gates")
    .insert({
      workspace_id: params.workspaceId,
      gate_type: params.gateType,
      subject_type: params.subjectType,
      subject_id: params.subjectId,
      brand_id: params.brandId,
      title: params.title,
      summary: params.summary ?? null,
      payload: (params.payload ?? {}) as Json,
      requested_by: params.userId,
      requested_by_actor: "human",
    })
    .select("*")
    .single();
  if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not create the approval request."));
  await db.from("notifications").insert({
    workspace_id: params.workspaceId,
    type: "approval_needed",
    title: `Approval needed: ${params.title}`,
    link: `/approvals/${res.data.id}`,
    brand_id: params.brandId,
    severity: "warning",
  });
  return res.data;
}
