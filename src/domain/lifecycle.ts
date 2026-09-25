/**
 * Brand lifecycle state machine.
 *
 * This mirrors `public.brand_stage_transition_kind()` in the database. The
 * integration suite compares both implementations for every stage pair, so a
 * change here must be made in a migration too.
 */

export const BRAND_STAGES = [
  "idea",
  "researching",
  "candidate",
  "approved",
  "branding",
  "creative",
  "product_selection",
  "store_build",
  "launch_ready",
  "testing",
  "iterating",
  "scaling",
  "paused",
  "killed",
  "archived",
] as const;

export type BrandStage = (typeof BRAND_STAGES)[number];

export type TransitionKind = "allowed" | "gated" | "resume" | "invalid";

export type GateType =
  | "opportunity_approval"
  | "brand_name_final"
  | "brand_identity_final"
  | "design_production"
  | "compliance_override"
  | "product_assortment"
  | "store_launch"
  | "paid_campaign_spend"
  | "scale_approval"
  | "provider_credentials"
  | "destructive_action";

export const STAGE_LABELS: Record<BrandStage, string> = {
  idea: "Idea",
  researching: "Researching",
  candidate: "Candidate",
  approved: "Approved",
  branding: "Branding",
  creative: "Creative",
  product_selection: "Product selection",
  store_build: "Store build",
  launch_ready: "Launch ready",
  testing: "Testing",
  iterating: "Iterating",
  scaling: "Scaling",
  paused: "Paused",
  killed: "Killed",
  archived: "Archived",
};

/** Main forward pipeline, in order (excludes side states). */
export const PIPELINE_STAGES: readonly BrandStage[] = [
  "idea",
  "researching",
  "candidate",
  "approved",
  "branding",
  "creative",
  "product_selection",
  "store_build",
  "launch_ready",
  "testing",
  "iterating",
  "scaling",
];

const RESUMABLE: ReadonlySet<BrandStage> = new Set([
  "researching",
  "candidate",
  "approved",
  "branding",
  "creative",
  "product_selection",
  "store_build",
  "launch_ready",
  "testing",
  "iterating",
  "scaling",
]);

const ALLOWED: Readonly<Partial<Record<BrandStage, readonly BrandStage[]>>> = {
  idea: ["researching"],
  researching: ["candidate", "idea"],
  candidate: ["researching"],
  approved: ["branding"],
  creative: ["product_selection", "branding"],
  product_selection: ["creative"],
  store_build: ["product_selection"],
  launch_ready: ["testing", "store_build"],
  testing: ["iterating"],
  iterating: ["testing", "creative", "product_selection", "store_build"],
  scaling: ["testing", "iterating"],
  killed: ["idea"],
  archived: ["idea"],
};

const GATED: ReadonlyArray<{ from: BrandStage; to: BrandStage; gate: GateType }> = [
  { from: "candidate", to: "approved", gate: "opportunity_approval" },
  { from: "branding", to: "creative", gate: "brand_identity_final" },
  { from: "product_selection", to: "store_build", gate: "product_assortment" },
  { from: "store_build", to: "launch_ready", gate: "store_launch" },
  { from: "testing", to: "scaling", gate: "scale_approval" },
  { from: "iterating", to: "scaling", gate: "scale_approval" },
];

export function transitionKind(from: BrandStage, to: BrandStage): TransitionKind {
  if (from === to) return "invalid";
  if (GATED.some((g) => g.from === from && g.to === to)) return "gated";
  if (to === "killed" && from !== "killed" && from !== "archived") return "allowed";
  if (to === "archived") return "allowed";
  if (to === "paused" && from !== "paused" && from !== "killed" && from !== "archived") return "allowed";
  if (ALLOWED[from]?.includes(to)) return "allowed";
  if (from === "paused" && RESUMABLE.has(to)) return "resume";
  return "invalid";
}

export function requiredGate(from: BrandStage, to: BrandStage): GateType | null {
  return GATED.find((g) => g.from === from && g.to === to)?.gate ?? null;
}

export type TransitionCheck =
  | { ok: true; kind: "allowed" | "resume" }
  | { ok: false; reason: string; gate?: GateType };

/**
 * Validates a direct (human or system) stage change. Gated transitions are
 * rejected here because they may only happen through an approval decision.
 */
