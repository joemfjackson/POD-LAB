import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEE_MODEL,
  charmPrice,
  orderEconomics,
  priceForGrossMargin,
  quantityDiscountPct,
  recommendProduct,
  unitEconomics,
  type CostInputs,
} from "@/domain/finance";

const tee: CostInputs = { blankCost: 5.5, decorationCost: 4, fulfillmentFee: 1.5, shippingCost: 4.75 };

describe("unit economics", () => {
  it("computes gross and contribution profit for a single item", () => {
    const e = unitEconomics(tee, 32, DEFAULT_FEE_MODEL);
    expect(e.netRevenue).toBe(32);
    expect(e.shippingCharged).toBe(4.99);
    expect(e.shippingSubsidy).toBe(0);
    expect(e.cogs).toBe(11);
    expect(e.grossProfit).toBe(21);
    expect(e.grossMargin).toBe(0.6563);
    expect(e.paymentProcessing).toBe(1.37);
    expect(e.refundReserve).toBe(0.96);
    expect(e.contributionBeforeMarketing).toBe(18.67);
    expect(e.breakEvenCac).toBe(18.67);
    expect(e.contributionProfit).toBe(18.67);
    expect(e.contributionMargin).toBe(0.5834);
  });

  it("subtracts CAC from contribution profit", () => {
    const e = unitEconomics(tee, 32, DEFAULT_FEE_MODEL, { cac: 20 });
    expect(e.contributionProfit).toBe(-1.33);
    expect(e.cac).toBe(20);
    expect(e.totalContributionCost).toBe(33.33);
  });

  it("applies free-shipping thresholds as a shipping subsidy", () => {
    const e = unitEconomics(tee, 32, { ...DEFAULT_FEE_MODEL, freeShippingThreshold: 30 });
    expect(e.shippingCharged).toBe(0);
    expect(e.shippingSubsidy).toBe(4.75);
    expect(e.cogs).toBe(15.75);
    expect(e.grossProfit).toBe(16.25);
    expect(e.paymentProcessing).toBe(1.23);
  });

  it("applies quantity discounts and additional-item shipping", () => {
    const model = { ...DEFAULT_FEE_MODEL, quantityDiscounts: [{ minQuantity: 2, percentOff: 0.1 }, { minQuantity: 3, percentOff: 0.15 }] };
    expect(quantityDiscountPct(model, 1)).toBe(0);
    expect(quantityDiscountPct(model, 2)).toBe(0.1);
    expect(quantityDiscountPct(model, 5)).toBe(0.15);
    const e = orderEconomics([{ costs: { ...tee, additionalItemShippingCost: 2 }, unitPrice: 32, quantity: 2 }], model);
    expect(e.listSubtotal).toBe(64);
    expect(e.discount).toBe(6.4);
    expect(e.netRevenue).toBe(57.6);
    expect(e.shippingCost).toBe(6.75);
  });

  it("prices bundles from the bundle price", () => {
    const e = orderEconomics(
      [
        { costs: tee, unitPrice: 32, quantity: 1 },
        { costs: { blankCost: 9, decorationCost: 6, fulfillmentFee: 1.5, shippingCost: 6 }, unitPrice: 30, quantity: 1 },
      ],
      DEFAULT_FEE_MODEL,
      { bundlePrice: 55 },
    );
    expect(e.discount).toBe(7);
    expect(e.netRevenue).toBe(55);
    expect(e.units).toBe(2);
  });

  it("rejects invalid inputs", () => {
    expect(() => unitEconomics({ ...tee, blankCost: -1 }, 20, DEFAULT_FEE_MODEL)).toThrow();
    expect(() => orderEconomics([], DEFAULT_FEE_MODEL)).toThrow();
    expect(() => orderEconomics([{ costs: tee, unitPrice: 10, quantity: 0 }], DEFAULT_FEE_MODEL)).toThrow();
  });

  it("finds charm prices that meet a gross margin", () => {
    expect(charmPrice(31.2)).toBe(31.99);
    expect(charmPrice(30)).toBe(30.99);
    const p = priceForGrossMargin(tee, DEFAULT_FEE_MODEL, 0.4);
    expect(p).toBe(18.99);
    expect(unitEconomics(tee, p, DEFAULT_FEE_MODEL).grossMargin!).toBeGreaterThanOrEqual(0.4);
  });
});

describe("product recommendation", () => {
  it("launches healthy products", () => {
    const r = recommendProduct(tee, 32, DEFAULT_FEE_MODEL, { cac: 5 });
    expect(r.recommendation).toBe("launch");
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it("avoids products that lose money and cannot be repriced", () => {
    expect(recommendProduct(tee, 12, DEFAULT_FEE_MODEL).recommendation).toBe("avoid");
  });

  it("recommends premium-only pricing when a modest increase fixes margin", () => {
    const r = recommendProduct(tee, 17.99, DEFAULT_FEE_MODEL);
    expect(r.recommendation).toBe("premium_only");
    expect(r.suggestedPrice).toBe(18.99);
  });

  it("recommends bundles when single units cannot absorb CAC", () => {
    expect(recommendProduct(tee, 32, DEFAULT_FEE_MODEL, { cac: 20 }).recommendation).toBe("bundle_only");
  });

  it("recommends upsell when even bundles cannot absorb CAC", () => {
    expect(recommendProduct(tee, 32, DEFAULT_FEE_MODEL, { cac: 40 }).recommendation).toBe("upsell");
  });

  it("recommends testing when contribution is positive but below target", () => {
    expect(recommendProduct(tee, 32, DEFAULT_FEE_MODEL, { cac: 12 }).recommendation).toBe("test");
  });
});
