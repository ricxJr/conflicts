import { describe, expect, it } from "vitest";
import {
  analyzeMerge,
  buildResult,
  computeLineDiff,
  joinLines,
  resolutionOutput,
  splitLines,
  type ConflictGroup,
  type Resolution,
} from "../src/index";

const resolve = (strategy: Resolution["strategy"], manualLines?: string[]): Resolution => ({
  strategy,
  manualLines,
  updatedAt: new Date().toISOString(),
});

const asResolved = (group: ConflictGroup, resolution: Resolution): ConflictGroup => ({
  ...group,
  status: "resolved",
  resolution,
});

describe("computeLineDiff", () => {
  it("detects an insertion", () => {
    const hunks = computeLineDiff(["a", "b"], ["a", "x", "b"], "current");
    expect(hunks).toHaveLength(1);
    expect(hunks[0].kind).toBe("insert");
    expect(hunks[0].baseRange).toEqual({ start: 1, end: 1 });
    expect(hunks[0].modifiedLines).toEqual(["x"]);
  });

  it("detects a deletion", () => {
    const hunks = computeLineDiff(["a", "b", "c"], ["a", "c"], "current");
    expect(hunks).toHaveLength(1);
    expect(hunks[0].kind).toBe("delete");
    expect(hunks[0].baseRange).toEqual({ start: 1, end: 2 });
    expect(hunks[0].originalLines).toEqual(["b"]);
  });

  it("merges removed+added runs into a modify hunk", () => {
    const hunks = computeLineDiff(["a", "b", "c"], ["a", "B", "c"], "incoming");
    expect(hunks).toHaveLength(1);
    expect(hunks[0].kind).toBe("modify");
    expect(hunks[0].originalLines).toEqual(["b"]);
    expect(hunks[0].modifiedLines).toEqual(["B"]);
  });

  it("returns no hunks for identical inputs", () => {
    expect(computeLineDiff(["a"], ["a"], "current")).toHaveLength(0);
  });
});

describe("spec example 3.1 — independent changes", () => {
  const base = "validateOrder(order);\ncalculateTotal(order);\nsaveOrder(order);\n";
  const current =
    "validateOrder(order);\napplyDiscount(order);\ncalculateTotal(order);\nsaveOrder(order);\n";
  const incoming =
    "validateOrder(order);\ncalculateTotal(order);\nvalidateCreditLimit(order);\nsaveOrder(order);\n";

  it("produces single-sided groups that auto-resolve to the expected merge", () => {
    const analysis = analyzeMerge(base, current, incoming);
    expect(analysis.groups).toHaveLength(2);
    expect(analysis.groups.map((g) => g.classification).sort()).toEqual([
      "current-only",
      "incoming-only",
    ]);
    expect(analysis.groups.every((g) => g.status === "resolved")).toBe(true);

    const { lines } = buildResult(analysis.baseLines, analysis.groups);
    expect(lines).toEqual([
      "validateOrder(order);",
      "applyDiscount(order);",
      "calculateTotal(order);",
      "validateCreditLimit(order);",
      "saveOrder(order);",
    ]);
  });
});

describe("spec example 3.2 — rename and value change (overlapping)", () => {
  const base = "const timeout = 3000;\n";
  const current = "const timeout = 5000;\n";
  const incoming = "const requestTimeout = 3000;\n";

  it("classifies as overlapping and stays unresolved", () => {
    const analysis = analyzeMerge(base, current, incoming);
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].classification).toBe("overlapping");
    expect(analysis.groups[0].status).toBe("unresolved");
  });

  it("renders conflict markers for the unresolved group", () => {
    const analysis = analyzeMerge(base, current, incoming);
    const { lines, regions } = buildResult(analysis.baseLines, analysis.groups, {
      currentLabel: "HEAD",
      incomingLabel: "feature",
    });
    expect(lines).toEqual([
      "<<<<<<< HEAD",
      "const timeout = 5000;",
      "=======",
      "const requestTimeout = 3000;",
      ">>>>>>> feature",
    ]);
    expect(regions).toHaveLength(1);
    expect(regions[0].resolved).toBe(false);
  });

  it("supports manual resolution combining both intents", () => {
    const analysis = analyzeMerge(base, current, incoming);
    const group = asResolved(
      analysis.groups[0],
      resolve("manual", ["const requestTimeout = 5000;"]),
    );
    const { lines } = buildResult(analysis.baseLines, [group]);
    expect(lines).toEqual(["const requestTimeout = 5000;"]);
  });
});

