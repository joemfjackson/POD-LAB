/**
 * Unit economics for print-on-demand products.
 *
 * Definitions (kept deliberately explicit — gross profit is NOT net income):
 *   net revenue        = merchandise price actually charged (after discounts)
 *   COGS               = blank + decoration + provider fulfillment fee + shipping subsidy
 *   shipping subsidy   = max(0, shipping cost − shipping charged to the customer)
 *   gross profit       = net revenue − COGS
 *   variable costs     = payment processing + platform fees + refund reserve
 *   contribution (pre-marketing) = gross profit − variable costs  (= break-even CAC)
 *   contribution profit = contribution (pre-marketing) − CAC
 *
 * Fixed overhead (software, salaries, tooling) is out of scope here, so none of
 * these numbers are net income.
 */

export interface CostInputs {
  blankCost: number;
  decorationCost: number;
  fulfillmentFee: number;
  /** provider shipping cost for the first item in an order */
  shippingCost: number;
  /** provider shipping cost for each additional item (defaults to shippingCost — conservative) */
  additionalItemShippingCost?: number;
}

export interface FeeModel {
  paymentProcessingPct: number;
  paymentProcessingFixed: number;
  platformFeePct: number;
  /** flat shipping charged to the customer per order */
  shippingCharged: number;
  freeShippingThreshold: number | null;
  refundReservePct: number;
  targetCac: number;
  targetContributionMargin: number;
  minGrossMargin: number;
  quantityDiscounts?: ReadonlyArray<{ minQuantity: number; percentOff: number }>;
}

export const DEFAULT_FEE_MODEL: FeeModel = {
  paymentProcessingPct: 0.029,
  paymentProcessingFixed: 0.3,
  platformFeePct: 0,
  shippingCharged: 4.99,
  freeShippingThreshold: null,
  refundReservePct: 0.03,
  targetCac: 0,
  targetContributionMargin: 0.25,
  minGrossMargin: 0.4,
  quantityDiscounts: [],
};

export interface OrderLine {
  costs: CostInputs;
  unitPrice: number;
  quantity: number;
}

