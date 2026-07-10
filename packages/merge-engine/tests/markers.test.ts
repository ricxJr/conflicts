import { describe, expect, it } from "vitest";
import { hasConflictMarkers, parseConflictMarkers } from "../src/markers";

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
