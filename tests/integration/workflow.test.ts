import { beforeAll, describe, expect, it } from "vitest";
import { processJob } from "@/agents/runtime/runner";
import { createMission, requestAgentRun } from "@/server/services/agents";
import { decideGate, requestGate } from "@/server/services/approvals";
import { transitionBrand, recordBrandDecision } from "@/server/services/brands";
import { loadMockCatalog } from "@/server/services/workspace";
import { seedDemoMetrics } from "@/server/seed/walkthrough";
import { buildStorePackage } from "@/server/services/exports";
import { admin, createTestUser, createWorkspace, supabaseAvailable, type TestUser } from "../support/supabase";

const available = await supabaseAvailable();

describe.skipIf(!available)("agent workflows (demo provider, local Supabase)", () => {
  let owner: TestUser;
  let workspaceId: string;
  let brandId: string;
  const a = admin();

  async function run(agentKey: Parameters<typeof requestAgentRun>[1]["agentKey"], payload: Record<string, unknown>) {
    const { job } = await requestAgentRun(a, { workspaceId, userId: owner.id, agentKey, payload, brandId: (payload.brand_id as string) ?? null });
    const result = await processJob(a, { jobId: job.id });
    expect(result?.error ?? null).toBeNull();
    return { job, result: result! };
  }

  async function drain() {
    for (;;) {
      const r = await processJob(a, { workspaceId });
      if (!r) break;
      expect(r.error).toBeNull();
    }
  }

  async function approveAll(gateType: string) {
    const gates = await owner.client.from("approval_gates").select("id").eq("workspace_id", workspaceId).eq("gate_type", gateType as never).eq("status", "pending");
    for (const g of gates.data ?? []) await decideGate(owner.client, a, { gateId: g.id, decision: "approved", reason: "test approval", role: "owner" });
    return gates.data?.length ?? 0;
  }

  beforeAll(async () => {
    owner = await createTestUser("wf-owner");
    workspaceId = (await createWorkspace(owner, "Workflow Lab")).id;
    await loadMockCatalog(a, workspaceId);
  });

  it("Opportunity Scout: mission → structured, labelled research", async () => {
    const { mission, job } = await createMission(owner.client, a, {
      workspaceId,
      userId: owner.id,
      title: "Research 5 HVAC niches",
      prompt: "Research 5 HVAC-related niches",
      missionType: "discover",
      maxCandidates: 5,
      researchDepth: 1,
    });
    const r = await processJob(a, { jobId: job.id });
    expect(r?.status).toBe("completed");
    const opps = await owner.client.from("opportunities").select("id, code, status, research_mode, confidence, is_demo").eq("mission_id", mission.id);
    expect(opps.data).toHaveLength(5);
    for (const o of opps.data!) {
      expect(o.status).toBe("candidate");
      expect(o.research_mode).toBe("demo");
      expect(o.confidence).toBe("low");
      expect(o.is_demo).toBe(true);
    }
    const scores = await owner.client.from("opportunity_scores").select("dimension").eq("opportunity_id", opps.data![0]!.id);
    expect(scores.data).toHaveLength(10);
    const sources = await owner.client.from("research_sources").select("evidence_kind, source_url").eq("opportunity_id", opps.data![0]!.id);
    expect(sources.data!.every((s) => s.evidence_kind === "assumption" && s.source_url === null)).toBe(true);
    const m = await owner.client.from("research_missions").select("status, opportunities_found").eq("id", mission.id).single();
    expect(m.data).toEqual({ status: "completed", opportunities_found: 5 });
    const run = await owner.client.from("agent_runs").select("status, provider, prompt_version, schema_version").eq("job_id", job.id).single();
    expect(run.data).toMatchObject({ status: "succeeded", provider: "demo", prompt_version: "opportunity_scout_v1" });
  });

  it("prevents duplicate research of the same niches", async () => {
    const { job } = await createMission(owner.client, a, { workspaceId, userId: owner.id, title: "Again", prompt: "Find 5 HVAC related niches", missionType: "discover", maxCandidates: 5, researchDepth: 1 });
    const r = await processJob(a, { jobId: job.id });
    expect(r?.summary).toMatch(/Generated 0 opportunities \(5 duplicates skipped\)/);
  });

  it("deduplicates identical queued jobs", async () => {
    const payload = { period: "daily" };
    const first = await requestAgentRun(a, { workspaceId, userId: owner.id, agentKey: "director", payload });
    const second = await requestAgentRun(a, { workspaceId, userId: owner.id, agentKey: "director", payload });
    expect(second.deduplicated).toBe(true);
    expect(second.job.id).toBe(first.job.id);
    const r = await processJob(a, { jobId: first.job.id });
    expect(r?.status).toBe("completed");
  });

  it("approval → automatic Brand Record", async () => {
    const opp = await owner.client.from("opportunities").select("id, code, niche").eq("workspace_id", workspaceId).eq("status", "candidate").limit(1).single();
    const gate = await requestGate(owner.client, { workspaceId, userId: owner.id, gateType: "opportunity_approval", subjectType: "opportunity", subjectId: opp.data!.id, brandId: null, title: `Approve ${opp.data!.code}` });
    const decided = await decideGate(owner.client, a, { gateId: gate.id, decision: "approved", reason: "Strong identity", role: "owner" });
    expect(decided.brand_id).toBeTruthy();
    brandId = decided.brand_id!;
    const brand = await owner.client.from("brands").select("code, stage, opportunity_id, niche").eq("id", brandId).single();
    expect(brand.data).toMatchObject({ stage: "approved", opportunity_id: opp.data!.id, niche: opp.data!.niche });
    expect(brand.data!.code).toMatch(/^PL-\d{4}$/);
    const o = await owner.client.from("opportunities").select("status, brand_id").eq("id", opp.data!.id).single();
    expect(o.data).toEqual({ status: "approved", brand_id: brandId });
    const history = await owner.client.from("brand_stage_history").select("to_stage").eq("brand_id", brandId);
    expect(history.data?.map((h) => h.to_stage)).toContain("approved");
    const audit = await owner.client.from("audit_log").select("summary").eq("action", "approval.approved").eq("subject_id", opp.data!.id);
    expect(audit.data?.[0]?.summary).toMatch(/approved/);
  });

  it("Brand Architect: names, domains, handles and identity awaiting approval", async () => {
    const { result } = await run("brand_architect", { brand_id: brandId, name_count: 8 });
    expect(result.status).toBe("waiting_for_approval");
    const names = await owner.client.from("brand_names").select("status, trademark_notes").eq("brand_id", brandId);
    expect(names.data!.length).toBeGreaterThanOrEqual(8);
    expect(names.data!.every((n) => n.trademark_notes?.startsWith("PRELIMINARY"))).toBe(true);
    const domains = await owner.client.from("domains").select("availability").eq("brand_id", brandId);
    expect(domains.data!.length).toBeGreaterThan(0);
    expect(domains.data!.every((d) => d.availability === "unverified")).toBe(true);
    const handles = await owner.client.from("social_handles").select("id").eq("brand_id", brandId);
    expect(handles.data!.length).toBeGreaterThan(0);
    const identity = await owner.client.from("brand_identity").select("id, status").eq("brand_id", brandId).single();
    expect(identity.data!.status).toBe("pending_approval");
    const brand = await owner.client.from("brands").select("stage").eq("id", brandId).single();
    expect(brand.data!.stage).toBe("branding");
    // cannot shortcut the gate
    const direct = await owner.client.from("brand_identity").update({ status: "final" }).eq("id", identity.data!.id);
    expect(direct.error).not.toBeNull();
    expect(await approveAll("brand_identity_final")).toBe(1);
    const after = await owner.client.from("brands").select("stage, positioning").eq("id", brandId).single();
    expect(after.data!.stage).toBe("creative");
    expect(after.data!.positioning).toBeTruthy();
    const job = await owner.client.from("agent_jobs").select("status").eq("agent_key", "brand_architect").eq("brand_id", brandId).single();
    expect(job.data!.status).toBe("completed");
  });

  it("Creative Director: collections, designs and automatic compliance screening", async () => {
    await run("creative_director", { brand_id: brandId, mode: "full", design_count: 6 });
    await drain(); // chained IP / Compliance job
    const designs = await owner.client.from("design_concepts").select("id, code, status, compliance_status, generation_prompt").eq("brand_id", brandId);
    expect(designs.data!.length).toBe(6);
    expect(designs.data!.every((d) => d.status === "review" && d.compliance_status === "clear" && d.generation_prompt)).toBe(true);
    const collections = await owner.client.from("collections").select("id").eq("brand_id", brandId);
    expect(collections.data!.length).toBeGreaterThan(0);
    const identity = await owner.client.from("brand_identity").select("visual_directions").eq("brand_id", brandId).eq("status", "final").single();
    expect((identity.data!.visual_directions as unknown[]).length).toBe(3);

    // manual production-ready is blocked; the gate works
    const d0 = designs.data![0]!;
    const blocked = await owner.client.from("design_concepts").update({ status: "production_ready" }).eq("id", d0.id);
    expect(blocked.error).not.toBeNull();
    for (const d of designs.data!) {
      const g = await requestGate(owner.client, { workspaceId, userId: owner.id, gateType: "design_production", subjectType: "design", subjectId: d.id, brandId, title: `Produce ${d.code}` });
      await decideGate(owner.client, a, { gateId: g.id, decision: "approved", reason: "ok", role: "owner" });
    }
    const ready = await owner.client.from("design_concepts").select("status").eq("brand_id", brandId).eq("status", "production_ready");
    expect(ready.data).toHaveLength(6);
  });

  it("IP / Compliance flags obvious IP problems and requires a human override", async () => {
    const d = await owner.client
      .from("design_concepts")
      .insert({ workspace_id: workspaceId, brand_id: brandId, title: "Mickey Mouse HVAC Crew", concept: "Official merch style", status: "review", compliance_status: "pending" })
      .select("id")
      .single();
    const { result } = await run("ip_compliance", { brand_id: brandId, design_ids: [d.data!.id] });
    expect(result.status).toBe("waiting_for_approval");
    const review = await owner.client.from("compliance_reviews").select("id, status, risk_level, disclaimer").eq("design_id", d.data!.id).single();
    expect(review.data).toMatchObject({ status: "flagged", risk_level: "high" });
    expect(review.data!.disclaimer).toMatch(/not legal advice/);
    const issues = await owner.client.from("compliance_issues").select("category").eq("review_id", review.data!.id);
    expect(issues.data!.map((i) => i.category)).toEqual(expect.arrayContaining(["copyrighted_character", "brand_confusion"]));
    const gate = await owner.client.from("approval_gates").select("id").eq("subject_id", review.data!.id).single();
    await decideGate(owner.client, a, { gateId: gate.data!.id, decision: "rejected", reason: "Remove the character", role: "owner" });
    const after = await owner.client.from("design_concepts").select("status, compliance_status").eq("id", d.data!.id).single();
    expect(after.data).toEqual({ status: "revision", compliance_status: "rejected" });
  });

  it("Product & Profit: deterministic economics and assortment approval", async () => {
    const { result } = await run("product_profit", { brand_id: brandId, max_products: 6 });
    expect(result.status).toBe("waiting_for_approval");
    const products = await owner.client.from("brand_products").select("status, recommendation, economics, retail_price").eq("brand_id", brandId);
    expect(products.data!.length).toBeGreaterThan(0);
    for (const p of products.data!) {
      const unit = (p.economics as { unit: { grossProfit: number; contributionBeforeMarketing: number } }).unit;
      expect(unit.grossProfit).toBeGreaterThan(0);
      expect(["launch", "test", "premium_only", "bundle_only", "upsell", "avoid"]).toContain(p.recommendation);
    }
    expect(await approveAll("product_assortment")).toBe(1);
    const brand = await owner.client.from("brands").select("stage").eq("id", brandId).single();
    expect(brand.data!.stage).toBe("store_build");
  });

  it("Store Builder: full store package, launch approval and export", async () => {
    await run("store_builder", { brand_id: brandId });
    const store = await owner.client.from("stores").select("id, status, theme").eq("brand_id", brandId).single();
    expect(store.data!.status).toBe("generated");
    const pages = await owner.client.from("store_pages").select("page_type").eq("store_id", store.data!.id);
    expect(pages.data!.map((p) => p.page_type).sort()).toEqual(["about", "contact", "faq", "home", "privacy", "returns", "shipping", "size_guide", "terms"]);
    const sp = await owner.client.from("store_products").select("id").eq("store_id", store.data!.id);
    expect(sp.data!.length).toBeGreaterThan(0);
    expect(await approveAll("store_launch")).toBe(1);
    const brand = await owner.client.from("brands").select("stage").eq("id", brandId).single();
    expect(brand.data!.stage).toBe("launch_ready");
    const pkg = await buildStorePackage(owner.client, store.data!.id);
    expect(pkg.format).toBe("pod-lab.store-package");
    expect(pkg.products.length).toBe(sp.data!.length);
    expect(pkg.pages.length).toBe(9);
    expect(pkg.isDemo).toBe(true);
  });

  it("Growth → experiment → Analyst decision with reasons", async () => {
    const { result } = await run("growth", { brand_id: brandId });
    expect(result.status).toBe("waiting_for_approval"); // paid proposal awaits spend approval
    const paid = await owner.client.from("campaigns").select("status, approved_budget_usd").eq("brand_id", brandId).eq("is_paid", true);
    expect(paid.data!.every((c) => c.status === "pending_approval" && c.approved_budget_usd === null)).toBe(true);
    const content = await owner.client.from("content_items").select("id").eq("brand_id", brandId);
    expect(content.data!.length).toBeGreaterThan(10);

    const exp = await owner.client.from("experiments").select("id").eq("brand_id", brandId).order("created_at").limit(1).single();
    await owner.client.from("experiments").update({ status: "running", start_date: new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10) }).eq("id", exp.data!.id);
    await transitionBrand(owner.client, { brandId, to: "testing", reason: "Experiment live", userId: owner.id });

    // insufficient data first
    await run("experiment_analyst", { brand_id: brandId });
    let e = await owner.client.from("experiments").select("decision, decision_reasons").eq("id", exp.data!.id).single();
    expect(e.data!.decision).toBe("insufficient_data");

    await seedDemoMetrics(a, exp.data!.id, 14);
    await run("experiment_analyst", { brand_id: brandId });
    e = await owner.client.from("experiments").select("decision, decision_reasons, winning_variant_id").eq("id", exp.data!.id).single();
    expect(e.data!.decision).not.toBe("insufficient_data");
    expect((e.data!.decision_reasons as string[]).length).toBeGreaterThan(0);
    const notif = await owner.client.from("notifications").select("type").eq("workspace_id", workspaceId).eq("type", "experiment_threshold");
    expect(notif.data!.length).toBe(1);
  });

  it("records human portfolio decisions (clone, kill)", async () => {
    const clone = await recordBrandDecision(owner.client, { brandId, decision: "clone", reason: "Test sub-niche variant", userId: owner.id });
    expect(clone.newBrandId).toBeTruthy();
    const kill = await recordBrandDecision(owner.client, { brandId: clone.newBrandId!, decision: "kill", reason: "Not pursuing", userId: owner.id });
    expect(kill).toEqual({});
    const killed = await owner.client.from("brands").select("stage").eq("id", clone.newBrandId!).single();
    expect(killed.data!.stage).toBe("killed");
  });

  it("logs complete agent history", async () => {
    const runs = await owner.client.from("agent_runs").select("agent_key, status").eq("workspace_id", workspaceId);
    const agents = new Set(runs.data!.map((r) => r.agent_key));
    for (const k of ["opportunity_scout", "brand_architect", "creative_director", "ip_compliance", "product_profit", "store_builder", "growth", "experiment_analyst", "director"]) {
      expect(agents).toContain(k);
    }
    expect(runs.data!.every((r) => r.status === "succeeded")).toBe(true);
    const outputs = await owner.client.from("agent_outputs").select("id").eq("workspace_id", workspaceId);
    expect(outputs.data!.length).toBe(runs.data!.length);
  });
});
