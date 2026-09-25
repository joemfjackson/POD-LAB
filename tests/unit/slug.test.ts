import { describe, expect, it } from "vitest";
import { nicheKey, slugify, uniqueSlug } from "@/domain/slug";

describe("slugs and niche keys", () => {
  it("slugifies", () => {
    expect(slugify("Human // Machine")).toBe("human-machine");
    expect(slugify("AI → AGI → ASI → ?")).toBe("ai-agi-asi");
    expect(slugify("Café & Co")).toBe("cafe-and-co");
    expect(slugify("!!!")).toBe("item");
  });

  it("allocates unique slugs", () => {
    expect(uniqueSlug("Tee", ["tee", "tee-2"])).toBe("tee-3");
    expect(uniqueSlug("Hat", [])).toBe("hat");
  });

  it("normalises niches so duplicates are detected", () => {
    expect(nicheKey("Balloon Artists")).toBe(nicheKey("balloon artist"));
    expect(nicheKey("The Nurses niche")).toBe(nicheKey("nurses"));
    expect(nicheKey("Dog breeds: Corgis")).toBe(nicheKey("corgi dog breed"));
    expect(nicheKey("Glass")).toBe("glass");
  });
});
