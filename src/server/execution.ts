import "server-only";
import { after } from "next/server";
import { processJob, type ProcessResult } from "@/agents/runtime/runner";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Executes a freshly queued job. "inline" runs it within the request (demo
 * runs finish instantly; real model calls are bounded by maxDuration);
 * "deferred" schedules it after the response and the UI polls job status.
 * Anything not picked up here is drained by /api/cron/jobs.
 */
export async function executeJob(jobId: string): Promise<ProcessResult | null> {
  const admin = createSupabaseAdminClient();
  if (serverEnv().AGENT_EXECUTION_MODE === "deferred") {
    after(async () => {
      await processJob(admin, { jobId }).catch((e: unknown) => console.error("[job] deferred execution failed", e));
      await drainFollowUps(admin, jobId);
    });
    return null;
  }
  const result = await processJob(admin, { jobId });
  await drainFollowUps(admin, jobId);
  return result;
}

/** Runs jobs chained by the Director from this job (e.g. compliance after creative). */
async function drainFollowUps(admin: ReturnType<typeof createSupabaseAdminClient>, parentJobId: string) {
  const children = await admin.from("agent_jobs").select("id").eq("parent_job_id", parentJobId).eq("status", "queued").limit(5);
  for (const c of children.data ?? []) await processJob(admin, { jobId: c.id });
}
