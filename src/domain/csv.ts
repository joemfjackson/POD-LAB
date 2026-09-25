/**
 * CSV parsing, column mapping and row validation for imports
 * (products, orders, experiment metrics, fulfillment catalog).
 */
import { z } from "zod";

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

/** RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field.length === 0) inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim().length > 0)) rows.push(row);
      row = [];
    } else field += c;
  }
  if (inQuotes) throw new Error("Malformed CSV: unterminated quoted field");
  row.push(field);
  if (row.some((f) => f.trim().length > 0)) rows.push(row);
  return rows;
}

/** Neutralises spreadsheet formula injection when values are exported back to CSV. */
export function csvEscape(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<Record<string, unknown>>): string {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join("\n");
}

// ---------------------------------------------------------------------------
// Import definitions
// ---------------------------------------------------------------------------

const num = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const cleaned = v.replace(/[$,\s]/g, "");
      if (cleaned === "") return 0;
      const n = Number(cleaned);
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be a non-negative number` });
        return z.NEVER;
      }
      return n;
    });

const optionalNum = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const cleaned = v.replace(/[$,\s]/g, "");
      if (cleaned === "") return null;
      const n = Number(cleaned);
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be a non-negative number` });
        return z.NEVER;
      }
      return n;
    });

const int = (label: string) =>
  num(label).refine((n) => Number.isInteger(n), { message: `${label} must be a whole number` });

const date = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), {
    message: "Date must be YYYY-MM-DD",
  });

const list = z
  .string()
  .trim()
  .transform((v) =>
    v
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean),
  );

const PRODUCT_TYPES = [
  "tee", "long_sleeve", "hoodie", "crewneck", "hat", "beanie", "tote", "mug", "poster",
  "sticker", "phone_case", "jacket", "shorts", "other",
] as const;

const productType = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase().replace(/[\s-]+/g, "_"))
  .transform((v) => (v === "t_shirt" || v === "tshirt" ? "tee" : v))
  .pipe(z.enum(PRODUCT_TYPES));

const catalogRow = z.object({
  provider_sku: z.string().trim().min(1, "SKU is required").max(120),
  blank_name: z.string().trim().min(1, "Blank name is required").max(200),
  blank_brand: z.string().trim().max(120),
  product_type: productType,
  available_colors: list,
  available_sizes: list,
  blank_cost: num("Blank cost"),
  decoration_method: z.string().trim().max(60),
  decoration_cost: num("Decoration cost"),
  fulfillment_fee: num("Fulfillment fee"),
  shipping_estimate_domestic: optionalNum("Domestic shipping"),
  shipping_estimate_international: optionalNum("International shipping"),
  production_sla_days: optionalNum("Production SLA"),
  product_images: list,
});

const orderRow = z.object({
  external_order_id: z.string().trim().min(1, "Order ID is required").max(120),
  order_date: date,
  sku: z.string().trim().max(120),
  product_title: z.string().trim().max(300),
  channel: z.string().trim().max(60),
  quantity: int("Quantity").refine((n) => n >= 1, { message: "Quantity must be at least 1" }),
  revenue: num("Revenue"),
  discount: num("Discount"),
  shipping_paid: num("Shipping paid"),
  cogs: num("COGS"),
  decoration_cost: num("Decoration cost"),
  fulfillment_fee: num("Fulfillment fee"),
  shipping_cost: num("Shipping cost"),
  payment_processing: num("Payment processing"),
  platform_fee: num("Platform fee"),
  ad_attribution: num("Ad attribution"),
  refunds: num("Refunds"),
});

const metricRow = z.object({
  variant_key: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]$/, "Variant key must be a single letter (A, B, C…)")),
  metric_date: date,
  impressions: int("Impressions"),
  clicks: int("Clicks"),
  sessions: int("Sessions"),
  product_views: int("Product views"),
  add_to_carts: int("Add to carts"),
  checkouts: int("Checkouts"),
  purchases: int("Purchases"),
  gross_revenue: num("Gross revenue"),
  discounts: num("Discounts"),
  refunds: num("Refunds"),
  cogs: num("COGS"),
  fulfillment_cost: num("Fulfillment cost"),
  shipping_subsidy: num("Shipping subsidy"),
  ad_spend: num("Ad spend"),
  repeat_buyers: int("Repeat buyers"),
});

