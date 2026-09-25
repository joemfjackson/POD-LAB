import { ProviderNotConfiguredError } from "../errors";
import { MOCK_CATALOG } from "./mock-catalog";
import type {
  CatalogProduct,
  CatalogVariant,
  FulfillmentOrder,
  FulfillmentOrderRequest,
  FulfillmentProviderAdapter,
  FulfillmentStatus,
  ProviderPricing,
} from "./types";

function pricingOf(p: CatalogProduct): ProviderPricing {
  return {
    providerSku: p.providerSku,
    blankCost: p.blankCost,
    decorationCost: p.decorationCost,
    fulfillmentFee: p.fulfillmentFee,
    shippingEstimateDomestic: p.shippingEstimateDomestic,
    currency: "USD",
  };
}

function variantsOf(p: CatalogProduct): CatalogVariant[] {
  const colors = p.availableColors.length ? p.availableColors : [null];
  const sizes = p.availableSizes.length ? p.availableSizes : [null];
  return colors.flatMap((color) =>
    sizes.map((size) => ({
      variantSku: [p.providerSku, color, size].filter(Boolean).join("-").replace(/\s+/g, "").toUpperCase(),
      color,
      size,
      blankCostOverride: null,
      available: true,
    })),
  );
}

/**
 * Catalog-backed adapter for manually entered or CSV-imported products. Reads
 * from a loader (the database) and cannot place orders.
 */
export class CatalogAdapter implements FulfillmentProviderAdapter {
  readonly supportsOrders = false;
  constructor(
    readonly adapter: "manual" | "csv",
    readonly label: string,
    private readonly load: () => Promise<CatalogProduct[]>,
  ) {}
  isConfigured() {
    return true;
  }
  listProducts() {
    return this.load();
  }
  async getProduct(sku: string) {
    return (await this.load()).find((p) => p.providerSku === sku) ?? null;
  }
  async getVariants(sku: string) {
    const p = await this.getProduct(sku);
    return p ? variantsOf(p) : [];
  }
  async getPricing(sku: string) {
    const p = await this.getProduct(sku);
    return p ? pricingOf(p) : null;
  }
  async createOrder(): Promise<FulfillmentOrder> {
    throw new ProviderNotConfiguredError(this.label, "manual/CSV catalogs cannot place fulfillment orders");
  }
  async getOrder(): Promise<FulfillmentOrder | null> {
    return null;
  }
  async getFulfillmentStatus(): Promise<FulfillmentStatus | null> {
    return null;
  }
}

/** Development adapter backed by the static DEMO catalog. Orders are simulated and flagged as such. */
export class MockFulfillmentAdapter implements FulfillmentProviderAdapter {
  readonly adapter = "mock" as const;
  readonly label = "Mock catalog (demo data)";
  readonly supportsOrders = true;
  private readonly orders = new Map<string, FulfillmentOrder>();
  isConfigured() {
    return true;
  }
  async listProducts() {
    return [...MOCK_CATALOG];
  }
  async getProduct(sku: string) {
    return MOCK_CATALOG.find((p) => p.providerSku === sku) ?? null;
  }
  async getVariants(sku: string) {
    const p = await this.getProduct(sku);
    return p ? variantsOf(p) : [];
  }
  async getPricing(sku: string) {
    const p = await this.getProduct(sku);
    return p ? pricingOf(p) : null;
  }
  async createOrder(order: FulfillmentOrderRequest): Promise<FulfillmentOrder> {
    if (order.lines.length === 0) throw new Error("Order has no lines");
    const created: FulfillmentOrder = {
      providerOrderId: `SIM-${order.externalOrderId}`,
      status: "simulated_received",
      simulated: true,
      createdAt: new Date().toISOString(),
    };
    this.orders.set(created.providerOrderId, created);
    return created;
  }
  async getOrder(id: string) {
    return this.orders.get(id) ?? null;
  }
  async getFulfillmentStatus(id: string): Promise<FulfillmentStatus | null> {
    const o = this.orders.get(id);
    return o ? { providerOrderId: id, status: o.status, trackingNumbers: [], simulated: true } : null;
  }
}

export interface FulfillEngineConfig {
  apiBaseUrl?: string;
  apiKey?: string;
}

/**
 * Fulfill Engine placeholder. Official API details are pending, so every call
 * reports "Requires provider connection". No endpoints or payloads are guessed.
 * See docs/fulfill-engine-plan.md for the implementation checklist.
 */
export class FulfillEngineAdapter implements FulfillmentProviderAdapter {
  readonly adapter = "fulfill_engine" as const;
  readonly label = "Fulfill Engine";
  readonly supportsOrders = true;
  constructor(private readonly config: FulfillEngineConfig) {}
  isConfigured() {
    return Boolean(this.config.apiBaseUrl && this.config.apiKey);
  }
  private notReady(): never {
    throw new ProviderNotConfiguredError(
      "Fulfill Engine",
      this.isConfigured()
        ? "credentials saved, but the adapter awaits official API documentation (see docs/fulfill-engine-plan.md)"
        : "API access pending",
    );
  }
  async listProducts(): Promise<CatalogProduct[]> {
    return this.notReady();
  }
  async getProduct(): Promise<CatalogProduct | null> {
    return this.notReady();
  }
  async getVariants(): Promise<CatalogVariant[]> {
    return this.notReady();
  }
  async getPricing(): Promise<ProviderPricing | null> {
    return this.notReady();
  }
  async createOrder(): Promise<FulfillmentOrder> {
    return this.notReady();
  }
  async getOrder(): Promise<FulfillmentOrder | null> {
    return this.notReady();
  }
  async getFulfillmentStatus(): Promise<FulfillmentStatus | null> {
    return this.notReady();
  }
}
