import "server-only";
import { randomUUID } from "node:crypto";
import type { AgentKey } from "@/domain/lifecycle";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { agentModelOverride, serverEnv } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto";
import { aiPricing, getAIProvider } from "@/providers/ai";
import { estimateCostUsd } from "@/providers/ai/types";
import { ProviderNotConfiguredError, ProviderTransientError } from "@/providers/errors";
import { getResearchProvider } from "@/providers/research";
import { activePrompt } from "../prompts/registry";
import { AGENT_BY_KEY, isAgentKey } from "../registry";
import { HANDLERS } from "../handlers";
import { check, logAgentActivity, must, notify } from "./db-helpers";
import { checkLimits } from "./limits";
import { enqueueJob, retryDelaySeconds } from "./queue";
import { generateValidated } from "./structured";
import type { AgentContext, JobRow } from "./types";

export interface ProcessResult {
  jobId: string;
  status: "completed" | "waiting_for_approval" | "failed" | "queued";
  summary: string | null;
  error: string | null;
}

class PermanentJobError extends Error {}

async function activeCredential(db: AdminClient, workspaceId: string, kind: "ai" | "research", key: string): Promise<string | null> {
  const { data } = await db
    .from("provider_credentials")
    .select("ciphertext")
    .eq("workspace_id", workspaceId)
    .eq("provider_kind", kind)
    .eq("provider_key", key)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  try {
    return decryptSecret(data.ciphertext);
  } catch {
    return null;
  }
}

/**
 * Claims and executes one agent job (a specific one, or the next runnable job).
 * Every attempt is recorded as an agent_run; only validated output is persisted.
 */
export async function processJob(db: AdminClient, opts: { jobId?: string; workspaceId?: string; worker?: string } = {}): Promise<ProcessResult | null> {
  const worker = opts.worker ?? `worker-${randomUUID().slice(0, 8)}`;
  const claimed = await db.rpc("claim_agent_job", {
    worker,
    target_job: opts.jobId,
    target_workspace: opts.workspaceId,
  });
  if (claimed.error) throw new Error(`claim job: ${claimed.error.message}`);
  const job = (claimed.data as JobRow[] | null)?.[0];
  if (!job) return null;
  return executeClaimedJob(db, job);
}

