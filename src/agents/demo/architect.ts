import type { ArchitectOutput } from "../schemas";
import { AI_SI_AVOID, AI_SI_BRAND_HYPOTHESES, AI_SI_COLLECTIONS } from "./ai-si";
import { DEMO_LABEL, isAiSiSubject, pick, scoreBetween, seededRandom, titleCase } from "./util";

type Candidate = ArchitectOutput["name_candidates"][number];

function candidate(name: string, rationale: string, rand: () => number): Candidate {
  const compact = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    name,
    rationale,
    memorability: scoreBetween(rand, 5, 9),
    spelling_risk: name.includes(" ") || name.includes("-") ? "medium" : "low",
    pronunciation_risk: "low",
    domain_candidates: [`${compact}.com`, `${compact}.co`, `wear${compact}.com`],
    handle_candidates: [compact.slice(0, 28), `${compact.slice(0, 24)}.lab`],
    collision_notes: "Not checked — demo mode performs no searches. Run a real search before shortlisting.",
    trademark_notes: "Preliminary only (demo): no registry search performed. This is not a trademark clearance.",
    trademark_risk: "medium",
    expansion_potential: scoreBetween(rand, 5, 9),
    visual_potential: scoreBetween(rand, 5, 9),
  };
}

export function demoArchitect(input: {
  brand: { working_title: string; niche: string; audience: string | null };
  hypothesis_names: string[];
  name_count: number;
}): ArchitectOutput {
  const rand = seededRandom(`architect|${input.brand.niche}`);
  const aiSi = isAiSiSubject(input.brand.niche) || isAiSiSubject(input.brand.working_title);
  const niche = titleCase(input.brand.niche);
  const root = niche.split(/\s+/)[0] ?? "Brand";

  const hypotheses = input.hypothesis_names.length ? input.hypothesis_names : aiSi ? [...AI_SI_BRAND_HYPOTHESES] : [];
  const generated = aiSi
    ? ["Latent Supply", "Weights & Measures", "Post-Training", "Frontier Issue", "Eval Division", "Gradient Dept."]
    : [`${root} Supply Co.`, `${root} Works`, `Field ${root}`, `${root} Standard`, `North ${root}`, `${root} Guild`, `Issue ${root}`, `${root} Division`];
  const names = [...new Set([...hypotheses, ...generated])].slice(0, Math.max(3, input.name_count));

  const palette = aiSi
    ? [
        { name: "Void", hex: "#0B0B0C", role: "primary background" },
        { name: "Bone", hex: "#EDEAE3", role: "primary text / light garments" },
        { name: "Graphite", hex: "#3A3B3E", role: "secondary" },
        { name: "Signal", hex: "#FF5A1F", role: "single accent (sparingly)" },
      ]
    : [
        { name: "Ink", hex: "#111214", role: "primary" },
        { name: "Chalk", hex: "#F2F0EB", role: "light" },
        { name: "Steel", hex: "#5B6470", role: "secondary" },
        { name: "Accent", hex: pick(rand, ["#E4572E", "#2E86AB", "#3BB273", "#E1BC29"]), role: "accent" },
      ];

  return {
    audience: input.brand.audience ?? `People who identify with ${niche}`,
    positioning: aiSi
      ? "The uniform of the intelligence transition: research-lab restraint and technical typography for people who take AI seriously. (Demo positioning.)"
      : `Premium, insider-coded apparel for ${niche.toLowerCase()} — made for people inside the community, not tourists. (Demo positioning.)`,
    archetype: aiSi ? "The Sage / The Explorer" : "The Everyman / The Craftsman",
    emotional_appeal: aiSi ? "Being early; belonging to the people who understand what is happening." : "Pride in the craft and belonging to the crew.",
    brand_story: `${DEMO_LABEL} A placeholder brand story for ${niche}: why the brand exists, who it is for and what it refuses to be.`,
    tone_of_voice: aiSi ? "Precise, understated, dry wit. Lab notes, not hype." : "Direct, confident, insider humour without cheap jokes.",
    visual_territory: aiSi
      ? "Research laboratory × premium streetwear: spec plates, measurement ticks, monospaced type, issued-equipment utility. Avoid: " + AI_SI_AVOID.join(", ") + "."
      : "Workwear heritage meets modern minimal typography; badges, spec labels and restrained colour.",
    tagline_candidates: aiSi
      ? ["Capability: unknown.", "Issued before the curve.", "Research in progress.", "Dress for the transition."]
      : [`Built for ${niche.toLowerCase()}.`, "Made by the crew, for the crew.", "Wear the work."],
    recommended_tagline: aiSi ? "Research in progress." : `Built for ${niche.toLowerCase()}.`,
    colors: palette,
    fonts: aiSi
      ? [
          { family: "JetBrains Mono", role: "technical / labels", rationale: "Monospaced lab-equipment feel." },
          { family: "Inter Tight", role: "headlines / wordmark", rationale: "Neutral, dense, premium." },
        ]
      : [
          { family: "Archivo", role: "headlines", rationale: "Sturdy grotesque with workwear character." },
          { family: "Inter", role: "body", rationale: "Legible, neutral." },
        ],
    product_collections: aiSi ? AI_SI_COLLECTIONS.map((c) => c.name) : ["Core", "Heritage", "Crew", "Limited"],
    expansion_paths: aiSi
      ? ["Sub-collections per theme (Alignment, Singularity)", "Collaborations with AI researchers/creators", "Desk objects: mugs, posters, stickers for labs"]
      : ["Sub-niche drops", "Personalised crew orders", "Accessories and gifts"],
    anti_positioning: aiSi
      ? ["A meme-shirt shop", "Cyberpunk cosplay", "Corporate AI logo merch", "Doom or hype propaganda"]
      : ["Generic joke-shirt store", "Cheap novelty gifts", "Anything that mocks the audience"],
    name_candidates: names.map((n, i) =>
      candidate(n, i < hypotheses.length ? `Existing hypothesis "${n}" evaluated as a candidate (demo rationale).` : `Generated candidate (demo) for ${niche}.`, rand),
    ),
    trademark_disclaimer: "Trademark notes are preliminary research indicators only — not legal advice and not a clearance. Consult a trademark attorney.",
  };
}
