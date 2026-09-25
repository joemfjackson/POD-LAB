import { describe, expect, it } from "vitest";
import { normalizeEvidence } from "@/agents/handlers/opportunity-scout";
import { classifySourceType, numberDocuments } from "@/providers/research/types";

const doc = (url: string) => ({ url, title: url, snippet: "", publisher: null, publishedAt: null, retrievedAt: "2026-09-25T00:00:00Z", sourceType: "web" as const });

describe("evidence normalisation", () => {
  const sources = numberDocuments([doc("https://a.com/x"), doc("https://a.com/x#frag"), doc("https://b.com/y")]);

  it("dedupes and numbers retrieved sources", () => {
    expect(sources.map((s) => s.ref)).toEqual(["S1", "S2"]);
  });

  it("keeps sourced facts and maps them to retrieved URLs", () => {
    const [e] = normalizeEvidence([{ claim: "c", kind: "measured_fact", source_ref: "S2", quote_snippet: "q", confidence: "high" }], sources);
    expect(e).toMatchObject({ kind: "measured_fact", quote: "q", confidence: "high" });
    expect(e!.source?.url).toBe("https://b.com/y");
  });

  it("downgrades unsourced or fabricated-reference facts to assumptions", () => {
    const out = normalizeEvidence(
      [
        { claim: "no ref", kind: "observed_signal", source_ref: null, quote_snippet: "q", confidence: "high" },
        { claim: "bad ref", kind: "measured_fact", source_ref: "S9", quote_snippet: null, confidence: "medium" },
      ],
      sources,
    );
    expect(out.every((e) => e.kind === "assumption" && e.source === null && e.confidence === "low" && e.quote === null)).toBe(true);
    expect(out[0]!.claim).toMatch(/unverified/);
  });

  it("keeps inferences and assumptions as labelled", () => {
    const [e] = normalizeEvidence([{ claim: "i", kind: "inferred_conclusion", source_ref: null, quote_snippet: null, confidence: "medium" }], sources);
    expect(e!.kind).toBe("inferred_conclusion");
  });

  it("classifies source types by host", () => {
    expect(classifySourceType("https://www.reddit.com/r/x")).toBe("reddit");
    expect(classifySourceType("https://www.etsy.com/listing/1")).toBe("marketplace");
    expect(classifySourceType("https://www.tiktok.com/@x")).toBe("social");
    expect(classifySourceType("https://example.com")).toBe("web");
  });
});
