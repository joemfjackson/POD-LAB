import { beforeAll, describe, expect, it } from "vitest";
import { commitImport } from "@/server/services/imports";
import { createTestUser, createWorkspace, supabaseAvailable, type TestUser } from "../support/supabase";

const available = await supabaseAvailable();

describe.skipIf(!available)("CSV imports, financial model & search", () => {
  let owner: TestUser;
  let workspaceId: string;
  let brandId: string;
  let experimentId: string;

  beforeAll(async () => {
    owner = await createTestUser("imp-owner");
    workspaceId = (await createWorkspace(owner, "Import Lab")).id;
    const b = await owner.client.from("brands").insert({ workspace_id: workspaceId, working_title: "Nurse Supply", niche: "nurses" }).select("id").single();
    brandId = b.data!.id;
    const e = await owner.client.from("experiments").insert({ workspace_id: workspaceId, brand_id: brandId, name: "Price test", experiment_type: "price", hypothesis: "Premium price holds conversion", primary_metric: "contribution_profit" }).select("id").single();
    experimentId = e.data!.id;
    const v = await owner.client.from("experiment_variants").insert([
      { workspace_id: workspaceId, experiment_id: experimentId, key: "A", name: "Standard", is_control: true },
      { workspace_id: workspaceId, experiment_id: experimentId, key: "B", name: "Premium", is_control: false },
    ]);
    if (v.error) throw new Error(v.error.message);
  });

  it("imports a catalog, skipping invalid rows and recording them", async () => {
    const csv = ["sku,name,type,cost,colors,sizes,shipping", "BC3001,Bella+Canvas 3001,tee,5.50,Black|White,S|M|L,4.75", "BAD,Broken,spaceship,x,,,"].join("\n");
    const r = await commitImport(owner.client, { workspaceId, userId: owner.id, kind: "fulfillment_catalog", filename: "catalog.csv", csv, target: {} });
    expect(r.imported).toBe(1);
    expect(r.errors.map((e) => e.row)).toContain(3);
    const p = await owner.client.from("provider_products").select("blank_name, source, available_sizes").eq("provider_sku", "BC3001").single();
    expect(p.data).toMatchObject({ source: "csv", available_sizes: ["S", "M", "L"] });
    const batch = await owner.client.from("import_batches").select("status, imported_rows, error_rows").eq("id", r.batchId).single();
    expect(batch.data).toEqual({ status: "partial", imported_rows: 1, error_rows: 1 });
  });

  it("imports orders idempotently and rebuilds the financial model", async () => {
    const csv = [
      "order id,date,sku,qty,subtotal,discount,shipping,cost,print cost,fulfillment,shipping cost,payment fees,ad spend,refunds",
      "1001,2026-09-01,TEE,1,32,0,4.99,6,4,1.5,4.75,1.37,8,0",
      "1002,2026-09-01,TEE,2,64,6.4,0,12,8,3,6.75,2.2,0,0",
      "1003,2026-09-02,TEE,1,32,0,4.99,6,4,1.5,4.75,1.37,0,32",
    ].join("\n");
    const first = await commitImport(owner.client, { workspaceId, userId: owner.id, kind: "orders", filename: "orders.csv", csv, target: { brandId } });
    expect(first.imported).toBe(3);
    await commitImport(owner.client, { workspaceId, userId: owner.id, kind: "orders", filename: "orders.csv", csv, target: { brandId } });
    const orders = await owner.client.from("orders_import").select("id").eq("brand_id", brandId);
    expect(orders.data).toHaveLength(3);
    const fin = await owner.client.from("financial_metrics").select("metric_date, orders, net_sales, gross_profit, refunds").eq("brand_id", brandId).order("metric_date");
    expect(fin.data).toHaveLength(2);
    expect(fin.data![0]).toMatchObject({ metric_date: "2026-09-01", orders: 2 });
    expect(Number(fin.data![0]!.net_sales)).toBeCloseTo(89.6, 2);
    expect(Number(fin.data![1]!.refunds)).toBe(32);
  });

  it("requires a brand for orders and rejects unknown variants for metrics", async () => {
    await expect(commitImport(owner.client, { workspaceId, userId: owner.id, kind: "orders", filename: "o.csv", csv: "order id,date,qty,subtotal\n1,2026-09-01,1,10", target: {} })).rejects.toThrow(/brand/);
    const csv = "variant,date,sessions,orders,revenue\nA,2026-09-01,100,3,96\nZ,2026-09-01,100,1,32\nB,2026-09-01,110,4,140";
    const r = await commitImport(owner.client, { workspaceId, userId: owner.id, kind: "experiment_metrics", filename: "m.csv", csv, target: { experimentId } });
    expect(r.imported).toBe(2);
    expect(r.errors[0]).toMatchObject({ row: 3, field: "variant_key" });
  });

  it("searches across entities with RLS applied", async () => {
    const res = await owner.client.rpc("search_workspace", { p_workspace: workspaceId, p_query: "nurse" });
    expect(res.data?.map((r) => r.kind)).toContain("brand");
    const outsider = await createTestUser("imp-outsider");
    const denied = await outsider.client.rpc("search_workspace", { p_workspace: workspaceId, p_query: "nurse" });
    expect(denied.data).toEqual([]);
  });
});
