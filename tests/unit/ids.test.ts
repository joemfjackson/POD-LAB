import { describe, expect, it } from "vitest";
import { formatCode, parseCode } from "@/domain/ids";

describe("human-readable IDs", () => {
  it("pads to four digits", () => {
    expect(formatCode("PL", 1)).toBe("PL-0001");
    expect(formatCode("OPP", 42)).toBe("OPP-0042");
    expect(formatCode("EXP", 9999)).toBe("EXP-9999");
  });

  it("never truncates large numbers", () => {
    expect(formatCode("DES", 10000)).toBe("DES-10000");
    expect(formatCode("PL", 123456)).toBe("PL-123456");
  });

  it("validates prefix and number", () => {
    expect(() => formatCode("pl", 1)).toThrow();
    expect(() => formatCode("PL", 0)).toThrow();
    expect(() => formatCode("PL", 1.5)).toThrow();
  });

  it("parses loose input into canonical codes", () => {
    expect(parseCode("pl-1")).toEqual({ prefix: "PL", number: 1, entity: "brand", code: "PL-0001" });
    expect(parseCode(" OPP0012 ")?.code).toBe("OPP-0012");
    expect(parseCode("DES-0003")?.entity).toBe("design");
    expect(parseCode("XYZ-0003")?.entity).toBeNull();
    expect(parseCode("hello")).toBeNull();
    expect(parseCode("PL-0000")).toBeNull();
  });
});
