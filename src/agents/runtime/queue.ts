import { createHash } from "node:crypto";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { AGENT_BY_KEY } from "../registry";
import type { EnqueueRequest, JobRow } from "./types";

export interface EnqueueOptions extends EnqueueRequest {
  workspaceId: string;
  requestedBy?: string | null;
  actor: "human" | "agent" | "system";
  parentJobId?: string | null;
  maxAttempts?: number;
}

export function defaultDedupeKey(req: EnqueueRequest): string {
  const hash = createHash("sha256").update(JSON.stringify(req.payload)).digest("hex").slice(0, 16);
  return `${req.agentKey}:${req.brandId ?? req.missionId ?? req.opportunityId ?? "ws"}:${hash}`;
}

/**
 * Inserts a queued job. If an identical job (same dedupe key) is already queued
 * or running, that job is returned instead — preventing duplicate execution.
 */
export async function enqueueJob(db: AdminClient, opts: EnqueueOptions): Promise<{ job: JobRow; deduplicated: boolean }> {
  const def = AGENT_BY_KEY[opts.agentKey];
  const dedupeKey = opts.dedupeKey === null ? null : (opts.dedupeKey ?? defaultDedupeKey(opts));
  const insert = await db
    .from("agent_jobs")
    .insert({
      workspace_id: opts.workspaceId,
      agent_key: opts.agentKey,
      type: def.outputType,
      payload: opts.payload as Json,
      priority: opts.priority ?? 100,
      dedupe_key: dedupeKey,
      brand_id: opts.brandId ?? null,
      opportunity_id: opts.opportunityId ?? null,
      mission_id: opts.missionId ?? null,
      parent_job_id: opts.parentJobId ?? null,
      requested_by: opts.requestedBy ?? null,
      requested_by_actor: opts.actor,
      max_attempts: opts.maxAttempts ?? 3,
    })
    .select("*")
    .single();

  if (insert.error) {
    if (insert.error.code === "23505" && dedupeKey) {
      const existing = await db
        .from("agent_jobs")
        .select("*")
        .eq("workspace_id", opts.workspaceId)
        .eq("dedupe_key", dedupeKey)
        .in("status", ["queued", "running"])
        .maybeSingle();
      if (existing.data) return { job: existing.data, deduplicated: true };
    }
    throw new Error(`enqueue ${opts.agentKey}: ${insert.error.message}`);
  }
  return { job: insert.data, deduplicated: false };
}

export function retryDelaySeconds(attempt: number): number {
  return Math.min(30 * 2 ** Math.max(0, attempt - 1), 3600);
}