export const IMPORT_KINDS = {
  fulfillment_catalog: {
    label: "Fulfillment catalog",
    schema: catalogRow,
    required: ["provider_sku", "blank_name", "product_type", "blank_cost"],
    aliases: {
      provider_sku: ["sku", "provider sku", "product sku", "style", "style number"],
      blank_name: ["name", "product", "product name", "blank", "title"],
      blank_brand: ["brand", "manufacturer"],
      product_type: ["type", "category", "product type"],
      available_colors: ["colors", "colours"],
      available_sizes: ["sizes"],
      blank_cost: ["cost", "base cost", "blank cost", "price"],
      decoration_method: ["method", "print method", "decoration"],
      decoration_cost: ["print cost", "decoration cost"],
      fulfillment_fee: ["fee", "fulfillment", "handling"],
      shipping_estimate_domestic: ["shipping", "domestic shipping", "shipping us"],
      shipping_estimate_international: ["international shipping", "shipping intl"],
      production_sla_days: ["sla", "production days", "turnaround"],
      product_images: ["images", "image urls"],
    },
  },
  products: {
    label: "Products (catalog blanks)",
    schema: catalogRow,
    required: ["provider_sku", "blank_name", "product_type", "blank_cost"],
    aliases: {
      provider_sku: ["sku"],
      blank_name: ["name", "product", "title"],
      blank_brand: ["brand"],
      product_type: ["type", "category"],
      available_colors: ["colors"],
      available_sizes: ["sizes"],
      blank_cost: ["cost", "base cost"],
      decoration_method: ["method"],
      decoration_cost: ["print cost"],
      fulfillment_fee: ["fee"],
      shipping_estimate_domestic: ["shipping"],
      shipping_estimate_international: ["international shipping"],
      production_sla_days: ["sla"],
      product_images: ["images"],
    },
  },
  orders: {
    label: "Orders",
    schema: orderRow,
    required: ["external_order_id", "order_date", "quantity", "revenue"],
    aliases: {
      external_order_id: ["order id", "order", "order number", "name", "id"],
      order_date: ["date", "created at", "order date"],
      sku: ["lineitem sku", "variant sku"],
      product_title: ["lineitem name", "product", "title"],
      channel: ["source", "sales channel"],
      quantity: ["qty", "lineitem quantity", "units"],
      revenue: ["subtotal", "gross sales", "sales", "total"],
      discount: ["discount amount", "discounts"],
      shipping_paid: ["shipping", "shipping charged"],
      cogs: ["cost", "product cost", "blank cost"],
      decoration_cost: ["print cost"],
      fulfillment_fee: ["fulfillment"],
      shipping_cost: ["shipping cost", "postage"],
      payment_processing: ["payment fees", "transaction fees", "processing"],
      platform_fee: ["platform fees", "marketplace fee"],
      ad_attribution: ["ad spend", "attributed ad spend"],
      refunds: ["refunded amount", "refund"],
    },
  },
  experiment_metrics: {
    label: "Experiment metrics",
    schema: metricRow,
    required: ["variant_key", "metric_date"],
    aliases: {
      variant_key: ["variant", "arm", "key"],
      metric_date: ["date", "day"],
      impressions: ["impr"],
      clicks: ["link clicks"],
      sessions: ["visits", "visitors"],
      product_views: ["pdp views", "views"],
      add_to_carts: ["atc", "add to cart", "adds to cart"],
      checkouts: ["checkouts initiated", "initiated checkout"],
      purchases: ["orders", "conversions"],
      gross_revenue: ["revenue", "sales"],
      discounts: ["discount"],
      refunds: ["refund"],
      cogs: ["cost of goods"],
      fulfillment_cost: ["fulfillment"],
      shipping_subsidy: ["shipping subsidy"],
      ad_spend: ["spend", "amount spent", "cost"],
      repeat_buyers: ["repeat customers", "returning buyers"],
    },
  },
} as const;

export type ImportKind = keyof typeof IMPORT_KINDS;

export type ImportRow<K extends ImportKind> = z.output<(typeof IMPORT_KINDS)[K]["schema"]>;

function norm(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");
}

/** Maps target fields → CSV header index using exact names first, then aliases. */
export function autoMap(kind: ImportKind, headers: readonly string[]): Record<string, number> {
  const def = IMPORT_KINDS[kind];
  const normalized = headers.map(norm);
  const mapping: Record<string, number> = {};
  const fields = Object.keys(def.schema.shape);
  for (const field of fields) {
    const exact = normalized.indexOf(norm(field));
    if (exact >= 0) {
      mapping[field] = exact;
      continue;
    }
    const aliases = (def.aliases as Record<string, readonly string[]>)[field] ?? [];
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0 && !Object.values(mapping).includes(idx)) mapping[field] = idx;
  }
  return mapping;
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface ImportPreview<K extends ImportKind> {
  kind: K;
  headers: string[];
  mapping: Record<string, number>;
  missingRequired: string[];
  totalRows: number;
  valid: Array<{ row: number; data: ImportRow<K> }>;
  errors: RowError[];
}

export function previewImport<K extends ImportKind>(
  kind: K,
  csvText: string,
  mappingOverride?: Record<string, number>,
): ImportPreview<K> {
  if (csvText.length > MAX_IMPORT_BYTES) throw new Error("CSV file is larger than 4 MB");
  const rows = parseCsv(csvText);
  const headers = (rows[0] ?? []).map((h) => h.trim());
  const body = rows.slice(1);
  if (body.length > MAX_IMPORT_ROWS) throw new Error(`CSV has ${body.length} rows; the limit is ${MAX_IMPORT_ROWS}`);
  const def = IMPORT_KINDS[kind];
  const mapping = mappingOverride ?? autoMap(kind, headers);
  const missingRequired = def.required.filter((f) => mapping[f] === undefined);
  const valid: Array<{ row: number; data: ImportRow<K> }> = [];
  const errors: RowError[] = [];

  if (missingRequired.length === 0) {
    body.forEach((cells, i) => {
      const rowNumber = i + 2; // 1-based with header row
      // every schema field is present; unmapped columns are blank and take the field's empty meaning
      const record: Record<string, string> = {};
      for (const field of Object.keys(def.schema.shape)) {
        const idx = mapping[field];
        record[field] = idx === undefined ? "" : (cells[idx] ?? "").trim();
      }
      const parsed = def.schema.safeParse(record);
      if (parsed.success) valid.push({ row: rowNumber, data: parsed.data as ImportRow<K> });
      else
        for (const issue of parsed.error.issues)
          errors.push({ row: rowNumber, field: String(issue.path[0] ?? ""), message: issue.message });
    });
  }

  return { kind, headers, mapping, missingRequired, totalRows: body.length, valid, errors };
}