async function executeClaimedJob(db: AdminClient, job: JobRow): Promise<ProcessResult> {
  const started = Date.now();
  let runId: string | null = null;
  const agentKey = job.agent_key;

  try {
    if (!isAgentKey(agentKey)) throw new PermanentJobError(`Unknown agent ${agentKey}`);
    const handler = HANDLERS[agentKey];
    const def = AGENT_BY_KEY[agentKey];
    const workspace = must(await db.from("workspaces").select("*").eq("id", job.workspace_id).single(), "load workspace");
    const agent = must(
      await db.from("agents").select("*").eq("workspace_id", job.workspace_id).eq("key", agentKey).single(),
      `load agent config for ${agentKey}`,
    );

    const payload = handler.payloadSchema.safeParse(job.payload);
    if (!payload.success) {
      throw new PermanentJobError(`Invalid job payload: ${payload.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
    }

    const limits = await checkLimits(db, workspace, agent);
    if (!limits.ok) throw new PermanentJobError(limits.reason ?? "Limit reached");

    const env = serverEnv();
    const providerId = agent.provider ?? workspace.ai_provider ?? env.AI_PROVIDER;
    const aiKey = providerId === "openai_compatible" ? await activeCredential(db, workspace.id, "ai", "openai_compatible") : null;
    const provider = getAIProvider({ provider: providerId, apiKey: aiKey });
    const researchKey = env.RESEARCH_PROVIDER !== "none" ? await activeCredential(db, workspace.id, "research", env.RESEARCH_PROVIDER) : null;
    const research = getResearchProvider({ apiKey: researchKey });
    const model = provider.isDemo
      ? "demo-deterministic-v1"
      : (agent.model ?? agentModelOverride(agentKey) ?? workspace.ai_default_model ?? env.AI_DEFAULT_MODEL);
    const temperature = agent.temperature !== null ? Number(agent.temperature) : def.defaultTemperature;
    const maxOutputTokens = agent.max_output_tokens ?? def.defaultMaxOutputTokens;
    const prompt = activePrompt(agentKey);

    const run = must(
      await db
        .from("agent_runs")
        .insert({
          workspace_id: job.workspace_id,
          job_id: job.id,
          agent_key: agentKey,
          attempt: job.attempts,
          status: "running",
          provider: provider.id,
          model,
          temperature,
          prompt_version: prompt.id,
          schema_version: def.schemaVersion,
          input: job.payload,
        })
        .select("id")
        .single(),
      "create run",
    );
    runId = run.id;

    const ctx: AgentContext = { db, workspace, job, agent, runId, research, demoMode: provider.isDemo, now: new Date() };
    const prepared = await handler.prepare(ctx, payload.data);
    check(
      await db
        .from("agent_runs")
        .update({
          input: prepared.input as Json,
          sources: prepared.sources.map((s) => ({ ref: s.ref, url: s.url, title: s.title, publisher: s.publisher, published_at: s.publishedAt, retrieved_at: s.retrievedAt })) as Json,
        })
        .eq("id", runId),
      "record run input",
    );

    let output: unknown;
    let raw: string;
    let usage = { inputTokens: 0, outputTokens: 0, estimated: true };
    let validationRetries = 0;
    let validationErrors: unknown = null;
    let servedModel = model;

    if (prepared.skipOutput !== undefined) {
      output = prepared.skipOutput;
      raw = JSON.stringify(output);
    } else {
      const gen = await generateValidated({
        provider,
        schema: handler.outputSchema,
        schemaName: def.outputType,
        system: prompt.system,
        user: prompt.render(prepared.input),
        model,
        temperature: provider.isDemo ? null : temperature,
        maxOutputTokens: provider.isDemo ? null : maxOutputTokens,
        demo: prepared.demo,
      });
      usage = gen.usage;
      raw = gen.raw;
      servedModel = gen.model;
      validationRetries = gen.attempts - 1;
      validationErrors = gen.validationHistory.length ? gen.validationHistory : null;
      if (!gen.ok) {
        const cost = provider.isDemo ? 0 : estimateCostUsd(usage, aiPricing());
        check(
          await db
            .from("agent_runs")
            .update({
              status: "failed",
              error: gen.error,
              raw_output: raw.slice(0, 200_000),
              validation_errors: validationErrors as Json,
              validation_retries: validationRetries,
              input_tokens: usage.inputTokens,
              output_tokens: usage.outputTokens,
              usage_is_estimated: usage.estimated,
              estimated_cost_usd: cost,
              model: servedModel,
              duration_ms: Date.now() - started,
              completed_at: new Date().toISOString(),
            })
            .eq("id", runId),
          "record failed run",
        );
        runId = null; // already finalised
        throw new ProviderTransientError(`${gen.error}. Malformed output was discarded.`);
      }
      output = gen.data;
    }

    check(
      await db.from("agent_outputs").insert({
        workspace_id: job.workspace_id,
        run_id: run.id,
        job_id: job.id,
        agent_key: agentKey,
        output_type: def.outputType,
        schema_version: def.schemaVersion,
        data: output as Json,
        brand_id: prepared.brandId ?? job.brand_id,
        opportunity_id: prepared.opportunityId ?? job.opportunity_id,
      }),
      "store validated output",
    );

    const result = await handler.persist(ctx, payload.data, output, prepared);
    const cost = provider.isDemo ? 0 : estimateCostUsd(usage, aiPricing());
    check(
      await db
        .from("agent_runs")
        .update({
          status: "succeeded",
          raw_output: raw.slice(0, 200_000),
          validation_errors: validationErrors as Json,
          validation_retries: validationRetries,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          usage_is_estimated: usage.estimated,
          estimated_cost_usd: cost,
          model: servedModel,
          duration_ms: Date.now() - started,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id),
      "finalise run",
    );

    const status = result.waitingForApproval ? "waiting_for_approval" : "completed";
    check(
      await db
        .from("agent_jobs")
        .update({
          status,
          result_summary: result.summary,
          completed_at: new Date().toISOString(),
          locked_by: null,
          locked_at: null,
          brand_id: job.brand_id ?? result.brandId ?? null,
        })
        .eq("id", job.id),
      "complete job",
    );
    await logAgentActivity(db, {
      workspaceId: job.workspace_id,
      agentKey: agentKey as AgentKey,
      action: "agent.completed",
      summary: `${def.name}: ${result.summary}`,
      brandId: result.brandId ?? job.brand_id,
      subjectType: "agent_job",
      subjectId: job.id,
      metadata: { job_code: job.code, run_id: run.id, provider: provider.id, model: servedModel, demo: provider.isDemo },
    });

    for (const follow of result.followUps ?? []) {
      await enqueueJob(db, { ...follow, workspaceId: job.workspace_id, actor: "agent", parentJobId: job.id });
    }

    return { jobId: job.id, status, summary: result.summary, error: null };
  } catch (err) {
    return failJob(db, job, runId, err, started);
  }
}

async function failJob(db: AdminClient, job: JobRow, runId: string | null, err: unknown, started: number): Promise<ProcessResult> {
  const message = err instanceof Error ? err.message : String(err);
  const permanent = err instanceof PermanentJobError || err instanceof ProviderNotConfiguredError;
  const retry = !permanent && job.attempts < job.max_attempts;

  if (runId) {
    await db
      .from("agent_runs")
      .update({ status: "failed", error: message.slice(0, 4000), duration_ms: Date.now() - started, completed_at: new Date().toISOString() })
      .eq("id", runId);
  }

  if (retry) {
    await db
      .from("agent_jobs")
      .update({
        status: "queued",
        error: message.slice(0, 4000),
        locked_by: null,
        locked_at: null,
        scheduled_at: new Date(Date.now() + retryDelaySeconds(job.attempts) * 1000).toISOString(),
      })
      .eq("id", job.id);
    return { jobId: job.id, status: "queued", summary: null, error: message };
  }

  await db
    .from("agent_jobs")
    .update({ status: "failed", error: message.slice(0, 4000), completed_at: new Date().toISOString(), locked_by: null, locked_at: null })
    .eq("id", job.id);
  const name = isAgentKey(job.agent_key) ? AGENT_BY_KEY[job.agent_key].name : job.agent_key;
  await notify(db, {
    workspaceId: job.workspace_id,
    type: "agent_failed",
    title: `${name} failed (${job.code})`,
    body: message.slice(0, 500),
    link: `/agents/jobs/${job.id}`,
    brandId: job.brand_id,
    severity: "critical",
  }).catch(() => undefined);
  await logAgentActivity(db, {
    workspaceId: job.workspace_id,
    agentKey: isAgentKey(job.agent_key) ? job.agent_key : "system",
    action: "agent.failed",
    summary: `${name} failed: ${message.slice(0, 300)}`,
    brandId: job.brand_id,
    subjectType: "agent_job",
    subjectId: job.id,
  }).catch(() => undefined);
  return { jobId: job.id, status: "failed", summary: null, error: message };
}

/** Drains up to `limit` runnable jobs (used by the cron endpoint). */
export async function drainQueue(db: AdminClient, limit = 5, workspaceId?: string): Promise<ProcessResult[]> {
  await db.rpc("recover_stale_agent_jobs", { stale_after_seconds: 900 });
  const results: ProcessResult[] = [];
  for (let i = 0; i < limit; i++) {
    const r = await processJob(db, { workspaceId });
    if (!r) break;
    results.push(r);
  }
  return results;
}
