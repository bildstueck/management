import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Kunde GmbH")).toBe("kunde-gmbh");
  });

  it("strips characters that aren't letters, numbers, spaces or hyphens", () => {
    expect(slugify("Café & Bar!")).toBe("caf-bar");
  });

  it("collapses repeated hyphens and trims leading/trailing ones", () => {
    expect(slugify("  --Multi   Space--  ")).toBe("multi-space");
  });

  it("returns an empty string for input with nothing sluggable", () => {
    expect(slugify("!!!")).toBe("");
  });
});
