"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAgentKey } from "@/agents/registry";
import { encryptSecret, encryptionConfigured, secretHint } from "@/lib/crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireContext } from "../context";
import { requestGate } from "../services/approvals";
import { UserFacingError, describeDbError } from "../services/errors";
import { ensureWorkspaceDefaults } from "../services/workspace";
import { toActionError, type ActionResult } from "./result";

const num = (min: number, max: number) => z.coerce.number().min(min).max(max);
const pct = z.coerce.number().min(0).max(100).transform((v) => v / 100);

async function audit(ctx: Awaited<ReturnType<typeof requireContext>>, action: string, summary: string) {
  await ctx.db.from("audit_log").insert({ workspace_id: ctx.workspace.id, actor_type: "human", actor_id: ctx.user.id, action, subject_type: "workspace", subject_id: ctx.workspace.id, summary });
}

export async function updateWorkspaceAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("workspace.manage");
    const input = z
      .object({
        name: z.string().trim().min(2).max(120),
        daily_ai_budget_usd: num(0, 10000),
        max_research_depth: z.coerce.number().int().min(1).max(5),
        max_candidates: z.coerce.number().int().min(1).max(100),
      })
      .parse({ name: fd.get("name"), daily_ai_budget_usd: fd.get("daily_ai_budget_usd"), max_research_depth: fd.get("max_research_depth"), max_candidates: fd.get("max_candidates") });
    const res = await ctx.db.from("workspaces").update(input).eq("id", ctx.workspace.id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save."));
    await audit(ctx, "workspace.updated", `${ctx.user.displayName} updated workspace settings (budget $${input.daily_ai_budget_usd}/day, max ${input.max_candidates} candidates, depth ${input.max_research_depth})`);
    revalidatePath("/settings");
    return { ok: true, message: "Workspace settings saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateAiSettingsAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.configure");
    const provider = z.enum(["", "demo", "openai_compatible"]).parse(fd.get("ai_provider") ?? "");
    const model = z.string().trim().max(120).parse(fd.get("ai_default_model") ?? "");
    const res = await ctx.db.from("workspaces").update({ ai_provider: provider || null, ai_default_model: model || null }).eq("id", ctx.workspace.id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save."));
    await audit(ctx, "workspace.ai_updated", `${ctx.user.displayName} set AI provider to ${provider || "environment default"}${model ? ` (${model})` : ""}`);
    revalidatePath("/", "layout");
    return { ok: true, message: "AI settings saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateAgentConfigAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.configure");
    const key = z.string().refine(isAgentKey).parse(fd.get("key"));
    const opt = (k: string) => {
      const v = fd.get(k);
      return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    };
    const input = z
      .object({
        enabled: z.boolean(),
        provider: z.enum(["demo", "openai_compatible"]).nullable(),
        model: z.string().max(120).nullable(),
        temperature: z.coerce.number().min(0).max(2).nullable(),
        max_output_tokens: z.coerce.number().int().min(256).max(64000).nullable(),
        daily_run_limit: z.coerce.number().int().min(0).max(10000),
        daily_cost_limit_usd: num(0, 10000),
      })
      .parse({
        enabled: fd.get("enabled") === "on",
        provider: opt("provider"),
        model: opt("model"),
        temperature: opt("temperature"),
        max_output_tokens: opt("max_output_tokens"),
        daily_run_limit: fd.get("daily_run_limit"),
        daily_cost_limit_usd: fd.get("daily_cost_limit_usd"),
      });
    const res = await ctx.db.from("agents").update(input).eq("workspace_id", ctx.workspace.id).eq("key", key);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save."));
    await audit(ctx, "agent.configured", `${ctx.user.displayName} updated ${key} configuration`);
    revalidatePath("/settings/agents");
    return { ok: true, message: "Agent configuration saved." };
  } catch (e) {
    return toActionError(e);
  }
}

