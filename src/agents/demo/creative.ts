import type { CreativeOutput } from "../schemas";
import { AI_SI_AVOID, AI_SI_COLLECTIONS, AI_SI_DESIGNS } from "./ai-si";
import { DEMO_LABEL, isAiSiSubject, pick, scoreBetween, seededRandom, titleCase } from "./util";

type Design = CreativeOutput["designs"][number];

function directions(aiSi: boolean, palette: Array<{ name: string; hex: string }>): CreativeOutput["visual_directions"] {
  return [
    {
      key: "lab",
      name: aiSi ? "Research Laboratory" : "Spec Sheet",
      mood: aiSi ? "Issued equipment from a serious lab: calm, exact, slightly ominous." : "Technical documentation turned into apparel.",
      typography: "Monospaced labels with a tight grotesque wordmark; generous tracking on small caps.",
      colors: palette.slice(0, 3),
      graphic_language: "Spec plates, measurement ticks, registration marks, serial numbers.",
      illustration_style: "Line diagrams only; no rendered illustration.",
      photography_direction: "Flat-lay on concrete and lab benches; hard daylight; no neon.",
      garment_placement: "Small left-chest marks with large, quiet back prints.",
      decoration_methods: ["screen_print", "embroidery"],
      avoid: aiSi ? AI_SI_AVOID : ["clip-art", "novelty fonts"],
    },
    {
      key: "signal",
      name: "Signal",
      mood: "Bold typographic statements with a single accent colour.",
      typography: "Heavy condensed sans for statements; mono for annotations.",
      colors: palette.slice(0, 4),
      graphic_language: "Arrows, brackets, double slashes and progression lines.",
      illustration_style: "Typographic only.",
      photography_direction: "Street portraits, overcast light, candid.",
      garment_placement: "Centre-chest statements, sleeve annotations.",
      decoration_methods: ["dtg", "puff_embroidery"],
      avoid: aiSi ? AI_SI_AVOID : ["generic slogans"],
    },
    {
      key: "archive",
      name: "Archive",
      mood: "Future history: artefacts dated to the present era, as if found later.",
      typography: "Serif display paired with mono datestamps.",
      colors: palette.slice(1, 4),
      graphic_language: "Timelines, era markers, catalogue numbers.",
      illustration_style: "Engraving-style linework used sparingly.",
      photography_direction: "Museum-card styling, neutral backdrops.",
      garment_placement: "Back timelines, chest era stamps.",
      decoration_methods: ["screen_print", "liquid_3d"],
      avoid: aiSi ? AI_SI_AVOID : ["distressed grunge overuse"],
    },
  ];
}

function prompts(title: string, concept: string, dir: string): Pick<Design, "generation_prompt" | "mockup_prompt"> {
  return {
    generation_prompt: `Vector apparel artwork, transparent background, ${dir} direction: "${title}". ${concept} Flat colours, print-ready, no mockup, no photorealism, no logos or trademarks.`,
    mockup_prompt: `Product photo of a heavyweight black tee with the "${title}" print, flat lay on concrete, soft daylight, minimal styling.`,
  };
}

