import { fetchWithTimeout } from "../errors";

export type AvailabilityStatus = "unknown" | "unverified" | "likely_available" | "taken" | "error";

export interface DomainCheck {
  domain: string;
  availability: AvailabilityStatus;
  method: string;
  checkedAt: string | null;
  note: string;
}

/**
 * Domain registration lookup via public RDAP (rdap.org bootstrap). A 404 means no
 * registration record was found — it is reported as "likely available", never
 * as guaranteed. When RDAP is disabled the status is "unverified".
 */
export async function checkDomain(domain: string, opts: { rdapEnabled: boolean }): Promise<DomainCheck> {
  const d = domain.trim().toLowerCase();
  if (!opts.rdapEnabled) {
    return { domain: d, availability: "unverified", method: "none", checkedAt: null, note: "Live domain lookup disabled (DOMAIN_RDAP_ENABLED=false). Verify with a registrar." };
  }
  try {
    const res = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(d)}`, {
      timeoutMs: 8000,
      headers: { accept: "application/rdap+json" },
      redirect: "follow",
    });
    const checkedAt = new Date().toISOString();
    if (res.status === 404) return { domain: d, availability: "likely_available", method: "rdap", checkedAt, note: "No RDAP registration record found. Confirm at a registrar before relying on it." };
    if (res.ok) return { domain: d, availability: "taken", method: "rdap", checkedAt, note: "RDAP registration record exists." };
    return { domain: d, availability: "error", method: "rdap", checkedAt, note: `RDAP lookup returned ${res.status}.` };
  } catch (e) {
    return { domain: d, availability: "error", method: "rdap", checkedAt: new Date().toISOString(), note: e instanceof Error ? e.message : "RDAP lookup failed" };
  }
}

export const HANDLE_PLATFORMS = ["instagram", "tiktok", "x", "pinterest", "youtube"] as const;

/** Profile URLs for manual verification — handle availability has no reliable public API. */
export function handleCheckUrl(platform: string, handle: string): string | null {
  const h = encodeURIComponent(handle);
  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${h}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${h}`;
    case "x":
      return `https://x.com/${h}`;
    case "pinterest":
      return `https://www.pinterest.com/${h}/`;
    case "youtube":
      return `https://www.youtube.com/@${h}`;
    case "threads":
      return `https://www.threads.net/@${h}`;
    case "facebook":
      return `https://www.facebook.com/${h}`;
    case "reddit":
      return `https://www.reddit.com/user/${h}`;
    default:
      return null;
  }
}

/** Preliminary trademark research links (USPTO / EUIPO / WIPO). Not a clearance. */
export function trademarkSearchLinks(term: string) {
  const q = encodeURIComponent(term);
  return [
    { label: "USPTO trademark search", url: `https://tmsearch.uspto.gov/search/search-results?query=${q}` },
    { label: "WIPO Global Brand Database", url: `https://branddb.wipo.int/en/quicksearch?by=brandName&v=${q}` },
    { label: "EUIPO eSearch", url: `https://euipo.europa.eu/eSearch/#basic/1+1+1+1/100+100+100+100/${q}` },
  ];
}

export function normalizeHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30) || "brand";
}
