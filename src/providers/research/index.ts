import "server-only";
import { serverEnv } from "@/lib/env";
import { NoResearchProvider } from "./none";
import { TavilyResearchProvider } from "./tavily";
import type { ResearchProvider } from "./types";

export type { ResearchDocument, ResearchProvider } from "./types";

export function getResearchProvider(overrides: { apiKey?: string | null } = {}): ResearchProvider {
  const env = serverEnv();
  if (env.RESEARCH_PROVIDER === "tavily") return new TavilyResearchProvider(overrides.apiKey ?? env.RESEARCH_API_KEY);
  return new NoResearchProvider();
}
