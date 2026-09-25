import { describe, expect, it } from "vitest";
import { aggregateDaily, orderFinancials, rangeStart, ratios, sumLines, type OrderRow } from "@/domain/financial-model";

const order = (o: Partial<OrderRow>): OrderRow => ({
  orderDate: "2026-09-01",
  quantity: 1,
  revenue: 40,
  discount: 0,
  shippingPaid: 5,
  cogs: 8,
  decorationCost: 5,
  fulfillmentFee: 2,
  shippingCost: 6,
  paymentProcessing: 1.6,
  platformFee: 0,
  adAttribution: 10,
  refunds: 0,
  ...o,
});

describe("financial model", () => {
  it("separates gross profit from contribution profit", () => {
    const f = orderFinancials(order({}), 0.05);
    expect(f.netSales).toBe(40);
    expect(f.shippingSubsidy).toBe(1);
    expect(f.grossProfit).toBe(24); // 40 − (8 + 5 + 2 + 1)
    expect(f.refundReserve).toBe(2);
    expect(f.contributionProfit).toBe(10.4); // 24 − 1.6 − 0 − 2 − 10
  });

  it("uses actual refunds instead of a reserve when a refund exists", () => {
    const f = orderFinancials(order({ refunds: 40 }), 0.05);
    expect(f.refundReserve).toBe(0);
    expect(f.grossProfit).toBe(-16);
  });

  it("aggregates by day and computes ratios", () => {
    const daily = aggregateDaily(
      [order({ orderDate: "2026-09-02" }), order({}), order({ discount: 10 })],
      0,
    );
    expect(daily.map((d) => d.date)).toEqual(["2026-09-01", "2026-09-02"]);
    expect(daily[0]!.orders).toBe(2);
    const total = sumLines(daily);
    expect(total.orders).toBe(3);
    expect(total.netSales).toBe(110);
    const r = ratios(total);
    expect(r.aov).toBeCloseTo(36.67, 2);
    expect(r.roas).toBeCloseTo(110 / 30, 5);
    expect(r.cac).toBe(10);
  });

  it("computes report range starts", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    expect(rangeStart("7d", now)).toBe("2026-09-19");
    expect(rangeStart("30d", now)).toBe("2026-08-27");
    expect(rangeStart("all", now)).toBeNull();
  });
});
