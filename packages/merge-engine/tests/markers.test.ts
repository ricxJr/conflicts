import { describe, expect, it } from "vitest";
import { hasConflictMarkers, parseConflictMarkers, reconstructSides } from "../src/markers";

describe("parseConflictMarkers", () => {
  it("parses a standard region", () => {
    const lines = [
      "before",
      "<<<<<<< HEAD",
      "mine",
      "=======",
      "theirs",
      ">>>>>>> feature/x",
      "after",
    ];
    const { regions, diagnostics } = parseConflictMarkers(lines);
    expect(diagnostics).toHaveLength(0);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({
      startLine: 1,
      endLine: 5,
      currentLabel: "HEAD",
      incomingLabel: "feature/x",
      currentLines: ["mine"],
      incomingLines: ["theirs"],
    });
  });

  it("parses diff3 regions with a base section", () => {
    const lines = [
      "<<<<<<< ours",
      "mine",
      "||||||| base",
      "orig",
      "=======",
      "theirs",
      ">>>>>>> theirs",
    ];
    const { regions, diagnostics } = parseConflictMarkers(lines);
    expect(diagnostics).toHaveLength(0);
    expect(regions[0].baseLines).toEqual(["orig"]);
    expect(regions[0].baseLabel).toBe("base");
  });

  it("reports nested markers", () => {
    const lines = ["<<<<<<< a", "<<<<<<< b", "x", "=======", "y", ">>>>>>> c"];
    const { diagnostics } = parseConflictMarkers(lines);
    expect(diagnostics.some((d) => d.includes("Nested"))).toBe(true);
  });

  it("reports unterminated regions", () => {
    const { diagnostics } = parseConflictMarkers(["<<<<<<< a", "x", "======="]);
    expect(diagnostics.some((d) => d.includes("Unterminated"))).toBe(true);
  });

  it("reports stray end markers", () => {
    const { diagnostics } = parseConflictMarkers([">>>>>>> x"]);
    expect(diagnostics.some((d) => d.includes("Unexpected"))).toBe(true);
  });

  it("hasConflictMarkers detects markers", () => {
    expect(hasConflictMarkers(["a", "<<<<<<< x"])).toBe(true);
    expect(hasConflictMarkers(["a", "b"])).toBe(false);
  });
});

describe("reconstructSides", () => {
  it("rebuilds sides from standard markers, sharing the context", () => {
    const sides = reconstructSides([
      "before",
      "<<<<<<< HEAD",
      "mine",
      "=======",
      "theirs",
      ">>>>>>> feature/x",
      "after",
    ]);
    expect(sides).not.toBeNull();
    expect(sides?.currentLines).toEqual(["before", "mine", "after"]);
    expect(sides?.incomingLines).toEqual(["before", "theirs", "after"]);
    // No base section: the base keeps only the shared context.
    expect(sides?.baseLines).toEqual(["before", "after"]);
    expect(sides?.currentLabel).toBe("HEAD");
    expect(sides?.incomingLabel).toBe("feature/x");
  });

  it("uses the base section of diff3 markers", () => {
    const sides = reconstructSides([
      "<<<<<<< ours",
      "mine",
      "||||||| base",
      "orig",
      "=======",
      "theirs",
      ">>>>>>> theirs",
      "tail",
    ]);
    expect(sides?.baseLines).toEqual(["orig", "tail"]);
    expect(sides?.currentLines).toEqual(["mine", "tail"]);
    expect(sides?.incomingLines).toEqual(["theirs", "tail"]);
  });

  it("handles multiple regions", () => {
    const sides = reconstructSides([
      "a",
      "<<<<<<< HEAD",
      "x1",
      "=======",
      "y1",
      ">>>>>>> other",
      "b",
      "<<<<<<< HEAD",
      "x2",
      "=======",
      "y2",
      ">>>>>>> other",
      "c",
    ]);
    expect(sides?.currentLines).toEqual(["a", "x1", "b", "x2", "c"]);
    expect(sides?.incomingLines).toEqual(["a", "y1", "b", "y2", "c"]);
    expect(sides?.baseLines).toEqual(["a", "b", "c"]);
  });

  it("returns null without a complete region", () => {
    expect(reconstructSides(["a", "b"])).toBeNull();
    expect(reconstructSides(["<<<<<<< a", "x", "======="])).toBeNull();
  });
});
