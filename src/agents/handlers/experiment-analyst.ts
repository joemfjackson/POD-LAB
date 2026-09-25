import { classifyExperiment, sumMetrics, type DecisionResult, type PrimaryMetric } from "@/domain/decision-engine";
import type { AdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { check, createGate, must, notify } from "../runtime/db-helpers";
import type { AgentHandler } from "../runtime/types";
import { analystOutputSchema, analystPayloadSchema, type AnalystOutput, type AnalystPayload } from "../schemas";
import { metricRowToRaw, toDecisionRules } from "./decision-rules";

interface Analysed {
  id: string;
  code: string;
  name: string;
  brandId: string;
  previousDecision: string | null;
  result: DecisionResult;
}

const NEXT_STEPS: Record<DecisionResult["decision"], string[]> = {
  insufficient_data: ["Keep the experiment running until every threshold is met.", "Do not change variants mid-test."],
  keep_collecting: ["Traffic is sufficient — keep running until the purchase threshold is reached."],
  kill: ["Stop the experiment and record what was learned.", "Consider killing or re-positioning the tested element."],
  iterate: ["Keep the engaging element and change the offer, price or product.", "Launch a follow-up experiment with a new challenger."],
  clone: ["Replicate the winning element into new designs, products or sub-niches.", "Run a paid test only after spending approval."],
  scale: ["Request scale approval before increasing spend.", "Protect margin: monitor CAC and contribution daily."],
};

export async function analyseExperiments(db: AdminClient, workspaceId: string, payload: AnalystPayload, asOf: Date): Promise<Analysed[]> {
  let q = db.from("experiments").select("*").eq("workspace_id", workspaceId);
  if (payload.experiment_ids?.length) q = q.in("id", payload.experiment_ids);
  else {
    q = q.eq("status", "running");
    if (payload.brand_id) q = q.eq("brand_id", payload.brand_id);
  }
  const experiments = must(await q, "load experiments");
  const defaultRules = (await db.from("decision_rule_sets").select("*").eq("workspace_id", workspaceId).eq("is_default", true).maybeSingle()).data;
  const out: Analysed[] = [];
  for (const e of experiments) {
    const ruleRow = e.decision_rule_set_id ? (await db.from("decision_rule_sets").select("*").eq("id", e.decision_rule_set_id).maybeSingle()).data : defaultRules;
    const variants = must(await db.from("experiment_variants").select("*").eq("experiment_id", e.id).order("key"), "load variants");
    const metrics = must(await db.from("experiment_metrics").select("*").eq("experiment_id", e.id), "load metrics");
    const result = classifyExperiment(
      { primaryMetric: e.primary_metric as PrimaryMetric, minimumSample: e.minimum_sample, startDate: e.start_date, asOf },
      variants.map((v) => ({ id: v.id, key: v.key, name: v.name, isControl: v.is_control, metrics: sumMetrics(metrics.filter((m) => m.variant_id === v.id).map(metricRowToRaw)) })),
      toDecisionRules(ruleRow),
    );
    out.push({ id: e.id, code: e.code, name: e.name, brandId: e.brand_id, previousDecision: e.decision, result });
  }
  return out;
}

export const experimentAnalystHandler: AgentHandler<AnalystPayload, AnalystOutput> = {
  key: "experiment_analyst",
  payloadSchema: analystPayloadSchema,
  outputSchema: analystOutputSchema,

  async prepare(ctx, payload) {
    const analysed = await analyseExperiments(ctx.db, ctx.workspace.id, payload, ctx.now);
    const input = {
      experiments: analysed.map((a) => ({
        code: a.code,
        name: a.name,
        decision: a.result.decision,
        reasons: a.result.reasons,
        checks: a.result.checks,
        winner: a.result.winner,
        totals: { sessions: a.result.totals.sessions, purchases: a.result.totals.purchases, conversion_rate: a.result.totals.conversionRate, contribution_margin: a.result.totals.contributionMargin, roas: a.result.totals.roas },
      })),
    };
    const demo = (): AnalystOutput => ({
      experiments: analysed.map((a) => ({
        experiment_code: a.code,
        narrative: `Decision engine result: ${a.result.decision.replace("_", " ")}. ${a.result.reasons.join(" ")}`,
        suggested_next_steps: NEXT_STEPS[a.result.decision],
        insight_candidates:
          a.result.decision === "insufficient_data" || a.result.decision === "keep_collecting"
            ? []
            : [
                {
                  title: `${a.name}: ${a.result.decision} (${a.result.totals.purchases} purchases)`,
                  body: `Observation from ${a.code}: ${a.result.reasons[0] ?? ""} This is an observation from one experiment, not a causal finding.`,
                  claim_type: "observation" as const,
                  confidence: a.result.totals.purchases >= 100 ? ("medium" as const) : ("low" as const),
                },
              ],
      })),
    });
    return {
      input: { ...input, analysed } as unknown as Record<string, unknown>,
      demo,
      sources: [],
      researchMode: ctx.demoMode ? "demo" : "model_only",
      brandId: payload.brand_id ?? null,
      skipOutput: analysed.length === 0 ? { experiments: [] } : undefined,
    };
  },

  async persist(ctx, _payload, out, prepared) {
    const { db, workspace, job } = ctx;
    const analysed = (prepared.input as unknown as { analysed: Analysed[] }).analysed;
    const narrative = new Map(out.experiments.map((e) => [e.experiment_code, e]));
    let gates = 0;
    const counts = new Map<string, number>();

    for (const a of analysed) {
      const n = narrative.get(a.code);
      counts.set(a.result.decision, (counts.get(a.result.decision) ?? 0) + 1);
      check(
        await db
          .from("experiments")
          .update({
            decision: a.result.decision,
            decision_reasons: a.result.reasons as unknown as Json,
            decision_details: {
              checks: a.result.checks,
              winner: a.result.winner,
              variants: a.result.variants.map((v) => ({ id: v.id, key: v.key, name: v.name, primary: v.primary, derived: v.derived })),
              totals: a.result.totals,
              narrative: n?.narrative ?? null,
              next_steps: n?.suggested_next_steps ?? NEXT_STEPS[a.result.decision],
            } as unknown as Json,
            decided_at: ctx.now.toISOString(),
            winning_variant_id: a.result.winner?.clear ? a.result.winner.variantId : null,
          })
          .eq("id", a.id),
        "update experiment decision",
      );

      const reachedThreshold = a.result.decision !== "insufficient_data" && (a.previousDecision === null || a.previousDecision === "insufficient_data");
      if (reachedThreshold) {
        await notify(db, {
          workspaceId: workspace.id,
          type: "experiment_threshold",
          title: `${a.code} reached its sample threshold: ${a.result.decision.replace("_", " ")}`,
          body: a.result.reasons.join(" ").slice(0, 400),
          link: `/experiments/${a.id}`,
          brandId: a.brandId,
        });
      }

      if (a.result.decision === "scale") {
        const brand = must(await db.from("brands").select("stage").eq("id", a.brandId).single(), "load brand");
        if (brand.stage === "testing" || brand.stage === "iterating") {
          await createGate(db, {
            workspaceId: workspace.id,
            gateType: "scale_approval",
            subjectType: "brand",
            subjectId: a.brandId,
            brandId: a.brandId,
            jobId: job.id,
            title: `Scale recommendation from ${a.code}: ${a.name}`,
            summary: a.result.reasons.join(" ").slice(0, 600),
            payload: { experiment_id: a.id },
          });
          gates++;
        }
      }

      for (const ins of n?.insight_candidates ?? []) {
        const purchases = a.result.totals.purchases;
        const confidence = purchases < 30 ? "low" : purchases < 200 && ins.confidence === "high" ? "medium" : ins.confidence;
        check(
          await db.from("insights").insert({
            workspace_id: workspace.id,
            title: ins.title,
            body: ins.body,
            source: "agent",
            claim_type: ins.claim_type,
            confidence,
            evidence_summary: `${a.code}: ${a.result.totals.sessions} sessions, ${purchases} purchases.`,
            sample_size: a.result.totals.sessions,
            brand_id: a.brandId,
            experiment_id: a.id,
            is_demo: ctx.demoMode,
          }),
          "insert insight",
        );
      }
    }

    const summary = analysed.length
      ? `Analysed ${analysed.length} experiment(s): ${[...counts.entries()].map(([k, v]) => `${v} ${k.replace("_", " ")}`).join(", ")}`
      : "No running experiments to analyse";
    return { summary, waitingForApproval: gates > 0, brandId: prepared.brandId };
  },
};
