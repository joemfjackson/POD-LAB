import type { AgentKey } from "@/domain/lifecycle";

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  description: string;
  businessQuestion: string;
  phase: 1 | 2 | 3 | 4 | 5;
  schemaVersion: string;
  outputType: string;
  defaultTemperature: number;
  defaultMaxOutputTokens: number;
  /** jobs of this agent are scoped to a brand */
  brandScoped: boolean;
}

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  {
    key: "director",
    name: "POD Lab Director",
    description: "Orchestrates missions and jobs, enforces approval gates, routes work between agents and writes operational briefings.",
    businessQuestion: "What should we do next?",
    phase: 1,
    schemaVersion: "director_output.v1",
    outputType: "operational_briefing",
    defaultTemperature: 0.3,
    defaultMaxOutputTokens: 3000,
    brandScoped: false,
  },
  {
    key: "opportunity_scout",
    name: "Opportunity Scout",
    description: "Discovers and investigates niches; scores ten dimensions with separated facts, signals, inferences and assumptions.",
    businessQuestion: "Is this market worth testing?",
    phase: 1,
    schemaVersion: "scout_output.v1",
    outputType: "opportunity_research",
    defaultTemperature: 0.4,
    defaultMaxOutputTokens: 16000,
    brandScoped: false,
  },
  {
    key: "brand_architect",
    name: "Brand Architect",
    description: "Positioning, audience, archetype, voice, name candidates with preliminary conflict research, taglines and identity.",
    businessQuestion: "What brand could own this niche?",
    phase: 1,
    schemaVersion: "architect_output.v1",
    outputType: "brand_strategy",
    defaultTemperature: 0.7,
    defaultMaxOutputTokens: 12000,
    brandScoped: true,
  },
  {
    key: "creative_director",
    name: "Creative Director",
    description: "Three visual directions, collections, production-ready design briefs, generation and mockup prompts, derivatives.",
    businessQuestion: "What would the audience actually want to wear or buy?",
    phase: 2,
    schemaVersion: "creative_output.v1",
    outputType: "creative_system",
    defaultTemperature: 0.8,
    defaultMaxOutputTokens: 16000,
    brandScoped: true,
  },
  {
    key: "ip_compliance",
    name: "IP / Compliance",
    description: "Screens concepts for trademark, character, celebrity, league and restricted-content problems. Not legal advice.",
    businessQuestion: "Is this safe enough to put in front of a human for production approval?",
    phase: 2,
    schemaVersion: "compliance_output.v1",
    outputType: "compliance_screening",
    defaultTemperature: 0.1,
    defaultMaxOutputTokens: 4000,
    brandScoped: true,
  },
  {
    key: "product_profit",
    name: "Product & Profit",
    description: "Selects blanks for approved designs, prices them and computes unit economics and recommendations.",
    businessQuestion: "Can we sell it profitably?",
    phase: 2,
    schemaVersion: "product_output.v1",
    outputType: "assortment",
    defaultTemperature: 0.3,
    defaultMaxOutputTokens: 6000,
    brandScoped: true,
  },
  {
    key: "store_builder",
    name: "Store Builder",
    description: "Builds the store package: pages, navigation, collections, product copy, SEO, FAQ, policies, upsells and bundles.",
    businessQuestion: "Can we present it credibly enough to convert?",
    phase: 3,
    schemaVersion: "store_output.v1",
    outputType: "store_package",
    defaultTemperature: 0.6,
    defaultMaxOutputTokens: 14000,
    brandScoped: true,
  },
  {
    key: "growth",
    name: "Growth Agent",
    description: "Channel strategy, 30-day content plan, hooks, scripts, influencer outreach, paid proposals and experiments.",
    businessQuestion: "How do we reach the right buyers?",
    phase: 4,
    schemaVersion: "growth_output.v1",
    outputType: "growth_plan",
    defaultTemperature: 0.7,
    defaultMaxOutputTokens: 14000,
    brandScoped: true,
  },
  {
    key: "trend_watcher",
    name: "Trend Watcher",
    description: "Recurring scans for emerging terms, communities, aesthetics and seasonal moments that feed the Scout.",
    businessQuestion: "What is emerging that we should look at?",
    phase: 4,
    schemaVersion: "trend_output.v1",
    outputType: "trend_scan",
    defaultTemperature: 0.5,
    defaultMaxOutputTokens: 8000,
    brandScoped: false,
  },
  {
    key: "experiment_analyst",
    name: "Experiment Analyst",
    description: "Applies configurable decision rules to experiment metrics and explains kill / iterate / clone / scale outcomes.",
    businessQuestion: "Did the market actually validate our hypothesis?",
    phase: 4,
    schemaVersion: "analyst_output.v1",
    outputType: "experiment_analysis",
    defaultTemperature: 0.2,
    defaultMaxOutputTokens: 6000,
    brandScoped: false,
  },
];

export const AGENT_BY_KEY: Record<AgentKey, AgentDefinition> = Object.fromEntries(
  AGENT_DEFINITIONS.map((a) => [a.key, a]),
) as Record<AgentKey, AgentDefinition>;

export function isAgentKey(v: string): v is AgentKey {
  return v in AGENT_BY_KEY;
}