export function checkDirectTransition(
  from: BrandStage,
  to: BrandStage,
  opts: { pausedFrom?: BrandStage | null } = {},
): TransitionCheck {
  const kind = transitionKind(from, to);
  if (kind === "invalid") {
    return { ok: false, reason: `Cannot move a brand from ${STAGE_LABELS[from]} to ${STAGE_LABELS[to]}.` };
  }
  if (kind === "gated") {
    const gate = requiredGate(from, to) ?? undefined;
    return {
      ok: false,
      gate,
      reason: `${STAGE_LABELS[from]} → ${STAGE_LABELS[to]} requires human approval (${gate}).`,
    };
  }
  if (kind === "resume" && opts.pausedFrom !== to) {
    return {
      ok: false,
      reason: `A paused brand can only resume to the stage it was paused from${
        opts.pausedFrom ? ` (${STAGE_LABELS[opts.pausedFrom]})` : ""
      }.`,
    };
  }
  return { ok: true, kind };
}

/** Stages reachable from `from` without an approval gate. */
export function directTargets(from: BrandStage, pausedFrom?: BrandStage | null): BrandStage[] {
  return BRAND_STAGES.filter((to) => checkDirectTransition(from, to, { pausedFrom }).ok);
}

export type StageGroup = "discovery" | "development" | "live" | "inactive";

export function stageGroup(stage: BrandStage): StageGroup {
  switch (stage) {
    case "idea":
    case "researching":
    case "candidate":
      return "discovery";
    case "approved":
    case "branding":
    case "creative":
    case "product_selection":
    case "store_build":
    case "launch_ready":
      return "development";
    case "testing":
    case "iterating":
    case "scaling":
      return "live";
    case "paused":
    case "killed":
    case "archived":
      return "inactive";
  }
}

export type AgentKey =
  | "director"
  | "opportunity_scout"
  | "brand_architect"
  | "creative_director"
  | "product_profit"
  | "ip_compliance"
  | "store_builder"
  | "growth"
  | "trend_watcher"
  | "experiment_analyst";

export interface StageAction {
  label: string;
  description: string;
  agent?: AgentKey;
  gate?: GateType;
}

/**
 * What the Director recommends next for a brand in a given stage. The UI shows
 * these as stage-aware action buttons; agents never run automatically from here.
 */
export function recommendedActions(stage: BrandStage): StageAction[] {
  switch (stage) {
    case "idea":
      return [{ label: "Start research", description: "Move to researching and run Opportunity Scout.", agent: "opportunity_scout" }];
    case "researching":
      return [{ label: "Run Opportunity Scout", description: "Investigate the niche and score it.", agent: "opportunity_scout" }];
    case "candidate":
      return [{ label: "Review opportunity", description: "A human must approve the opportunity.", gate: "opportunity_approval" }];
    case "approved":
    case "branding":
      return [
        { label: "Run Brand Architect", description: "Positioning, names, identity candidates.", agent: "brand_architect" },
        { label: "Approve identity", description: "Final identity unlocks creative work.", gate: "brand_identity_final" },
      ];
    case "creative":
      return [
        { label: "Run Creative Director", description: "Visual directions, collections, design concepts.", agent: "creative_director" },
        { label: "Run IP / Compliance", description: "Screen concepts for obvious IP problems.", agent: "ip_compliance" },
      ];
    case "product_selection":
      return [
        { label: "Run Product & Profit", description: "Select blanks and compute unit economics.", agent: "product_profit" },
        { label: "Approve assortment", description: "Approved products unlock the store build.", gate: "product_assortment" },
      ];
    case "store_build":
      return [
        { label: "Run Store Builder", description: "Generate pages, SEO and merchandising.", agent: "store_builder" },
        { label: "Approve launch", description: "Launch approval is required before going live.", gate: "store_launch" },
      ];
    case "launch_ready":
      return [{ label: "Run Growth Agent", description: "Launch plan, content calendar, experiments.", agent: "growth" }];
    case "testing":
    case "iterating":
      return [
        { label: "Run Experiment Analyst", description: "Classify experiments against decision rules.", agent: "experiment_analyst" },
      ];
    case "scaling":
      return [{ label: "Run Growth Agent", description: "Expand winning channels (spend requires approval).", agent: "growth" }];
    case "paused":
    case "killed":
    case "archived":
      return [];
  }
}
