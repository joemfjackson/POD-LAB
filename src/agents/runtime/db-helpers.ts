import type { AdminClient } from "@/lib/supabase/admin";
import type { Database, TablesInsert } from "@/lib/supabase/database.types";
import type { AgentKey, BrandStage } from "@/domain/lifecycle";
import { transitionKind } from "@/domain/lifecycle";

type NotificationType = TablesInsert<"notifications">["type"];

/** Throws on Supabase errors so failures are never silently swallowed. */
export function must<T>(res: { data: T; error: { message: string; code?: string } | null }, context: string): NonNullable<T> {
  if (res.error) throw new Error(`${context}: ${res.error.message}`);
  if (res.data === null || res.data === undefined) throw new Error(`${context}: no data returned`);
  return res.data as NonNullable<T>;
}

export function check(res: { error: { message: string } | null }, context: string): void {
  if (res.error) throw new Error(`${context}: ${res.error.message}`);
}

export async function logAgentActivity(
  db: AdminClient,
  params: { workspaceId: string; agentKey: AgentKey | "system"; action: string; summary: string; brandId?: string | null; subjectType?: string; subjectId?: string | null; metadata?: Record<string, unknown> },
) {
  check(
    await db.from("audit_log").insert({
      workspace_id: params.workspaceId,
      actor_type: params.agentKey === "system" ? "system" : "agent",
      agent_key: params.agentKey === "system" ? null : params.agentKey,
      action: params.action,
      summary: params.summary,
      brand_id: params.brandId ?? null,
      subject_type: params.subjectType ?? null,
      subject_id: params.subjectId ?? null,
      metadata: (params.metadata ?? {}) as Database["public"]["Tables"]["audit_log"]["Insert"]["metadata"],
    }),
    "audit log",
  );
}

export async function notify(
  db: AdminClient,
  params: { workspaceId: string; type: NotificationType; title: string; body?: string; link?: string; brandId?: string | null; severity?: "info" | "warning" | "critical" },
) {
  check(
    await db.from("notifications").insert({
      workspace_id: params.workspaceId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      link: params.link ?? null,
      brand_id: params.brandId ?? null,
      severity: params.severity ?? "info",
    }),
    "notification",
  );
}

/**
 * Agent-initiated stage move. Only non-gated transitions are possible (the
 * database rejects gated ones outside an approval decision). Returns false and
 * leaves the stage untouched when the move is not valid from the current stage.
 */
export async function agentMoveBrand(
  db: AdminClient,
  params: { workspaceId: string; brandId: string; to: BrandStage; agentKey: AgentKey; reason: string },
): Promise<boolean> {
  const brand = must(await db.from("brands").select("stage").eq("id", params.brandId).eq("workspace_id", params.workspaceId).single(), "load brand");
  const from = brand.stage as BrandStage;
  if (from === params.to || transitionKind(from, params.to) !== "allowed") return false;
  check(await db.from("brands").update({ stage: params.to }).eq("id", params.brandId), "move brand");
  check(
    await db.from("brand_stage_history").insert({
      workspace_id: params.workspaceId,
      brand_id: params.brandId,
      from_stage: from,
      to_stage: params.to,
      actor_type: "agent",
      reason: `${params.agentKey}: ${params.reason}`,
    }),
    "stage history",
  );
  return true;
}

export async function createGate(
  db: AdminClient,
  params: {
    workspaceId: string;
    gateType: Database["public"]["Enums"]["approval_gate_type"];
    subjectType: string;
    subjectId: string;
    brandId?: string | null;
    jobId?: string | null;
    title: string;
    summary?: string;
    payload?: Record<string, unknown>;
  },
): Promise<string | null> {
  // An open gate for the same subject already exists → reuse it.
  const existing = await db
    .from("approval_gates")
    .select("id")
    .eq("gate_type", params.gateType)
    .eq("subject_id", params.subjectId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing.data) return existing.data.id;
  const res = await db
    .from("approval_gates")
    .insert({
      workspace_id: params.workspaceId,
      gate_type: params.gateType,
      subject_type: params.subjectType,
      subject_id: params.subjectId,
      brand_id: params.brandId ?? null,
      job_id: params.jobId ?? null,
      title: params.title,
      summary: params.summary ?? null,
      payload: (params.payload ?? {}) as Database["public"]["Tables"]["approval_gates"]["Insert"]["payload"],
      requested_by_actor: "agent",
    })
    .select("id")
    .single();
  const gate = must(res, "create approval gate");
  await notify(db, {
    workspaceId: params.workspaceId,
    type: "approval_needed",
    title: `Approval needed: ${params.title}`,
    body: params.summary,
    link: `/approvals/${gate.id}`,
    brandId: params.brandId,
    severity: "warning",
  });
  return gate.id;
}
