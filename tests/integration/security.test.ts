import { beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { BRAND_STAGES, transitionKind } from "@/domain/lifecycle";
import { gateMinRole } from "@/domain/permissions";
import { DB_URL, addMember, admin, createTestUser, createWorkspace, supabaseAvailable, type TestUser } from "../support/supabase";

const available = await supabaseAvailable();

describe.skipIf(!available)("database security & invariants", () => {
  let owner: TestUser;
  let outsider: TestUser;
  let viewer: TestUser;
  let workspaceId: string;

  beforeAll(async () => {
    owner = await createTestUser("owner");
    outsider = await createTestUser("outsider");
    viewer = await createTestUser("viewer");
    workspaceId = (await createWorkspace(owner)).id;
    await addMember(workspaceId, viewer.id, "viewer");
  });

  it("keeps the SQL lifecycle identical to the TypeScript lifecycle", async () => {
    const pg = new Client({ connectionString: DB_URL });
    await pg.connect();
    try {
      const { rows } = await pg.query<{ f: string; t: string; kind: string }>(
        "select f::text as f, t::text as t, public.brand_stage_transition_kind(f, t) as kind from unnest(enum_range(null::public.brand_stage)) f, unnest(enum_range(null::public.brand_stage)) t",
      );
      expect(rows).toHaveLength(BRAND_STAGES.length ** 2);
      const mismatches = rows.filter((r) => transitionKind(r.f as never, r.t as never) !== r.kind);
      expect(mismatches).toEqual([]);

      const gates = await pg.query<{ g: string; role: string }>("select g::text as g, public.gate_min_role(g)::text as role from unnest(enum_range(null::public.approval_gate_type)) g");
      for (const r of gates.rows) expect(gateMinRole(r.g as never)).toBe(r.role);
    } finally {
      await pg.end();
    }
  });

  it("assigns sequential human-readable codes per workspace", async () => {
    const a = await owner.client.from("brands").insert({ workspace_id: workspaceId, working_title: "Alpha", niche: "alpha" }).select("code").single();
    const b = await owner.client.from("brands").insert({ workspace_id: workspaceId, working_title: "Beta", niche: "beta" }).select("code").single();
    expect(a.error).toBeNull();
    expect(a.data?.code).toBe("PL-0001");
    expect(b.data?.code).toBe("PL-0002");
    const pg = new Client({ connectionString: DB_URL });
    await pg.connect();
    const { rows } = await pg.query("select public.format_code('PL', 12345) as c, public.format_code('OPP', 7) as d");
    await pg.end();
    expect(rows[0]).toEqual({ c: "PL-12345", d: "OPP-0007" });
  });

  it("isolates workspaces with RLS", async () => {
    const res = await outsider.client.from("brands").select("id").eq("workspace_id", workspaceId);
    expect(res.data).toEqual([]);
    const insert = await outsider.client.from("brands").insert({ workspace_id: workspaceId, working_title: "Intrusion", niche: "x" });
    expect(insert.error).not.toBeNull();
  });

  it("lets viewers read but not write", async () => {
    const read = await viewer.client.from("brands").select("id").eq("workspace_id", workspaceId);
    expect(read.data?.length).toBeGreaterThan(0);
    const write = await viewer.client.from("brands").insert({ workspace_id: workspaceId, working_title: "Nope", niche: "x" });
    expect(write.error).not.toBeNull();
  });

  it("blocks gated stage transitions outside an approval decision", async () => {
    const brand = await owner.client.from("brands").insert({ workspace_id: workspaceId, working_title: "Gate test", niche: "gate", stage: "researching" }).select("id").single();
    const toCandidate = await owner.client.from("brands").update({ stage: "candidate" }).eq("id", brand.data!.id);
    expect(toCandidate.error).toBeNull();
    const toApproved = await owner.client.from("brands").update({ stage: "approved" }).eq("id", brand.data!.id);
    expect(toApproved.error?.message).toMatch(/requires an approved gate/);
    const skip = await admin().from("brands").update({ stage: "testing" }).eq("id", brand.data!.id);
    expect(skip.error?.message).toMatch(/Invalid brand stage transition/);
  });

  it("prevents approving gated values directly, even with the service role", async () => {
    const brand = await owner.client.from("brands").insert({ workspace_id: workspaceId, working_title: "Guard test", niche: "guard" }).select("id").single();
    const name = await owner.client.from("brand_names").insert({ workspace_id: workspaceId, brand_id: brand.data!.id, name: "GUARD" }).select("id").single();
    const direct = await owner.client.from("brand_names").update({ status: "final" }).eq("id", name.data!.id);
    expect(direct.error?.message).toMatch(/requires human approval/);
    const svc = await admin().from("brand_names").update({ status: "final" }).eq("id", name.data!.id);
    expect(svc.error?.message).toMatch(/requires human approval/);
    const paid = await owner.client.from("campaigns").insert({ workspace_id: workspaceId, brand_id: brand.data!.id, name: "Paid", platform: "instagram", is_paid: true, status: "approved", approved_budget_usd: 1000 });
    expect(paid.error).not.toBeNull();
  });

  it("only lets authorised humans decide gates", async () => {
    const brand = await owner.client.from("brands").insert({ workspace_id: workspaceId, working_title: "Decide test", niche: "decide" }).select("id").single();
    const gate = await owner.client
      .from("approval_gates")
      .insert({ workspace_id: workspaceId, gate_type: "destructive_action", subject_type: "brand", subject_id: brand.data!.id, title: "Archive", payload: { action: "archive_brand" }, requested_by: owner.id, requested_by_actor: "human" })
      .select("id")
      .single();
    expect(gate.error).toBeNull();
    const byViewer = await viewer.client.rpc("decide_approval_gate", { p_gate_id: gate.data!.id, p_decision: "approved" });
    expect(byViewer.error).not.toBeNull();
    const byService = await admin().rpc("decide_approval_gate", { p_gate_id: gate.data!.id, p_decision: "approved" });
    expect(byService.error?.message).toMatch(/authenticated human/);
    const noReason = await owner.client.rpc("decide_approval_gate", { p_gate_id: gate.data!.id, p_decision: "rejected" });
    expect(noReason.error?.message).toMatch(/reason is required/);
    const ok = await owner.client.rpc("decide_approval_gate", { p_gate_id: gate.data!.id, p_decision: "approved", p_reason: "cleanup" });
    expect(ok.error).toBeNull();
    const b = await owner.client.from("brands").select("stage").eq("id", brand.data!.id).single();
    expect(b.data?.stage).toBe("archived");
    const again = await owner.client.rpc("decide_approval_gate", { p_gate_id: gate.data!.id, p_decision: "approved" });
    expect(again.error?.message).toMatch(/already/);
  });

  it("never exposes provider credentials to clients", async () => {
    await admin().from("provider_credentials").insert({ workspace_id: workspaceId, provider_kind: "ai", provider_key: "openai_compatible", label: "k", ciphertext: "v1.x.y.z" });
    const read = await owner.client.from("provider_credentials").select("*");
    expect(read.data).toEqual([]);
  });

  it("rate-limits per user and bucket", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await owner.client.rpc("consume_rate_limit", { bucket: `test-${workspaceId}`, max_hits: 3, window_seconds: 60 });
      results.push(r.data === true);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