describe("classification", () => {
  it("detects same-change", () => {
    const analysis = analyzeMerge("a\nb\n", "a\nX\n", "a\nX\n");
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].classification).toBe("same-change");
    expect(analysis.groups[0].status).toBe("resolved");
  });

  it("detects delete-modify", () => {
    const analysis = analyzeMerge("a\nb\nc\n", "a\nc\n", "a\nB\nc\n");
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].classification).toBe("delete-modify");
    expect(analysis.groups[0].status).toBe("unresolved");
  });

  it("treats two insertions at the same point as overlapping", () => {
    const analysis = analyzeMerge("a\nb\n", "a\nx\nb\n", "a\ny\nb\n");
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].classification).toBe("overlapping");
  });

  it("classifies insertion at the boundary of a modification as independent", () => {
    // current modifies line "b"; incoming inserts right after it
    const analysis = analyzeMerge("a\nb\nc\n", "a\nB\nc\n", "a\nb\nY\nc\n");
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].classification).toBe("independent");
    const { lines } = buildResult(analysis.baseLines, analysis.groups);
    expect(lines).toEqual(["a", "B", "Y", "c"]);
  });

  it("treats a missing base as an add/add conflict", () => {
    const analysis = analyzeMerge(undefined, "mine\n", "theirs\n");
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].classification).toBe("overlapping");
  });
});

describe("resolution strategies", () => {
  const base = "a\nold\nz\n";
  const current = "a\ncur\nz\n";
  const incoming = "a\ninc\nz\n";

  const group = () => analyzeMerge(base, current, incoming).groups[0];
  const baseLines = () => analyzeMerge(base, current, incoming).baseLines;

  it("accept current / incoming / base", () => {
    expect(resolutionOutput(baseLines(), group(), resolve("current"))).toEqual(["cur"]);
    expect(resolutionOutput(baseLines(), group(), resolve("incoming"))).toEqual(["inc"]);
    expect(resolutionOutput(baseLines(), group(), resolve("base"))).toEqual(["old"]);
    expect(resolutionOutput(baseLines(), group(), resolve("none"))).toEqual(["old"]);
  });

  it("accept both in either order (overlapping => concatenation)", () => {
    expect(resolutionOutput(baseLines(), group(), resolve("both-current-first"))).toEqual([
      "cur",
      "inc",
    ]);
    expect(resolutionOutput(baseLines(), group(), resolve("both-incoming-first"))).toEqual([
      "inc",
      "cur",
    ]);
  });
});

describe("buildResult regions", () => {
  it("tracks region boundaries across resolved and unresolved groups", () => {
    const base = "1\n2\n3\n4\n5\n6\n7\n8\n";
    const current = "1\nTWO\n3\n4\n5\n6\nSEVEN-C\n8\n";
    const incoming = "1\n2\n3\n4\n5\n6\nSEVEN-I\n8\n";
    const analysis = analyzeMerge(base, current, incoming);

    expect(analysis.groups).toHaveLength(2);
    const { lines, regions } = buildResult(analysis.baseLines, analysis.groups);

    // group 0: current-only, auto-resolved to "TWO" at line 1
    expect(regions[0].resolved).toBe(true);
    expect(lines.slice(regions[0].startLine, regions[0].endLine)).toEqual(["TWO"]);

    // group 1: overlapping, rendered with markers
    expect(regions[1].resolved).toBe(false);
    const block = lines.slice(regions[1].startLine, regions[1].endLine);
    expect(block[0].startsWith("<<<<<<<")).toBe(true);
    expect(block[block.length - 1].startsWith(">>>>>>>")).toBe(true);
  });
});

describe("text round-trip", () => {
  it("preserves trailing newline state", () => {
    for (const text of ["", "a", "a\n", "a\nb", "a\nb\n", "\n"]) {
      const { lines, trailingNewline } = splitLines(text);
      expect(joinLines(lines, trailingNewline)).toBe(text);
    }
  });
});
