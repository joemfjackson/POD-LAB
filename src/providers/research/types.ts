export type ResearchSourceType =
  | "web"
  | "search_engine"
  | "marketplace"
  | "social"
  | "reddit"
  | "search_trends"
  | "ecommerce_data";

export interface ResearchDocument {
  /** stable reference given to the model, e.g. "S3" */
  ref: string;
  url: string;
  title: string;
  snippet: string;
  publisher: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  sourceType: ResearchSourceType;
}

export interface ResearchProvider {
  readonly id: "none" | "tavily";
  readonly label: string;
  /** false → agents must label all findings as model knowledge / assumptions */
  readonly live: boolean;
  search(query: string, opts: { maxResults: number }): Promise<Omit<ResearchDocument, "ref">[]>;
}

/** Deduplicates by URL and assigns S1..Sn references. */
export function numberDocuments(docs: ReadonlyArray<Omit<ResearchDocument, "ref">>, limit = 40): ResearchDocument[] {
  const seen = new Set<string>();
  const out: ResearchDocument[] = [];
  for (const d of docs) {
    const key = d.url.replace(/[#?].*$/, "").replace(/\/+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...d, ref: `S${out.length + 1}` });
    if (out.length >= limit) break;
  }
  return out;
}

export function classifySourceType(url: string): ResearchSourceType {
  const host = (() => {
    try {
      return new URL(url).host.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (host.includes("reddit.com")) return "reddit";
  if (/(etsy|amazon|ebay|redbubble|teepublic|walmart)\./.test(host)) return "marketplace";
  if (/(tiktok|instagram|facebook|pinterest|x\.com|twitter|youtube|threads)\./.test(host)) return "social";
  if (host.includes("trends.google")) return "search_trends";
  return "web";
}
