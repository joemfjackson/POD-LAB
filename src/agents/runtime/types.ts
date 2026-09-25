import type { ZodType } from "zod";
import type { AgentKey } from "@/domain/lifecycle";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import type { ResearchDocument, ResearchProvider } from "@/providers/research/types";

export type JobRow = Tables<"agent_jobs">;
export type AgentRow = Tables<"agents">;
export type WorkspaceRow = Tables<"workspaces">;

export type ResearchMode = "live" | "model_only" | "demo" | "manual";

export interface AgentContext {
  db: AdminClient;
  workspace: WorkspaceRow;
  job: JobRow;
  agent: AgentRow;
  runId: string;
  research: ResearchProvider;
  /** true when the deterministic demo provider is producing output */
  demoMode: boolean;
  now: Date;
}

export interface EnqueueRequest {
  agentKey: AgentKey;
  payload: Record<string, unknown>;
  brandId?: string | null;
  opportunityId?: string | null;
  missionId?: string | null;
  priority?: number;
  dedupeKey?: string | null;
}

export interface Prepared<O> {
  /** structured input given to the prompt (stored on the run for audit) */
  input: Record<string, unknown>;
  demo: () => O;
  sources: ResearchDocument[];
  researchMode: ResearchMode;
  brandId?: string | null;
  opportunityId?: string | null;
  /** skip the model call entirely (e.g. nothing to analyse); persist receives `skipOutput` */
  skipOutput?: O;
}

export interface PersistResult {
  summary: string;
  waitingForApproval: boolean;
  brandId?: string | null;
  followUps?: EnqueueRequest[];
}

export interface AgentHandler<P, O> {
  key: AgentKey;
  payloadSchema: ZodType<P>;
  outputSchema: ZodType<O>;
  prepare(ctx: AgentContext, payload: P): Promise<Prepared<O>>;
  persist(ctx: AgentContext, payload: P, output: O, prepared: Prepared<O>): Promise<PersistResult>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous handler registry; each handler is fully typed internally
export type AnyAgentHandler = AgentHandler<any, any>;
