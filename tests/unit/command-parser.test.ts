import { describe, expect, it } from "vitest";
import { parseCommand } from "@/domain/command-parser";

describe("command parser", () => {
  it("creates research missions with capped counts", () => {
    expect(parseCommand("Research 15 HVAC-related niches.")).toMatchObject({ type: "create_mission", maxCandidates: 15 });
    expect(parseCommand("Find twenty emerging identity-based POD niches")).toMatchObject({ type: "create_mission", maxCandidates: 20 });
    expect(parseCommand("Research 500 niches", { maxCandidates: 25 })).toMatchObject({ maxCandidates: 25 });
    expect(parseCommand("Investigate whether AI is a strong POD market")).toMatchObject({ type: "create_mission", maxCandidates: 10 });
  });

  it("opens records by human-readable ID", () => {
    expect(parseCommand("Open PL-0001")).toEqual({ type: "open_code", code: "PL-0001", entity: "brand" });
    expect(parseCommand("des-12")).toEqual({ type: "open_code", code: "DES-0012", entity: "design" });
  });

  it("runs named agents against a target", () => {
    expect(parseCommand("Run Brand Architect for AI/SI")).toEqual({ type: "run_agent", agent: "brand_architect", target: "AI/SI" });
    expect(parseCommand("run creative director on PL-0001")).toMatchObject({ agent: "creative_director", target: "PL-0001" });
    expect(parseCommand("run experiment analyst")).toMatchObject({ agent: "experiment_analyst", target: "" });
  });

  it("maps views to navigation", () => {
    expect(parseCommand("Show designs awaiting approval")).toMatchObject({ type: "navigate", href: "/design-studio?status=review" });
    expect(parseCommand("Compare active experiments")).toMatchObject({ type: "navigate", href: "/experiments?status=running" });
  });

  it("falls back to search and ignores empty input", () => {
    expect(parseCommand("recursive hoodie")).toEqual({ type: "search", query: "recursive hoodie" });
    expect(parseCommand("   ")).toBeNull();
  });
});
