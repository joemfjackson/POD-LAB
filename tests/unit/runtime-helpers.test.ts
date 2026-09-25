import { describe, expect, it } from "vitest";
import { AGENT_DEFINITIONS } from "@/agents/registry";
import { ACTIVE_PROMPT_VERSION, PROMPTS, activePrompt } from "@/agents/prompts/registry";
import { defaultDedupeKey, retryDelaySeconds } from "@/agents/runtime/queue";
import { HANDLERS } from "@/agents/handlers";
import { estimateCostUsd, estimateTokens } from "@/providers/ai/types";
import { defaultPayload } from "@/server/services/agent-defaults";

describe("agent registry & prompts", () => {
  it("registers a handler and an active versioned prompt for every agent", () => {
    for (const a of AGENT_DEFINITIONS) {
      expect(HANDLERS[a.key].key).toBe(a.key);
      const p = activePrompt(a.key);
      expect(p.id).toBe(`${a.key}_v${ACTIVE_PROMPT_VERSION[a.key]}`);
      expect(p.system).toMatch(/Never fabricate market evidence/);
    }
    expect(Object.keys(PROMPTS)).toContain("opportunity_scout_v1");
  });

  it("builds default payloads that pass each agent's schema", () => {
    const brand = { id: "11111111-1111-4111-8111-111111111111", niche: "nurses", opportunity_id: null };
    for (const a of AGENT_DEFINITIONS) {
      const payload = defaultPayload(a.key, a.brandScoped || a.key === "opportunity_scout" ? brand : null);
      expect(HANDLERS[a.key].payloadSchema.safeParse(payload).success, a.key).toBe(true);
    }
  });
});

describe("queue & cost helpers", () => {
  it("dedupe keys are stable per payload and target", () => {
    const a = defaultDedupeKey({ agentKey: "growth", payload: { brand_id: "x" }, brandId: "b" });
    expect(a).toBe(defaultDedupeKey({ agentKey: "growth", payload: { brand_id: "x" }, brandId: "b" }));
    expect(a).not.toBe(defaultDedupeKey({ agentKey: "growth", payload: { brand_id: "y" }, brandId: "b" }));
  });

  it("backs off exponentially with a cap", () => {
    expect([1, 2, 3].map(retryDelaySeconds)).toEqual([30, 60, 120]);
    expect(retryDelaySeconds(20)).toBe(3600);
  });

  it("estimates tokens and cost", () => {
    expect(estimateTokens("abcd".repeat(100))).toBe(100);
    expect(estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 500_000 }, { inputPerMTok: 0.4, outputPerMTok: 1.6 })).toBe(1.2);
  });
});
