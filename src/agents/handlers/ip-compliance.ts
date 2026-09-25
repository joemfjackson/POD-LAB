import { COMPLIANCE_DISCLAIMER, maxRisk, screenConcept, type ScreenIssue } from "@/domain/compliance-rules";
import { check, createGate, must, notify } from "../runtime/db-helpers";
import type { AgentHandler } from "../runtime/types";
import { complianceOutputSchema, compliancePayloadSchema, type ComplianceOutput, type CompliancePayload } from "../schemas";

interface ScreenedDesign {
  id: string;
  code: string;
  title: string;
  status: string;
  issues: ScreenIssue[];
}

export const ipComplianceHandler: AgentHandler<CompliancePayload, ComplianceOutput> = {
  key: "ip_compliance",
  payloadSchema: compliancePayloadSchema,
  outputSchema: complianceOutputSchema,

  async prepare(ctx, payload) {
    const { db, workspace } = ctx;
    let q = db
      .from("design_concepts")
      .select("id, code, title, concept, front_placement, back_placement, sleeve_placement, typography, illustration_notes, generation_prompt, status")
      .eq("workspace_id", workspace.id)
      .eq("brand_id", payload.brand_id);
    q = payload.design_ids?.length ? q.in("id", payload.design_ids) : q.in("compliance_status", ["not_reviewed", "pending"]);
    const designs = must(await q, "load designs");
    const screened: ScreenedDesign[] = designs.map((d) => ({
      id: d.id,
      code: d.code,
      title: d.title,
      status: d.status,
      issues: screenConcept({
        title: d.title,
        concept: d.concept,
        texts: [d.front_placement, d.back_placement, d.sleeve_placement, d.typography, d.illustration_notes, d.generation_prompt],
      }).issues,
    }));
    const input = {
      designs: designs.map((d, i) => ({
        code: d.code,
        title: d.title,
        concept: d.concept,
        placements: [d.front_placement, d.back_placement, d.sleeve_placement].filter(Boolean),
        rule_findings: screened[i]!.issues.map((x) => ({ category: x.category, term: x.matchedTerm, risk: x.riskLevel })),
      })),
    };
    const empty: ComplianceOutput = { assessments: screened.map((s) => ({ design_code: s.code, additional_issues: [] })) };
    return {
      input: { ...input, screened } as unknown as Record<string, unknown>,
      demo: () => empty,
      sources: [],
      researchMode: ctx.demoMode ? "demo" : "model_only",
      brandId: payload.brand_id,
      skipOutput: designs.length === 0 ? { assessments: [] } : undefined,
    };
  },

  async persist(ctx, payload, out, prepared) {
    const { db, workspace, job } = ctx;
    const screened = (prepared.input as unknown as { screened: ScreenedDesign[] }).screened;
    const extra = new Map(out.assessments.map((a) => [a.design_code, a.additional_issues]));
    let flagged = 0;
    let cleared = 0;

    for (const d of screened) {
      const aiIssues: ScreenIssue[] = (extra.get(d.code) ?? []).map((i) => ({
        category: i.category,
        detectedIssue: i.detected_issue,
        matchedTerm: "",
        riskLevel: i.risk_level,
        explanation: i.explanation,
        evidence: "Model screening (preliminary)",
        actionRequired: i.action_required,
      }));
      const issues = [...d.issues, ...aiIssues].filter((i) => i.riskLevel !== "none");
      const risk = maxRisk(issues.map((i) => i.riskLevel));
      const status = issues.length ? "flagged" : "clear";
      const review = must(
        await db
          .from("compliance_reviews")
          .insert({
            workspace_id: workspace.id,
            brand_id: payload.brand_id,
            subject_type: "design",
            subject_id: d.id,
            design_id: d.id,
            status,
            risk_level: risk,
            summary: issues.length ? `${issues.length} potential issue(s); highest risk ${risk}.` : "No obvious issues found by automated screening.",
            screening_method: ctx.demoMode ? "rules" : "rules_and_ai",
            agent_run_id: ctx.runId,
            disclaimer: COMPLIANCE_DISCLAIMER,
          })
          .select("id")
          .single(),
        "insert review",
      );
      if (issues.length) {
        check(
          await db.from("compliance_issues").insert(
            issues.map((i) => ({
              workspace_id: workspace.id,
              review_id: review.id,
              category: i.category,
              detected_issue: i.detectedIssue,
              matched_term: i.matchedTerm || null,
              risk_level: i.riskLevel,
              explanation: i.explanation,
              evidence: i.evidence,
              action_required: i.actionRequired,
            })),
          ),
          "insert issues",
        );
      }
      check(
        await db
          .from("design_concepts")
          .update({ compliance_status: status, ...(status === "clear" && d.status === "approved" ? { status: "production_ready" as const } : {}) })
          .eq("id", d.id),
        "update design compliance",
      );
      if (status === "flagged") {
        flagged++;
        await createGate(db, {
          workspaceId: workspace.id,
          gateType: "compliance_override",
          subjectType: "compliance_review",
          subjectId: review.id,
          brandId: payload.brand_id,
          jobId: job.id,
          title: `Compliance flag on ${d.code}: ${d.title}`,
          summary: `${issues.length} issue(s), highest risk ${risk}. Approve = override with notes; reject = send design to revision.`,
          payload: { design_id: d.id },
        });
        await notify(db, {
          workspaceId: workspace.id,
          type: "compliance_flag",
          title: `Compliance flag: ${d.code} ${d.title}`,
          body: issues.map((i) => i.detectedIssue).join("; ").slice(0, 400),
          link: `/design-studio/${d.id}`,
          brandId: payload.brand_id,
          severity: risk === "critical" || risk === "high" ? "critical" : "warning",
        });
      } else cleared++;
    }

    return {
      summary: `Screened ${screened.length} design(s): ${cleared} clear, ${flagged} flagged for human review`,
      waitingForApproval: flagged > 0,
      brandId: payload.brand_id,
    };
  },
};
