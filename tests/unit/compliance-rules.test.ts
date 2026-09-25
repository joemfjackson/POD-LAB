import { describe, expect, it } from "vitest";
import { COMPLIANCE_DISCLAIMER, maxRisk, screenConcept } from "@/domain/compliance-rules";

describe("compliance screening", () => {
  it("clears original concepts", () => {
    const r = screenConcept({ title: "THE CURVE GOES VERTICAL", concept: "Exponential curve in technical type" });
    expect(r.status).toBe("clear");
    expect(r.riskLevel).toBe("none");
    expect(r.disclaimer).toBe(COMPLIANCE_DISCLAIMER);
  });

  it("flags company names, characters and leagues", () => {
    const r = screenConcept({ title: "ChatGPT Research Division", concept: "Skynet style robot for NFL fans" });
    const cats = r.issues.map((i) => i.category);
    expect(cats).toEqual(expect.arrayContaining(["company_name", "copyrighted_character", "sports_team"]));
    expect(r.riskLevel).toBe("high");
    expect(r.issues[0]!.actionRequired.length).toBeGreaterThan(0);
  });

  it("matches whole terms only", () => {
    expect(screenConcept({ title: "Affordable nflx", concept: "marvelous nfl-free design" }).issues.map((i) => i.matchedTerm)).toEqual(["nfl"]);
    expect(screenConcept({ title: "Marvelous tee" }).status).toBe("clear");
  });

  it("escalates restricted content to critical", () => {
    expect(screenConcept({ title: "swastika print" }).riskLevel).toBe("critical");
  });

  it("orders risk levels", () => {
    expect(maxRisk(["low", "high", "medium"])).toBe("high");
    expect(maxRisk([])).toBe("none");
  });
});
