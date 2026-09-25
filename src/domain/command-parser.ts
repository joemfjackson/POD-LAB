/**
 * Command bar parser. Maps natural-ish commands to a closed set of structured
 * actions. There is no evaluation of arbitrary input — unknown commands fall
 * back to a search.
 */
import { parseCode } from "./ids";
import type { AgentKey } from "./lifecycle";

export type CommandAction =
  | { type: "create_mission"; title: string; prompt: string; maxCandidates: number }
  | { type: "open_code"; code: string; entity: string | null }
  | { type: "run_agent"; agent: AgentKey; target: string }
  | { type: "navigate"; href: string; label: string }
  | { type: "search"; query: string };

const AGENT_ALIASES: Array<{ agent: AgentKey; patterns: RegExp[] }> = [
  { agent: "opportunity_scout", patterns: [/opportunity\s*scout/, /\bscout\b/] },
  { agent: "brand_architect", patterns: [/brand\s*architect/, /\barchitect\b/] },
  { agent: "creative_director", patterns: [/creative\s*director/, /\bcreative\b/] },
  { agent: "product_profit", patterns: [/product\s*(?:&|and)?\s*profit/, /profit\s*agent/, /\bproduct agent\b/] },
  { agent: "ip_compliance", patterns: [/\bcompliance\b/, /\bip\b/] },
  { agent: "store_builder", patterns: [/store\s*builder/] },
  { agent: "growth", patterns: [/\bgrowth\b/] },
  { agent: "trend_watcher", patterns: [/trend\s*watcher/, /\btrends?\b/] },
  { agent: "experiment_analyst", patterns: [/experiment\s*analyst/, /\banalyst\b/] },
  { agent: "director", patterns: [/\bdirector\b/] },
];

const NAV: Array<{ patterns: RegExp[]; href: string; label: string }> = [
  { patterns: [/designs?\s+(?:awaiting|pending|needing|for)\s+(?:approval|review)/, /pending designs/], href: "/design-studio?status=review", label: "Designs awaiting approval" },
  { patterns: [/compare\s+(?:active\s+)?experiments/, /active experiments/], href: "/experiments?status=running", label: "Active experiments" },
  { patterns: [/approvals?/, /pending approvals/], href: "/approvals", label: "Approval requests" },
  { patterns: [/^(?:show|open|go to)?\s*dashboard$/], href: "/dashboard", label: "Dashboard" },
  { patterns: [/^(?:show|open|go to)?\s*opportunities$/], href: "/opportunities", label: "Opportunities" },
  { patterns: [/^(?:show|open|go to)?\s*brands$/], href: "/brands", label: "Brands" },
  { patterns: [/^(?:show|open|go to)?\s*agents$/, /agent (?:history|activity)/], href: "/agents", label: "Agents" },
  { patterns: [/^(?:show|open|go to)?\s*reports?$/, /portfolio/], href: "/reports", label: "Reports" },
  { patterns: [/^(?:show|open|go to)?\s*trends$/], href: "/trends", label: "Trends" },
  { patterns: [/^(?:show|open|go to)?\s*insights$/], href: "/insights", label: "Insights" },
  { patterns: [/^(?:show|open|go to)?\s*products$/, /catalog/], href: "/products", label: "Products" },
  { patterns: [/^(?:show|open|go to)?\s*stores$/], href: "/stores", label: "Stores" },
  { patterns: [/^(?:show|open|go to)?\s*settings$/], href: "/settings", label: "Settings" },
  { patterns: [/notifications?/, /alerts/], href: "/notifications", label: "Notifications" },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50,
};

export function parseCommand(raw: string, opts: { maxCandidates?: number } = {}): CommandAction | null {
  const input = raw.trim().replace(/[.!?]+$/, "");
  if (input.length === 0) return null;
  if (input.length > 500) return { type: "search", query: input.slice(0, 200) };
  const lower = input.toLowerCase();
  const cap = opts.maxCandidates ?? 50;

  // "Open PL-0001" / "PL-0001"
  const openMatch = /^(?:open|show|go to)?\s*([a-z]{2,5}-?\d{1,9})$/i.exec(input);
  if (openMatch?.[1]) {
    const parsed = parseCode(openMatch[1]);
    if (parsed) return { type: "open_code", code: parsed.code, entity: parsed.entity };
  }

  // "Research 15 HVAC-related niches" / "Find twenty emerging niches"
  const research = /^(?:research|find|discover|investigate|scout)\s+(?:(\d{1,3}|[a-z]+)\s+)?(.+)$/i.exec(input);
  if (research) {
    const qty = research[1];
    let n: number | null = null;
    let subject = research[2] ?? "";
    if (qty) {
      if (/^\d+$/.test(qty)) n = Number.parseInt(qty, 10);
      else if (NUMBER_WORDS[qty.toLowerCase()] !== undefined) n = NUMBER_WORDS[qty.toLowerCase()]!;
      else subject = `${qty} ${subject}`;
    }
    const isRunAgent = /^(?:run\b)/i.test(input);
    if (!isRunAgent && subject.trim().length >= 3) {
      const count = Math.min(Math.max(n ?? 10, 1), cap);
      const title = `${capitalize(research[0].split(/\s+/)[0] ?? "Research")} ${n ? `${count} ` : ""}${subject.trim()}`;
      return { type: "create_mission", title: title.slice(0, 300), prompt: input, maxCandidates: count };
    }
  }

  // "Run Brand Architect for AI/SI" / "Run scout on PL-0002"
  const run = /^run\s+(.+?)(?:\s+(?:for|on)\s+(.+))?$/i.exec(input);
  if (run?.[1]) {
    const agentText = run[1].toLowerCase();
    const found = AGENT_ALIASES.find((a) => a.patterns.some((p) => p.test(agentText)));
    if (found) return { type: "run_agent", agent: found.agent, target: (run[2] ?? "").trim() };
  }

  for (const nav of NAV) {
    if (nav.patterns.some((p) => p.test(lower))) return { type: "navigate", href: nav.href, label: nav.label };
  }

  return { type: "search", query: input };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
