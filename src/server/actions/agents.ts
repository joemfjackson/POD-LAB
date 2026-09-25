"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AGENT_BY_KEY, isAgentKey } from "@/agents/registry";
import type { AgentKey } from "@/domain/lifecycle";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireContext, type AppContext } from "../context";
import { executeJob } from "../execution";
import { defaultPayload } from "../services/agent-defaults";
import { createMission, requestAgentRun } from "../services/agents";
import { UserFacingError } from "../services/errors";
import { toActionError, type ActionResult } from "./result";

/** Per-user rate limit on expensive agent routes (30 runs / hour). */
export async function enforceAgentRateLimit(ctx: AppContext) {
  const r = await ctx.db.rpc("consume_rate_limit", { bucket: "agent_run", max_hits: 30, window_seconds: 3600 });
  if (r.error || r.data !== true) throw new UserFacingError("Rate limit reached: at most 30 agent runs per hour per user. Try again later.");
}

export async function startAgentJob(ctx: AppContext, agent: AgentKey, payload: Record<string, unknown>, brandId: string | null) {
  await enforceAgentRateLimit(ctx);
  const admin = createSupabaseAdminClient();
  const { job, deduplicated } = await requestAgentRun(admin, { workspaceId: ctx.workspace.id, userId: ctx.user.id, agentKey: agent, payload, brandId });
  if (deduplicated) return { job, message: `${AGENT_BY_KEY[agent].name} is already queued or running (${job.code}).` };
  const result = await executeJob(job.id);
  if (!result) return { job, message: `${AGENT_BY_KEY[agent].name} queued as ${job.code}.` };
  if (result.status === "failed") throw new UserFacingError(`${AGENT_BY_KEY[agent].name} failed (${job.code}): ${result.error}`);
  if (result.status === "queued") return { job, message: `${job.code} hit a temporary error and will retry: ${result.error}` };
  return { job, message: `${AGENT_BY_KEY[agent].name} ${result.status === "waiting_for_approval" ? "finished — approval needed" : "finished"}: ${result.summary}` };
}

const runSchema = z.object({
  agent: z.string().refine(isAgentKey, "Unknown agent"),
  brand_id: z.uuid().optional(),
  payload: z.string().max(10_000).optional(),
});

/** Generic "Run agent" button. Optional JSON payload overrides the defaults (validated by the agent's schema). */
export async function runAgentAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult<{ jobId: string }>> {
  try {
    const ctx = await requireContext("agents.run");
    const input = runSchema.parse({ agent: fd.get("agent"), brand_id: fd.get("brand_id") || undefined, payload: fd.get("payload") || undefined });
    const agent = input.agent as AgentKey;
    let brand = null;
    if (input.brand_id) {
      const b = await ctx.db.from("brands").select("id, niche, opportunity_id").eq("id", input.brand_id).single();
      if (b.error) throw new UserFacingError("Brand not found.");
      brand = b.data;
    }
    const extra: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v !== "string" || !k.startsWith("p_") || v === "") continue;
      const key = k.slice(2);
      extra[key] = key.endsWith("_ids") ? v.split(",").map((x) => x.trim()).filter(Boolean) : /^\d+$/.test(v) ? Number(v) : v;
    }
    let overrides: Record<string, unknown> = {};
    if (input.payload) {
      try {
        overrides = JSON.parse(input.payload) as Record<string, unknown>;
      } catch {
        throw new UserFacingError("Payload must be valid JSON.");
      }
    }
    const payload = { ...defaultPayload(agent, brand), ...extra, ...overrides };
    const { job, message } = await startAgentJob(ctx, agent, payload, brand?.id ?? null);
    revalidatePath("/", "layout");
    return { ok: true, message, data: { jobId: job.id } };
  } catch (e) {
    return toActionError(e);
  }
}

const missionSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(300),
  prompt: z.string().trim().min(3, "Describe the mission").max(4000),
  mission_type: z.enum(["discover", "investigate", "revisit"]),
  max_candidates: z.coerce.number().int().min(1).max(100),
  research_depth: z.coerce.number().int().min(1).max(5),
  brand_id: z.uuid().optional(),
  trend_id: z.uuid().optional(),
});

export async function createMissionAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult<{ missionId: string }>> {
  try {
    const ctx = await requireContext("agents.run");
    const input = missionSchema.parse({
      title: fd.get("title"),
      prompt: fd.get("prompt"),
      mission_type: fd.get("mission_type") ?? "discover",
      max_candidates: fd.get("max_candidates") ?? 10,
      research_depth: fd.get("research_depth") ?? 1,
      brand_id: fd.get("brand_id") || undefined,
      trend_id: fd.get("trend_id") || undefined,
    });
    await enforceAgentRateLimit(ctx);
    const admin = createSupabaseAdminClient();
    const { mission, job } = await createMission(ctx.db, admin, {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      title: input.title,
      prompt: input.prompt,
      missionType: input.mission_type,
      maxCandidates: input.max_candidates,
      researchDepth: input.research_depth,
      brandId: input.brand_id ?? null,
      trendId: input.trend_id ?? null,
    });
    if (input.trend_id) await ctx.db.from("trends").update({ status: "sent_to_scout" }).eq("id", input.trend_id);
    const result = await executeJob(job.id);
    revalidatePath("/opportunities");
    if (result?.status === "failed") return { ok: false, error: `Mission ${mission.code} failed: ${result.error}` };
    return { ok: true, message: result ? `${mission.code}: ${result.summary}` : `${mission.code} queued (${job.code}).`, data: { missionId: mission.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function retryJobAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.run");
    const id = z.uuid().parse(fd.get("job_id"));
    const job = await ctx.db.from("agent_jobs").select("*").eq("id", id).single();
    if (job.error) throw new UserFacingError("Job not found.");
    if (job.data.status !== "failed" && job.data.status !== "cancelled") throw new UserFacingError("Only failed or cancelled jobs can be retried.");
    const agent = job.data.agent_key;
    if (!isAgentKey(agent)) throw new UserFacingError("Unknown agent.");
    const { message } = await startAgentJob(ctx, agent, job.data.payload as Record<string, unknown>, job.data.brand_id);
    revalidatePath("/agents");
    return { ok: true, message: `Retry started. ${message}` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cancelJobAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    await requireContext("agents.run");
    const ctx = await requireContext();
    const id = z.uuid().parse(fd.get("job_id"));
    const admin = createSupabaseAdminClient();
    const res = await admin.from("agent_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", ctx.workspace.id).eq("status", "queued").select("id");
    if (!res.data?.length) throw new UserFacingError("Only queued jobs can be cancelled.");
    await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action: "job.cancelled", subject_type: "agent_job", subject_id: id, summary: `${ctx.user.displayName} cancelled a queued job` });
    revalidatePath("/agents");
    return { ok: true, message: "Job cancelled." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function processQueueAction(): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.configure");
    const admin = createSupabaseAdminClient();
    const { drainQueue } = await import("@/agents/runtime/runner");
    const results = await drainQueue(admin, 5, ctx.workspace.id);
    revalidatePath("/agents");
    return { ok: true, message: results.length ? `Processed ${results.length} job(s).` : "No runnable jobs in the queue." };
  } catch (e) {
    return toActionError(e);
  }
}
