import type { CatalogProduct } from "./types";

/**
 * DEMO catalog. Costs are illustrative placeholders for development — they are
 * NOT quotes from any real provider. Replace with a CSV import or a live adapter.
 */
export const MOCK_CATALOG: readonly CatalogProduct[] = [
  mk("DEMO-TEE-HEAVY", "Heavyweight Cotton Tee (demo)", "Demo Blanks", "tee", 6.2, "dtg", 4.5, 1.5, 4.75, 7.5, 3, ["Black", "Off-White", "Charcoal", "Sand"], ["S", "M", "L", "XL", "2XL"]),
  mk("DEMO-TEE-PREMIUM", "Premium Boxy Tee (demo)", "Demo Blanks", "tee", 8.9, "screen_print", 3.8, 1.5, 4.75, 7.5, 5, ["Black", "Bone", "Slate"], ["S", "M", "L", "XL"]),
  mk("DEMO-LS-TEE", "Long Sleeve Tee (demo)", "Demo Blanks", "long_sleeve", 8.4, "dtg", 5.5, 1.5, 5.25, 8.5, 3, ["Black", "White"], ["S", "M", "L", "XL", "2XL"]),
  mk("DEMO-HOODIE", "Midweight Hoodie (demo)", "Demo Blanks", "hoodie", 15.8, "dtg", 6.5, 2, 7.5, 12, 4, ["Black", "Heather Grey", "Navy"], ["S", "M", "L", "XL", "2XL"]),
  mk("DEMO-HOODIE-PREMIUM", "Heavyweight Premium Hoodie (demo)", "Demo Blanks", "hoodie", 24.5, "embroidery", 9.0, 2, 7.5, 12, 6, ["Black", "Bone"], ["S", "M", "L", "XL"]),
  mk("DEMO-CREW", "Fleece Crewneck (demo)", "Demo Blanks", "crewneck", 13.9, "dtg", 6.5, 2, 7, 11, 4, ["Black", "Sand"], ["S", "M", "L", "XL", "2XL"]),
  mk("DEMO-HAT-DAD", "Unstructured Dad Hat (demo)", "Demo Blanks", "hat", 7.1, "embroidery", 6.0, 1.5, 4.5, 7, 4, ["Black", "Stone", "Olive"], ["One size"]),
  mk("DEMO-HAT-LIQUID3D", "Structured Cap — Liquid 3D print (demo)", "Demo Blanks", "hat", 8.4, "liquid_3d", 7.5, 1.5, 4.5, 7, 6, ["Black", "White"], ["One size"]),
  mk("DEMO-BEANIE", "Cuffed Beanie (demo)", "Demo Blanks", "beanie", 5.6, "embroidery", 5.5, 1.5, 4.25, 6.5, 4, ["Black", "Grey"], ["One size"]),
  mk("DEMO-TOTE", "Canvas Tote (demo)", "Demo Blanks", "tote", 4.8, "dtg", 4.0, 1.5, 4.5, 7, 3, ["Natural", "Black"], ["One size"]),
  mk("DEMO-MUG", "Ceramic Mug 11oz (demo)", "Demo Blanks", "mug", 3.9, "sublimation", 2.0, 1.5, 6.5, 11, 3, ["White", "Black"], ["11oz"]),
  mk("DEMO-POSTER", "Matte Poster 18x24 (demo)", "Demo Blanks", "poster", 6.5, "other", 0, 1.5, 6, 10, 3, ["Matte"], ["18x24"]),
  mk("DEMO-STICKER", "Die-cut Sticker (demo)", "Demo Blanks", "sticker", 0.9, "other", 0, 0.75, 1.5, 2.5, 2, ["Standard"], ["3in"]),
];

function mk(
  sku: string,
  name: string,
  brand: string,
  type: CatalogProduct["productType"],
  blank: number,
  method: string,
  decoration: number,
  fee: number,
  shipDomestic: number,
  shipIntl: number,
  sla: number,
  colors: string[],
  sizes: string[],
): CatalogProduct {
  return {
    provider: "mock",
    providerSku: sku,
    blankName: name,
    blankBrand: brand,
    productType: type,
    availableColors: colors,
    availableSizes: sizes,
    blankCost: blank,
    decorationMethod: method,
    decorationCost: decoration,
    fulfillmentFee: fee,
    shippingEstimateDomestic: shipDomestic,
    shippingEstimateInternational: shipIntl,
    productionSlaDays: sla,
    productImages: [],
    inventoryMode: "print_on_demand",
    metadata: { demo: true, note: "Illustrative placeholder cost — not a provider quote." },
  };
}