/** Stores an encrypted credential; it only becomes active after OWNER approval. */
export async function submitCredentialAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("credentials.submit");
    if (!encryptionConfigured()) throw new UserFacingError("POD_LAB_ENCRYPTION_KEY is not configured on the server, so credentials cannot be stored. Use environment variables instead.");
    const kind = z.enum(["ai", "research", "image", "fulfillment", "commerce"]).parse(fd.get("provider_kind"));
    const key = z.string().regex(/^[a-z0-9_]{2,40}$/).parse(fd.get("provider_key"));
    const secret = z.string().trim().min(8, "That does not look like a valid key").max(4000).parse(fd.get("secret"));
    const label = `${kind}:${key}`;
    const admin = createSupabaseAdminClient();
    const cred = await admin
      .from("provider_credentials")
      .insert({ workspace_id: ctx.workspace.id, provider_kind: kind, provider_key: key, label, ciphertext: encryptSecret(secret), hint: secretHint(secret), status: "pending_approval", created_by: ctx.user.id })
      .select("id")
      .single();
    if (cred.error) throw new UserFacingError(cred.error.message);
    const gate = await requestGate(ctx.db, {
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      gateType: "provider_credentials",
      subjectType: "provider_credentials",
      subjectId: cred.data.id,
      brandId: null,
      title: `Activate ${label} credential (${secretHint(secret)})`,
      summary: "The secret is encrypted at rest and never shown again. The workspace owner must approve activation.",
    });
    revalidatePath("/settings", "layout");
    return { ok: true, message: `Credential stored encrypted; owner approval requested (${gate.code}).` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function revokeCredentialAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("credentials.submit");
    const id = z.uuid().parse(fd.get("credential_id"));
    const admin = createSupabaseAdminClient();
    const res = await admin.from("provider_credentials").update({ status: "revoked" }).eq("id", id).eq("workspace_id", ctx.workspace.id).select("label");
    if (!res.data?.length) throw new UserFacingError("Credential not found.");
    await audit(ctx, "credential.revoked", `${ctx.user.displayName} revoked credential ${res.data[0]!.label}`);
    revalidatePath("/settings", "layout");
    return { ok: true, message: "Credential revoked." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateProviderConfigAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("providers.configure");
    const id = z.uuid().parse(fd.get("provider_id"));
    const baseUrl = z.string().trim().max(300).parse(fd.get("api_base_url") ?? "");
    if (baseUrl && !/^https:\/\//.test(baseUrl)) throw new UserFacingError("The API base URL must use https://");
    const accountId = z.string().trim().max(120).parse(fd.get("account_id") ?? "");
    const notes = z.string().trim().max(2000).parse(fd.get("notes") ?? "");
    const res = await ctx.db.from("fulfillment_providers").update({ config: { api_base_url: baseUrl || null, account_id: accountId || null }, notes: notes || null }).eq("id", id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save."));
    await audit(ctx, "provider.configured", `${ctx.user.displayName} updated a fulfillment provider configuration`);
    revalidatePath("/settings/providers");
    return { ok: true, message: "Provider configuration saved (non-secret settings only)." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateDecisionRulesAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.configure");
    const id = z.uuid().parse(fd.get("rule_set_id"));
    const i = (k: string) => z.coerce.number().int().min(0).max(10_000_000).parse(fd.get(k));
    const p = (k: string) => z.coerce.number().min(-100).max(100).transform((v) => v / 100).parse(fd.get(k));
    const input = {
      min_sessions: i("min_sessions"),
      min_impressions: i("min_impressions"),
      min_purchases: i("min_purchases"),
      min_ad_spend_usd: z.coerce.number().min(0).parse(fd.get("min_ad_spend_usd")),
      min_days_running: i("min_days_running"),
      kill_max_conversion_rate: p("kill_max_conversion_rate"),
      kill_max_ctr: p("kill_max_ctr"),
      kill_max_contribution_margin: p("kill_max_contribution_margin"),
      scale_min_roas: z.coerce.number().min(0).max(100).parse(fd.get("scale_min_roas")),
      scale_min_contribution_margin: p("scale_min_contribution_margin"),
      scale_min_conversion_rate: p("scale_min_conversion_rate"),
      clone_min_ctr: p("clone_min_ctr"),
      iterate_min_ctr: p("iterate_min_ctr"),
      min_lift_for_winner: p("min_lift_for_winner"),
    };
    const res = await ctx.db.from("decision_rule_sets").update(input).eq("id", id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save."));
    await audit(ctx, "rules.updated", `${ctx.user.displayName} updated experiment decision thresholds`);
    revalidatePath("/settings/rules");
    return { ok: true, message: "Decision rules saved. They apply to the next analysis." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updatePricingModelAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("agents.configure");
    const id = z.uuid().parse(fd.get("pricing_model_id"));
    const threshold = fd.get("free_shipping_threshold");
    const input = {
      payment_processing_pct: pct.parse(fd.get("payment_processing_pct")),
      payment_processing_fixed: num(0, 100).parse(fd.get("payment_processing_fixed")),
      platform_fee_pct: pct.parse(fd.get("platform_fee_pct")),
      shipping_charged: num(0, 1000).parse(fd.get("shipping_charged")),
      free_shipping_threshold: threshold === "" || threshold === null ? null : num(0, 100000).parse(threshold),
      refund_reserve_pct: pct.parse(fd.get("refund_reserve_pct")),
      target_cac: num(0, 10000).parse(fd.get("target_cac")),
      target_contribution_margin: pct.parse(fd.get("target_contribution_margin")),
      min_gross_margin: pct.parse(fd.get("min_gross_margin")),
    };
    const res = await ctx.db.from("pricing_models").update(input).eq("id", id);
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not save."));
    await audit(ctx, "pricing.updated", `${ctx.user.displayName} updated pricing assumptions`);
    revalidatePath("/settings/rules");
    return { ok: true, message: "Pricing assumptions saved. Recompute products to apply them." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addMemberAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("members.manage");
    const email = z.email().parse(String(fd.get("email") ?? "").trim().toLowerCase());
    const role = z.enum(["admin", "editor", "viewer"]).parse(fd.get("role"));
    const admin = createSupabaseAdminClient();
    const user = await admin.from("users").select("id").ilike("email", email).maybeSingle();
    if (!user.data) throw new UserFacingError("No POD Lab account uses that email yet. Ask them to sign up first, then add them.");
    const res = await ctx.db.from("workspace_members").insert({ workspace_id: ctx.workspace.id, user_id: user.data.id, role });
    if (res.error) throw new UserFacingError(describeDbError(res.error, "Could not add the member."));
    await audit(ctx, "member.added", `${ctx.user.displayName} added ${email} as ${role}`);
    revalidatePath("/settings/members");
    return { ok: true, message: `Added ${email} as ${role}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateMemberAction(_prev: ActionResult<unknown>, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireContext("members.manage");
    const id = z.uuid().parse(fd.get("member_id"));
    const op = z.enum(["role", "remove"]).parse(fd.get("op"));
    if (op === "remove") {
      const res = await ctx.db.from("workspace_members").delete().eq("id", id).neq("user_id", ctx.user.id).select("id");
      if (!res.data?.length) throw new UserFacingError("Could not remove (owners and yourself cannot be removed here).");
      await audit(ctx, "member.removed", `${ctx.user.displayName} removed a member`);
    } else {
      const role = z.enum(["admin", "editor", "viewer"]).parse(fd.get("role"));
      const res = await ctx.db.from("workspace_members").update({ role }).eq("id", id).neq("user_id", ctx.user.id).select("id");
      if (!res.data?.length) throw new UserFacingError("Could not change that role.");
      await audit(ctx, "member.role_changed", `${ctx.user.displayName} changed a member's role to ${role}`);
    }
    revalidatePath("/settings/members");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function repairDefaultsAction(): Promise<ActionResult> {
  try {
    const ctx = await requireContext("workspace.manage");
    await ensureWorkspaceDefaults(createSupabaseAdminClient(), ctx.workspace.id);
    revalidatePath("/settings", "layout");
    return { ok: true, message: "Workspace defaults verified." };
  } catch (e) {
    return toActionError(e);
  }
}
