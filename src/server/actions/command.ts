"use server";

import { AGENT_BY_KEY } from "@/agents/registry";
import { parseCommand } from "@/domain/command-parser";
import { parseCode } from "@/domain/ids";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireContext } from "../context";
import { executeJob } from "../execution";
import { defaultPayload } from "../services/agent-defaults";
import { createMission } from "../services/agents";
import { UserFacingError } from "../services/errors";
import { enforceAgentRateLimit, startAgentJob } from "./agents";
import { toActionError, type ActionResult } from "./result";

const ENTITY_ROUTES: Record<string, { table: string; href: (id: string) => string }> = {
  brand: { table: "brands", href: (id) => `/brands/${id}` },
  opportunity: { table: "opportunities", href: (id) => `/opportunities/${id}` },
  design: { table: "design_concepts", href: (id) => `/design-studio/${id}` },
  experiment: { table: "experiments", href: (id) => `/experiments/${id}` },
  job: { table: "agent_jobs", href: (id) => `/agents/jobs/${id}` },
  approval: { table: "approval_gates", href: (id) => `/approvals/${id}` },
  store: { table: "stores", href: (id) => `/stores/${id}` },
  campaign: { table: "campaigns", href: (id) => `/growth/${id}` },
  mission: { table: "research_missions", href: () => `/opportunities` },
  product: { table: "brand_products", href: () => `/products` },
  trend: { table: "trends", href: () => `/trends` },
  insight: { table: "insights", href: () => `/insights` },
};

async function resolveCode(code: string): Promise<string | null> {
  const ctx = await requireContext();
  const parsed = parseCode(code);
  if (!parsed?.entity) return null;
  const route = ENTITY_ROUTES[parsed.entity];
  if (!route) return null;
  const res = await ctx.db
    .from(route.table as "brands")
    .select("id")
    .eq("workspace_id", ctx.workspace.id)
    .eq("code", parsed.code)
    .maybeSingle();
  return res.data ? route.href(res.data.id) : null;
}

export async function runCommandAction(text: string): Promise<ActionResult<{ href: string }>> {
  try {
    const ctx = await requireContext();
    const cmd = parseCommand(String(text).slice(0, 500), { maxCandidates: ctx.workspace.max_candidates });
    if (!cmd) return { ok: false, error: "Type a command or search term." };

    switch (cmd.type) {
      case "navigate":
        return { ok: true, data: { href: cmd.href } };
      case "search":
        return { ok: true, data: { href: `/search?q=${encodeURIComponent(cmd.query)}` } };
      case "open_code": {
        const href = await resolveCode(cmd.code);
        if (!href) return { ok: false, error: `${cmd.code} was not found in this workspace.` };
        return { ok: true, data: { href } };
      }
      case "create_mission": {
        await requireContext("agents.run");
        await enforceAgentRateLimit(ctx);
        const admin = createSupabaseAdminClient();
        const { mission, job } = await createMission(ctx.db, admin, {
          workspaceId: ctx.workspace.id,
          userId: ctx.user.id,
          title: cmd.title,
          prompt: cmd.prompt,
          missionType: /^investigate/i.test(cmd.prompt) ? "investigate" : "discover",
          maxCandidates: cmd.maxCandidates,
          researchDepth: 1,
        });
        await executeJob(job.id);
        return { ok: true, message: `Mission ${mission.code} created`, data: { href: `/opportunities?mission=${mission.id}` } };
      }
      case "run_agent": {
        await requireContext("agents.run");
        const def = AGENT_BY_KEY[cmd.agent];
        let brand: { id: string; niche: string; opportunity_id: string | null } | null = null;
        if (cmd.target) {
          const parsed = parseCode(cmd.target);
          const q = ctx.db.from("brands").select("id, niche, opportunity_id").eq("workspace_id", ctx.workspace.id);
          const res = parsed?.entity === "brand"
            ? await q.eq("code", parsed.code).maybeSingle()
            : await q.or(`working_title.ilike.%${cmd.target.replace(/[%,()]/g, "")}%,official_name.ilike.%${cmd.target.replace(/[%,()]/g, "")}%,niche.ilike.%${cmd.target.replace(/[%,()]/g, "")}%`).limit(1).maybeSingle();
          brand = res.data;
          if (!brand) return { ok: false, error: `No brand matches "${cmd.target}".` };
        } else if (def.brandScoped) {
          return { ok: false, error: `${def.name} needs a brand, e.g. "Run ${def.name} for PL-0001".` };
        }
        const { job } = await startAgentJob(ctx, cmd.agent, defaultPayload(cmd.agent, brand), brand?.id ?? null);
        return { ok: true, data: { href: `/agents/jobs/${job.id}` } };
      }
    }
  } catch (e) {
    if (e instanceof UserFacingError) return { ok: false, error: e.message };
    return toActionError(e);
  }
}
