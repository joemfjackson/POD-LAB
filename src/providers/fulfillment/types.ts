/**
 * Fulfillment provider contract. Domain logic (Product & Profit agent, finance,
 * store builder) only depends on these types, so a real Fulfill Engine adapter
 * can be added without touching business logic.
 */

export type ProductType =
  | "tee" | "long_sleeve" | "hoodie" | "crewneck" | "hat" | "beanie" | "tote" | "mug"
  | "poster" | "sticker" | "phone_case" | "jacket" | "shorts" | "other";

export interface CatalogProduct {
  provider: string;
  providerSku: string;
  blankName: string;
  blankBrand: string | null;
  productType: ProductType;
  availableColors: string[];
  availableSizes: string[];
  blankCost: number;
  decorationMethod: string;
  decorationCost: number;
  fulfillmentFee: number;
  shippingEstimateDomestic: number | null;
  shippingEstimateInternational: number | null;
  productionSlaDays: number | null;
  productImages: string[];
  inventoryMode: "print_on_demand" | "stocked" | "hybrid";
  metadata: Record<string, unknown>;
}

export interface CatalogVariant {
  variantSku: string;
  color: string | null;
  size: string | null;
  blankCostOverride: number | null;
  available: boolean;
}

export interface ProviderPricing {
  providerSku: string;
  blankCost: number;
  decorationCost: number;
  fulfillmentFee: number;
  shippingEstimateDomestic: number | null;
  currency: "USD";
}

export interface FulfillmentOrderLine {
  providerSku: string;
  variantSku: string | null;
  quantity: number;
  artworkUrl: string | null;
}

export interface FulfillmentOrderRequest {
  externalOrderId: string;
  lines: FulfillmentOrderLine[];
  shipTo: { name: string; address1: string; address2?: string; city: string; region: string; postalCode: string; country: string };
}

export interface FulfillmentOrder {
  providerOrderId: string;
  status: string;
  simulated: boolean;
  createdAt: string;
}

export interface FulfillmentStatus {
  providerOrderId: string;
  status: string;
  trackingNumbers: string[];
  simulated: boolean;
}

export interface FulfillmentProviderAdapter {
  readonly adapter: "manual" | "csv" | "mock" | "fulfill_engine";
  readonly label: string;
  readonly supportsOrders: boolean;
  isConfigured(): boolean;
  listProducts(): Promise<CatalogProduct[]>;
  getProduct(providerSku: string): Promise<CatalogProduct | null>;
  getVariants(providerSku: string): Promise<CatalogVariant[]>;
  getPricing(providerSku: string): Promise<ProviderPricing | null>;
  createOrder(order: FulfillmentOrderRequest): Promise<FulfillmentOrder>;
  getOrder(providerOrderId: string): Promise<FulfillmentOrder | null>;
  getFulfillmentStatus(providerOrderId: string): Promise<FulfillmentStatus | null>;
}
