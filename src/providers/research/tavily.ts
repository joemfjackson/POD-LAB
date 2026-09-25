import { ProviderNotConfiguredError, ProviderTransientError, fetchWithTimeout } from "../errors";
import { classifySourceType, type ResearchProvider } from "./types";

interface TavilyResponse {
  results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
}

/** Tavily Search API (https://docs.tavily.com). Only returns what the API returns. */
export class TavilyResearchProvider implements ResearchProvider {
  readonly id = "tavily" as const;
  readonly label = "Tavily web search";
  readonly live = true;

  constructor(private readonly apiKey: string | undefined) {}

  async search(query: string, opts: { maxResults: number }) {
    if (!this.apiKey) throw new ProviderNotConfiguredError("Tavily", "set RESEARCH_API_KEY");
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      timeoutMs: 30_000,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query, max_results: Math.min(Math.max(opts.maxResults, 1), 20), search_depth: "basic" }),
    });
    if (res.status === 429 || res.status >= 500) throw new ProviderTransientError(`Tavily returned ${res.status}`);
    if (!res.ok) throw new Error(`Tavily returned ${res.status}`);
    const json = (await res.json()) as TavilyResponse;
    const retrievedAt = new Date().toISOString();
    return (json.results ?? [])
      .filter((r): r is { title?: string; url: string; content?: string; published_date?: string } => typeof r.url === "string" && /^https?:\/\//.test(r.url))
      .map((r) => ({
        url: r.url,
        title: (r.title ?? r.url).slice(0, 300),
        snippet: (r.content ?? "").slice(0, 1200),
        publisher: (() => {
          try {
            return new URL(r.url).host.replace(/^www\./, "");
          } catch {
            return null;
          }
        })(),
        publishedAt: r.published_date && !Number.isNaN(Date.parse(r.published_date)) ? new Date(r.published_date).toISOString() : null,
        retrievedAt,
        sourceType: classifySourceType(r.url),
      }));
  }
}
