import { describe, expect, it } from "vitest";
import { autoMap, csvEscape, parseCsv, previewImport, toCsv } from "@/domain/csv";

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes, CRLF and embedded newlines", () => {
    const rows = parseCsv('a,b,c\r\n"x, y","He said ""hi""","line1\nline2"\r\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'He said "hi"', "line1\nline2"],
    ]);
  });

  it("strips BOM and skips blank lines", () => {
    expect(parseCsv("﻿a,b\n\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("throws on unterminated quotes", () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/unterminated/);
  });

  it("escapes values and neutralises formula injection", () => {
    expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvEscape('a,"b"')).toBe('"a,""b"""');
    expect(toCsv(["x"], [{ x: 1 }])).toBe("x\n1");
  });
});

describe("CSV import preview", () => {
  it("auto-maps aliases", () => {
    const m = autoMap("orders", ["Order ID", "Date", "Qty", "Subtotal"]);
    expect(m).toEqual({ external_order_id: 0, order_date: 1, quantity: 2, revenue: 3 });
  });

  it("validates catalog rows and reports errors per row", () => {
    const csv = [
      "sku,name,type,cost,colors,sizes,shipping",
      "BC3001,Bella+Canvas 3001,T-Shirt,$5.50,Black|White,S|M|L,4.75",
      "G185,Gildan Hoodie,hoodie,-3,,,",
      "X1,Mystery,spaceship,2,,,",
    ].join("\n");
    const p = previewImport("fulfillment_catalog", csv);
    expect(p.missingRequired).toEqual([]);
    expect(p.totalRows).toBe(3);
    expect(p.valid).toHaveLength(1);
    const first = p.valid[0]!.data;
    expect(first.product_type).toBe("tee");
    expect(first.blank_cost).toBe(5.5);
    expect(first.available_colors).toEqual(["Black", "White"]);
    expect(first.shipping_estimate_domestic).toBe(4.75);
    expect(p.errors.map((e) => e.row)).toEqual([3, 4]);
  });

  it("reports missing required columns", () => {
    const p = previewImport("orders", "foo,bar\n1,2");
    expect(p.missingRequired).toContain("external_order_id");
    expect(p.valid).toHaveLength(0);
  });

  it("validates experiment metric rows", () => {
    const p = previewImport("experiment_metrics", "variant,date,sessions,orders,revenue\na,2026-09-01,120,3,96\nZZ,2026-09-01,1,0,0\nB,09/01/2026,1,0,0");
    expect(p.valid).toHaveLength(1);
    expect(p.valid[0]!.data).toMatchObject({ variant_key: "A", sessions: 120, purchases: 3, gross_revenue: 96 });
    expect(p.errors).toHaveLength(2);
  });
});
