import { describe, expect, it } from "vitest";
import {
  BRAND_STAGES,
  checkDirectTransition,
  directTargets,
  recommendedActions,
  requiredGate,
  stageGroup,
  transitionKind,
} from "@/domain/lifecycle";

describe("brand lifecycle", () => {
  it("follows the forward pipeline", () => {
    expect(transitionKind("idea", "researching")).toBe("allowed");
    expect(transitionKind("researching", "candidate")).toBe("allowed");
    expect(transitionKind("approved", "branding")).toBe("allowed");
    expect(transitionKind("creative", "product_selection")).toBe("allowed");
    expect(transitionKind("launch_ready", "testing")).toBe("allowed");
    expect(transitionKind("testing", "iterating")).toBe("allowed");
  });

  it("gates the human-approval transitions", () => {
    expect(transitionKind("candidate", "approved")).toBe("gated");
    expect(requiredGate("candidate", "approved")).toBe("opportunity_approval");
    expect(requiredGate("branding", "creative")).toBe("brand_identity_final");
    expect(requiredGate("product_selection", "store_build")).toBe("product_assortment");
    expect(requiredGate("store_build", "launch_ready")).toBe("store_launch");
    expect(requiredGate("testing", "scaling")).toBe("scale_approval");
    expect(requiredGate("iterating", "scaling")).toBe("scale_approval");
  });

  it("rejects skipping stages and self transitions", () => {
    expect(transitionKind("idea", "approved")).toBe("invalid");
    expect(transitionKind("researching", "launch_ready")).toBe("invalid");
    expect(transitionKind("testing", "testing")).toBe("invalid");
    expect(transitionKind("killed", "scaling")).toBe("invalid");
  });

  it("allows killing, pausing and archiving from active stages", () => {
    expect(transitionKind("creative", "killed")).toBe("allowed");
    expect(transitionKind("testing", "paused")).toBe("allowed");
    expect(transitionKind("killed", "archived")).toBe("allowed");
    expect(transitionKind("killed", "killed")).toBe("invalid");
    expect(transitionKind("archived", "paused")).toBe("invalid");
  });

  it("only resumes a paused brand to its previous stage", () => {
    expect(transitionKind("paused", "testing")).toBe("resume");
    expect(checkDirectTransition("paused", "testing", { pausedFrom: "testing" }).ok).toBe(true);
    const bad = checkDirectTransition("paused", "scaling", { pausedFrom: "testing" });
    expect(bad.ok).toBe(false);
  });

  it("refuses gated transitions as direct changes and names the gate", () => {
    const r = checkDirectTransition("store_build", "launch_ready");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gate).toBe("store_launch");
  });

  it("never offers gated targets as direct targets", () => {
    for (const from of BRAND_STAGES) {
      for (const to of directTargets(from)) expect(transitionKind(from, to)).not.toBe("gated");
    }
  });

  it("groups stages and recommends stage-specific actions", () => {
    expect(stageGroup("candidate")).toBe("discovery");
    expect(stageGroup("store_build")).toBe("development");
    expect(stageGroup("scaling")).toBe("live");
    expect(stageGroup("killed")).toBe("inactive");
    expect(recommendedActions("creative").map((a) => a.agent)).toContain("creative_director");
    expect(recommendedActions("killed")).toEqual([]);
  });
});