export function demoCreative(input: {
  brand: { niche: string; name: string };
  identity: { colors: Array<{ name: string; hex: string }> } | null;
  mode: "full" | "derivatives";
  parent: { title: string; concept: string; collection: string | null } | null;
  design_count: number;
}): CreativeOutput {
  const aiSi = isAiSiSubject(input.brand.niche);
  const rand = seededRandom(`creative|${input.brand.niche}|${input.mode}|${input.parent?.title ?? ""}`);
  const palette = input.identity?.colors?.length
    ? input.identity.colors.map((c) => ({ name: c.name, hex: c.hex }))
    : [
        { name: "Black", hex: "#0B0B0C" },
        { name: "Bone", hex: "#EDEAE3" },
        { name: "Graphite", hex: "#3A3B3E" },
        { name: "Signal", hex: "#FF5A1F" },
      ];
  while (palette.length < 4) palette.push({ name: "Graphite", hex: "#3A3B3E" });

  if (input.mode === "derivatives" && input.parent) {
    const p = input.parent;
    const variants = ["Back-print edition", "Tonal colourway", "Embroidered minimal", "Oversized statement"];
    return {
      visual_directions: [],
      recommended_direction: "lab",
      collections: [],
      designs: variants.slice(0, Math.max(1, Math.min(input.design_count, variants.length))).map((v) => ({
        title: `${p.title} — ${v}`,
        collection: p.collection ?? "Core",
        concept: `Derivative of "${p.title}": ${v.toLowerCase()}. ${p.concept}`,
        front_placement: v === "Back-print edition" ? "Small chest mark" : "Centre chest",
        back_placement: v === "Back-print edition" ? "Full back" : null,
        sleeve_placement: null,
        colors: [palette[0]!.name, palette[1]!.name],
        typography: "Inherited from parent concept.",
        illustration_notes: `${DEMO_LABEL}`,
        printing_method: v.includes("Embroidered") ? "embroidery" : "screen_print",
        embroidery_suitability: v.includes("Embroidered") ? 9 : 5,
        liquid_3d_suitability: 4,
        preferred_products: v.includes("Embroidered") ? ["hat", "hoodie"] : ["tee", "hoodie"],
        target_buyer: "Buyers who responded to the parent design.",
        ...prompts(`${p.title} — ${v}`, p.concept, "lab"),
        visual_direction: "lab",
      })),
    };
  }

  let designs: Design[];
  let collections: CreativeOutput["collections"];
  if (aiSi) {
    collections = AI_SI_COLLECTIONS.map((c) => ({ name: c.name, description: c.description, theme: c.theme }));
    designs = AI_SI_DESIGNS.map((d, i) => ({
      title: d.title,
      collection: d.collection,
      concept: d.concept,
      front_placement: d.front,
      back_placement: d.back,
      sleeve_placement: d.sleeve,
      colors: i % 2 === 0 ? ["Bone on Void", "Signal accent"] : ["Void on Bone"],
      typography: "JetBrains Mono labels + Inter Tight display",
      illustration_notes: "Diagrammatic line work only. Sample concept — not finalised IP.",
      printing_method: d.method,
      embroidery_suitability: d.method.includes("embroidery") ? 9 : scoreBetween(rand, 3, 7),
      liquid_3d_suitability: scoreBetween(rand, 2, 8),
      preferred_products: d.method.includes("embroidery") ? ["hat", "hoodie"] : ["tee", "hoodie", "long_sleeve"],
      target_buyer: "Engineers, researchers and founders who follow AI closely",
      ...prompts(d.title, d.concept, i % 3 === 0 ? "lab" : i % 3 === 1 ? "signal" : "archive"),
      visual_direction: i % 3 === 0 ? "lab" : i % 3 === 1 ? "signal" : "archive",
    }));
  } else {
    const niche = titleCase(input.brand.niche);
    collections = [
      { name: "Core", description: `Everyday staples for ${niche.toLowerCase()}.`, theme: "Identity" },
      { name: "Heritage", description: "Insider references and era markers.", theme: "Belonging" },
      { name: "Crew", description: "Pieces designed for group orders.", theme: "Community" },
    ];
    const templates = [
      `${niche.toUpperCase()} // EST. NOW`,
      `CERTIFIED ${niche.split(" ")[0]?.toUpperCase() ?? "MEMBER"}`,
      `${niche.toUpperCase()} DEPARTMENT`,
      `FIELD NOTES: ${niche.toUpperCase()}`,
      `${niche.toUpperCase()} — SPEC SHEET`,
      `PROPERTY OF THE ${niche.toUpperCase()} CREW`,
    ];
    designs = templates.slice(0, Math.max(1, Math.min(input.design_count, templates.length))).map((t, i) => {
      const dir = pick(rand, ["lab", "signal", "archive"]);
      const collection = collections[i % collections.length]!.name;
      const concept = `Typographic concept "${t}" for the ${collection} collection. ${DEMO_LABEL}`;
      return {
        title: t,
        collection,
        concept,
        front_placement: "Left chest",
        back_placement: i % 2 === 0 ? "Full back" : null,
        sleeve_placement: null,
        colors: [palette[0]!.name, palette[1]!.name],
        typography: "Condensed grotesque + mono annotations",
        illustration_notes: "Typographic only.",
        printing_method: i % 3 === 2 ? "embroidery" : "dtg",
        embroidery_suitability: scoreBetween(rand, 3, 9),
        liquid_3d_suitability: scoreBetween(rand, 2, 8),
        preferred_products: ["tee", "hoodie", "hat"],
        target_buyer: `Members of the ${niche.toLowerCase()} community`,
        ...prompts(t, concept, dir),
        visual_direction: dir,
      };
    });
  }
  return { visual_directions: directions(aiSi, palette), recommended_direction: "lab", collections, designs: designs.slice(0, Math.max(1, input.design_count)) };
}
