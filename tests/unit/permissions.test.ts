import { describe, expect, it } from "vitest";
import { assignableRoles, can, canDecideGate, gateMinRole, roleAtLeast } from "@/domain/permissions";

describe("permissions", () => {
  it("orders roles owner > admin > editor > viewer", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("editor", "admin")).toBe(false);
    expect(roleAtLeast("viewer", "viewer")).toBe(true);
    expect(roleAtLeast(null, "viewer")).toBe(false);
  });

  it("maps permissions to minimum roles", () => {
    expect(can("viewer", "workspace.read")).toBe(true);
    expect(can("viewer", "agents.run")).toBe(false);
    expect(can("editor", "agents.run")).toBe(true);
    expect(can("editor", "agents.configure")).toBe(false);
    expect(can("admin", "providers.configure")).toBe(true);
    expect(can(undefined, "workspace.read")).toBe(false);
  });

  it("requires elevated roles for sensitive gates", () => {
    expect(gateMinRole("opportunity_approval")).toBe("editor");
    expect(gateMinRole("paid_campaign_spend")).toBe("admin");
    expect(gateMinRole("scale_approval")).toBe("admin");
    expect(gateMinRole("provider_credentials")).toBe("owner");
    expect(canDecideGate("editor", "design_production")).toBe(true);
    expect(canDecideGate("editor", "store_launch")).toBe(false);
    expect(canDecideGate("admin", "provider_credentials")).toBe(false);
    expect(canDecideGate("owner", "provider_credentials")).toBe(true);
  });

  it("never lets anyone assign the owner role", () => {
    expect(assignableRoles("owner")).not.toContain("owner");
    expect(assignableRoles("editor")).toEqual([]);
  });
});
