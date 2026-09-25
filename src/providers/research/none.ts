import type { ResearchProvider } from "./types";

/** No live research configured: returns nothing, never invents sources. */
export class NoResearchProvider implements ResearchProvider {
  readonly id = "none" as const;
  readonly label = "No live research provider";
  readonly live = false;
  async search() {
    return [];
  }
}
