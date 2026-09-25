import type { SupabaseClient } from "@supabase/supabase-js";
import { checkDirectTransition, STAGE_LABELS, type BrandStage } from "@/domain/lifecycle";
import type { Database } from "@/lib/supabase/database.types";
import { requestGate } from "./approvals";
import { describeDbError, UserFacingError } from "./errors";

type Db = SupabaseClient<Database>;

async function pausedFrom(db: Db, brandId: string): Promise<BrandStage | null> {
  const h = await db.from("brand_stage_history").select("from_stage").eq("brand_id", brandId).eq("to_stage", "paused").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (h.data?.from_stage as BrandStage | null) ?? null;
}

/** Human stage change (non-gated transitions only), with history and audit. */
export async function transitionBrand(db: Db, params: { brandId: string; to: BrandStage; reason: string; userId: string }) {
  const brand = await db.from("brands").select("id, workspace_id, stage, code").eq("id", params.brandId).single();
  if (brand.error) throw new UserFacingError("Brand not found.");
  const from = brand.data.stage as BrandStage;
  const checkResult = checkDirectTransition(from, params.to, { pausedFrom: from === "paused" ? await pausedFrom(db, params.brandId) : null });
  if (!checkResult.ok) throw new UserFacingError(checkResult.reason);
  const upd = await db.from("brands").update({ stage: params.to }).eq("id", params.brandId);
  if (upd.error) throw new UserFacingError(describeDbError(upd.error, "Could not change the stage."));
  await db.from("brand_stage_history").insert({
    workspace_id: brand.data.workspace_id,
    brand_id: params.brandId,
    from_stage: from,
    to_stage: params.to,
    actor_type: "human",
    actor_id: params.userId,
    reason: params.reason,
  });
  await db.from("audit_log").insert({
    workspace_id: brand.data.workspace_id,
    actor_type: "human",
    actor_id: params.userId,
    action: "brand.stage_changed",
    subject_type: "brand",
    subject_id: params.brandId,
    brand_id: params.brandId,
    summary: `${brand.data.code} moved ${STAGE_LABELS[from]} → ${STAGE_LABELS[params.to]}: ${params.reason}`,
  });
  return { from, to: params.to };
}

export type BrandDecision = "kill" | "iterate" | "clone" | "scale" | "pause" | "keep_collecting";

/**
 * Records a portfolio decision. Kill/iterate/pause move the stage directly;
 * scale requests the scale approval gate; clone creates a new brand record
 * seeded from this one (stage "idea").
 */
export async function recordBrandDecision(
  db: Db,
  params: { brandId: string; decision: BrandDecision; reason: string; userId: string; experimentId?: string | null },
): Promise<{ newBrandId?: string; gateId?: string }> {
  if (params.reason.trim().length < 3) throw new UserFacingError("Please give a reason for the decision.");
  const brand = await db.from("brands").select("*").eq("id", params.brandId).single();
  if (brand.error) throw new UserFacingError("Brand not found.");
  const b = brand.data;
  const result: { newBrandId?: string; gateId?: string } = {};

  if (params.decision === "kill") await transitionBrand(db, { brandId: b.id, to: "killed", reason: params.reason, userId: params.userId });
  else if (params.decision === "pause") await transitionBrand(db, { brandId: b.id, to: "paused", reason: params.reason, userId: params.userId });
  else if (params.decision === "iterate") {
    if (b.stage !== "iterating") await transitionBrand(db, { brandId: b.id, to: "iterating", reason: params.reason, userId: params.userId });
  } else if (params.decision === "scale") {
    if (b.stage !== "testing" && b.stage !== "iterating") throw new UserFacingError("Only brands in testing or iterating can be scaled.");
    const gate = await requestGate(db, {
      workspaceId: b.workspace_id,
      userId: params.userId,
      gateType: "scale_approval",
      subjectType: "brand",
      subjectId: b.id,
      brandId: b.id,
      title: `Scale ${b.code} ${b.official_name ?? b.working_title}`,
      summary: params.reason,
      payload: params.experimentId ? { experiment_id: params.experimentId } : {},
    });
    result.gateId = gate.id;
  } else if (params.decision === "clone") {
    const clone = await db
      .from("brands")
      .insert({
        workspace_id: b.workspace_id,
        working_title: `${b.official_name ?? b.working_title} (clone)`.slice(0, 200),
        niche: b.niche,
        sub_niche: b.sub_niche,
        audience: b.audience,
        stage: "idea",
        opportunity_thesis: `Cloned from ${b.code}: ${params.reason}`,
        positioning: b.positioning,
        hypotheses: { cloned_from: b.code, reason: params.reason },
        is_demo: b.is_demo,
        created_by: params.userId,
      })
      .select("id, code")
      .single();
    if (clone.error) throw new UserFacingError(describeDbError(clone.error, "Could not clone the brand."));
    await db.from("brand_stage_history").insert({
      workspace_id: b.workspace_id,
      brand_id: clone.data.id,
      from_stage: null,
      to_stage: "idea",
      actor_type: "human",
      actor_id: params.userId,
      reason: `Cloned from ${b.code}`,
    });
    result.newBrandId = clone.data.id;
  }

  const ins = await db.from("brand_decisions").insert({
    workspace_id: b.workspace_id,
    brand_id: b.id,
    decision: params.decision,
    reason: params.reason,
    source: "human",
    decided_by: params.userId,
    experiment_id: params.experimentId ?? null,
  });
  if (ins.error) throw new UserFacingError(describeDbError(ins.error, "Could not record the decision."));
  await db.from("audit_log").insert({
    workspace_id: b.workspace_id,
    actor_type: "human",
    actor_id: params.userId,
    action: `brand.decision.${params.decision}`,
    subject_type: "brand",
    subject_id: b.id,
    brand_id: b.id,
    summary: `Decision on ${b.code}: ${params.decision.replace("_", " ")} — ${params.reason}`,
  });
  return result;
}
