import type { SupabaseClient } from "@supabase/supabase-js";
import { HANDLERS } from "@/agents/handlers";
import { AGENT_BY_KEY } from "@/agents/registry";
import { enqueueJob } from "@/agents/runtime/queue";
import type { AgentKey } from "@/domain/lifecycle";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { UserFacingError } from "./errors";

export interface RequestRunInput {
  workspaceId: string;
  userId: string;
  agentKey: AgentKey;
  payload: Record<string, unknown>;
  brandId?: string | null;
  missionId?: string | null;
  opportunityId?: string | null;
  priority?: number;
}

/**
 * Validates and enqueues an agent run requested by a human. The caller must
 * have already verified the user's role; payloads are validated with the
 * agent's own Zod schema before anything is queued.
 */
export async function requestAgentRun(admin: AdminClient, input: RequestRunInput) {
  const handler = HANDLERS[input.agentKey];
  const parsed = handler.payloadSchema.safeParse(input.payload);
  if (!parsed.success) {
    throw new UserFacingError(`Invalid input for ${AGENT_BY_KEY[input.agentKey].name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ")}`);
  }
  if (input.brandId) {
    const brand = await admin.from("brands").select("id").eq("id", input.brandId).eq("workspace_id", input.workspaceId).maybeSingle();
    if (!brand.data) throw new UserFacingError("Brand not found in this workspace.");
  }
  return enqueueJob(admin, {
    workspaceId: input.workspaceId,
    agentKey: input.agentKey,
    payload: parsed.data as Record<string, unknown>,
    brandId: input.brandId ?? null,
    missionId: input.missionId ?? null,
    opportunityId: input.opportunityId ?? null,
    priority: input.priority,
    requestedBy: input.userId,
    actor: "human",
  });
}

export async function createMission(
  db: SupabaseClient<Database>,
  admin: AdminClient,
  input: {
    workspaceId: string;
    userId: string;
    title: string;
    prompt: string;
    missionType: "discover" | "investigate" | "revisit";
    maxCandidates: number;
    researchDepth: number;
    brandId?: string | null;
    trendId?: string | null;
  },
) {
  const ws = await db.from("workspaces").select("max_candidates, max_research_depth").eq("id", input.workspaceId).single();
  if (ws.error) throw new UserFacingError("Workspace not found.");
  const maxCandidates = Math.min(input.maxCandidates, ws.data.max_candidates);
  const depth = Math.min(input.researchDepth, ws.data.max_research_depth);
  const mission = await db
    .from("research_missions")
    .insert({
      workspace_id: input.workspaceId,
      title: input.title,
      prompt: input.prompt,
      mission_type: input.missionType,
      max_candidates: maxCandidates,
      research_depth: depth,
      status: "queued",
      created_by: input.userId,
      brand_id: input.brandId ?? null,
      trend_id: input.trendId ?? null,
    })
    .select("*")
    .single();
  if (mission.error) throw new UserFacingError(mission.error.message);
  const { job, deduplicated } = await requestAgentRun(admin, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    agentKey: "opportunity_scout",
    payload: {
      mission_id: mission.data.id,
      prompt: input.prompt,
      mission_type: input.missionType,
      max_candidates: maxCandidates,
      research_depth: depth,
      ...(input.brandId ? { brand_id: input.brandId } : {}),
    },
    brandId: input.brandId ?? null,
    missionId: mission.data.id,
  });
  await admin.from("research_missions").update({ job_id: job.id }).eq("id", mission.data.id);
  return { mission: mission.data, job, deduplicated };
}