export interface OrderEconomics {
  units: number;
  listSubtotal: number;
  discount: number;
  netRevenue: number;
  shippingCharged: number;
  productCost: number;
  blankCost: number;
  decorationCost: number;
  fulfillmentFees: number;
  shippingCost: number;
  shippingSubsidy: number;
  cogs: number;
  paymentProcessing: number;
  platformFees: number;
  refundReserve: number;
  cac: number;
  grossProfit: number;
  grossMargin: number | null;
  contributionBeforeMarketing: number;
  contributionProfit: number;
  contributionMargin: number | null;
  breakEvenCac: number;
  totalContributionCost: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function assertNonNegative(label: string, v: number) {
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label} must be a non-negative number`);
}

export function quantityDiscountPct(model: Pick<FeeModel, "quantityDiscounts">, units: number): number {
  let pct = 0;
  for (const tier of model.quantityDiscounts ?? []) {
    if (units >= tier.minQuantity && tier.percentOff > pct) pct = tier.percentOff;
  }
  return Math.min(pct, 0.9);
}

/**
 * Economics of a whole order (one or more lines). `orderDiscount` is an extra
 * absolute discount (promo codes); quantity-tier discounts are applied first.
 */
export function orderEconomics(
  lines: readonly OrderLine[],
  model: FeeModel,
  opts: { cac?: number; orderDiscount?: number; bundlePrice?: number } = {},
): OrderEconomics {
  if (lines.length === 0) throw new Error("An order needs at least one line");
  let units = 0;
  let listSubtotal = 0;
  let blank = 0;
  let decoration = 0;
  let fulfillment = 0;
  let shippingCost = 0;
  let first = true;

  for (const line of lines) {
    assertNonNegative("unit price", line.unitPrice);
    assertNonNegative("blank cost", line.costs.blankCost);
    assertNonNegative("decoration cost", line.costs.decorationCost);
    assertNonNegative("fulfillment fee", line.costs.fulfillmentFee);
    assertNonNegative("shipping cost", line.costs.shippingCost);
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error("quantity must be a positive integer");
    units += line.quantity;
    listSubtotal += line.unitPrice * line.quantity;
    blank += line.costs.blankCost * line.quantity;
    decoration += line.costs.decorationCost * line.quantity;
    fulfillment += line.costs.fulfillmentFee * line.quantity;
    const additional = line.costs.additionalItemShippingCost ?? line.costs.shippingCost;
    for (let i = 0; i < line.quantity; i++) {
      shippingCost += first ? line.costs.shippingCost : additional;
      first = false;
    }
  }

  let discount: number;
  if (opts.bundlePrice !== undefined) {
    assertNonNegative("bundle price", opts.bundlePrice);
    discount = Math.max(0, listSubtotal - opts.bundlePrice);
  } else {
    discount = listSubtotal * quantityDiscountPct(model, units);
  }
  discount += Math.max(0, opts.orderDiscount ?? 0);
  discount = Math.min(discount, listSubtotal);

  const netRevenue = listSubtotal - discount;
  const freeShipping = model.freeShippingThreshold !== null && netRevenue >= model.freeShippingThreshold;
  const shippingCharged = freeShipping ? 0 : model.shippingCharged;
  const shippingSubsidy = Math.max(0, shippingCost - shippingCharged);
  const productCost = blank + decoration + fulfillment;
  const cogs = productCost + shippingSubsidy;
  const charged = netRevenue + shippingCharged;
  const paymentProcessing = charged > 0 ? charged * model.paymentProcessingPct + model.paymentProcessingFixed : 0;
  const platformFees = netRevenue * model.platformFeePct;
  const refundReserve = netRevenue * model.refundReservePct;
  const cac = Math.max(0, opts.cac ?? model.targetCac);
  const grossProfit = netRevenue - cogs;
  const contributionBeforeMarketing = grossProfit - paymentProcessing - platformFees - refundReserve;
  const contributionProfit = contributionBeforeMarketing - cac;

  return {
    units,
    listSubtotal: r2(listSubtotal),
    discount: r2(discount),
    netRevenue: r2(netRevenue),
    shippingCharged: r2(shippingCharged),
    productCost: r2(productCost),
    blankCost: r2(blank),
    decorationCost: r2(decoration),
    fulfillmentFees: r2(fulfillment),
    shippingCost: r2(shippingCost),
    shippingSubsidy: r2(shippingSubsidy),
    cogs: r2(cogs),
    paymentProcessing: r2(paymentProcessing),
    platformFees: r2(platformFees),
    refundReserve: r2(refundReserve),
    cac: r2(cac),
    grossProfit: r2(grossProfit),
    grossMargin: netRevenue > 0 ? round4(grossProfit / netRevenue) : null,
    contributionBeforeMarketing: r2(contributionBeforeMarketing),
    contributionProfit: r2(contributionProfit),
    contributionMargin: netRevenue > 0 ? round4(contributionProfit / netRevenue) : null,
    breakEvenCac: r2(Math.max(0, contributionBeforeMarketing)),
    totalContributionCost: r2(cogs + paymentProcessing + platformFees + refundReserve + cac),
  };
}

export function unitEconomics(costs: CostInputs, price: number, model: FeeModel, opts: { cac?: number } = {}) {
  return orderEconomics([{ costs, unitPrice: price, quantity: 1 }], model, opts);
}

/** Rounds up to a "charm" price ending in .99 (e.g. 31.20 → 31.99). */
export function charmPrice(v: number): number {
  if (v <= 0) return 0.99;
  return Math.ceil(v + 0.01) - 0.01;
}

/**
 * Lowest charm price whose single-unit gross margin meets `targetGrossMargin`.
 * Solves price − cogs ≥ m·price  ⇒  price ≥ cogs / (1 − m), then verifies with
 * the full model (free-shipping thresholds make this non-linear).
 */
export function priceForGrossMargin(costs: CostInputs, model: FeeModel, targetGrossMargin: number): number {
  if (targetGrossMargin >= 1) throw new Error("target margin must be below 100%");
  const approxCogs = costs.blankCost + costs.decorationCost + costs.fulfillmentFee + Math.max(0, costs.shippingCost - model.shippingCharged);
  let price = charmPrice(approxCogs / (1 - targetGrossMargin));
  for (let i = 0; i < 200; i++) {
    const e = unitEconomics(costs, price, model);
    if ((e.grossMargin ?? -1) >= targetGrossMargin) return r2(price);
    price = charmPrice(price + 1);
  }
  return r2(price);
}

export type ProductRecommendation = "launch" | "avoid" | "premium_only" | "bundle_only" | "upsell" | "test";

export interface RecommendationResult {
  recommendation: ProductRecommendation;
  reasons: string[];
  suggestedPrice: number | null;
  economics: OrderEconomics;
  bundleOfTwo: OrderEconomics;
}

/**
 * Rule-based product recommendation. Every outcome carries human-readable
 * reasons; there is no model opinion involved.
 */
export function recommendProduct(
  costs: CostInputs,
  price: number,
  model: FeeModel,
  opts: { cac?: number; bundleDiscountPct?: number } = {},
): RecommendationResult {
  const economics = unitEconomics(costs, price, model, { cac: opts.cac });
  const bundleDiscount = opts.bundleDiscountPct ?? 0.1;
  const bundleOfTwo = orderEconomics([{ costs, unitPrice: price, quantity: 2 }], model, {
    cac: opts.cac,
    bundlePrice: price * 2 * (1 - bundleDiscount),
  });
  const reasons: string[] = [];
  const gm = economics.grossMargin ?? 0;
  const cm = economics.contributionMargin ?? 0;
  const targetCac = opts.cac ?? model.targetCac;

  if (economics.contributionBeforeMarketing <= 0) {
    reasons.push(
      `Loses money before marketing: contribution ${fmt(economics.contributionBeforeMarketing)} at ${fmt(price)}.`,
    );
    const suggested = priceForGrossMargin(costs, model, model.minGrossMargin);
    if (suggested <= price * 1.3) {
      reasons.push(`Viable only at a premium price (${fmt(suggested)} for ${pct(model.minGrossMargin)} gross margin).`);
      return { recommendation: "premium_only", reasons, suggestedPrice: suggested, economics, bundleOfTwo };
    }
    return { recommendation: "avoid", reasons, suggestedPrice: null, economics, bundleOfTwo };
  }

  if (gm < model.minGrossMargin) {
    const suggested = priceForGrossMargin(costs, model, model.minGrossMargin);
    reasons.push(`Gross margin ${pct(gm)} is below the ${pct(model.minGrossMargin)} minimum.`);
    if (suggested <= price * 1.3) {
      reasons.push(`Raising price to ${fmt(suggested)} restores the minimum margin.`);
      return { recommendation: "premium_only", reasons, suggestedPrice: suggested, economics, bundleOfTwo };
    }
    reasons.push(`Required price ${fmt(suggested)} is more than 30% above the current price.`);
    return { recommendation: "avoid", reasons, suggestedPrice: null, economics, bundleOfTwo };
  }

  if (targetCac > 0 && economics.breakEvenCac < targetCac) {
    reasons.push(`Break-even CAC ${fmt(economics.breakEvenCac)} is below the target CAC ${fmt(targetCac)}.`);
    if (bundleOfTwo.breakEvenCac >= targetCac) {
      reasons.push(`A 2-item bundle at ${pct(bundleDiscount)} off reaches break-even CAC ${fmt(bundleOfTwo.breakEvenCac)}.`);
      return { recommendation: "bundle_only", reasons, suggestedPrice: null, economics, bundleOfTwo };
    }
    reasons.push("Profitable without acquisition cost — sell as an add-on / upsell rather than a paid-traffic hero.");
    return { recommendation: "upsell", reasons, suggestedPrice: null, economics, bundleOfTwo };
  }

  if (cm >= model.targetContributionMargin) {
    reasons.push(`Contribution margin ${pct(cm)} meets the ${pct(model.targetContributionMargin)} target.`);
    reasons.push(`Gross margin ${pct(gm)}; break-even CAC ${fmt(economics.breakEvenCac)}.`);
    return { recommendation: "launch", reasons, suggestedPrice: null, economics, bundleOfTwo };
  }

  reasons.push(
    `Contribution margin ${pct(cm)} is positive but under the ${pct(model.targetContributionMargin)} target — validate demand before committing.`,
  );
  return { recommendation: "test", reasons, suggestedPrice: null, economics, bundleOfTwo };
}

function round4(v: number) {
  return Math.round(v * 10000) / 10000;
}
function fmt(v: number) {
  return `$${v.toFixed(2)}`;
}
function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}
