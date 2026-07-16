import { describe, expect, it } from "vitest";
import {
  buildClusters,
  computeZones,
  modifiedLineToBase,
  toBoxes,
  type LineChangeShape,
} from "../src/features/diffGeometry";

/** Shorthand: [origStart, origEnd, modStart, modEnd] (0 = insertion/deletion). */
function change(o1: number, o2: number, m1: number, m2: number): LineChangeShape {
  return {
    originalStartLineNumber: o1,
    originalEndLineNumber: o2,
    modifiedStartLineNumber: m1,
    modifiedEndLineNumber: m2,
  };
}

describe("modifiedLineToBase", () => {
  it("is the identity without changes", () => {
    expect(modifiedLineToBase([], 7)).toBe(7);
  });

  it("maps lines inside a modify block into the original range, clamped", () => {
    const changes = [change(5, 6, 5, 7)]; // 2 base lines -> 3 side lines
    expect(modifiedLineToBase(changes, 5)).toBe(5);
    expect(modifiedLineToBase(changes, 6)).toBe(6);
    expect(modifiedLineToBase(changes, 7)).toBe(6); // clamped to block end
    expect(modifiedLineToBase(changes, 8)).toBe(7); // after: delta of +1
  });

  it("maps inserted lines to the base line before the insertion", () => {
    const changes = [change(3, 0, 4, 5)]; // 2 lines inserted after base 3
    expect(modifiedLineToBase(changes, 4)).toBe(3);
    expect(modifiedLineToBase(changes, 5)).toBe(3);
    expect(modifiedLineToBase(changes, 6)).toBe(4);
  });

  it("shifts lines after a deletion by the deleted length", () => {
    const changes = [change(5, 6, 4, 0)]; // base 5-6 deleted
    expect(modifiedLineToBase(changes, 4)).toBe(4);
    expect(modifiedLineToBase(changes, 5)).toBe(7);
  });
});

describe("cross-panel alignment zones", () => {
  it("pads the panel without the insertion (side by side)", () => {
    const boxes = toBoxes(0, [change(10, 0, 11, 12)]); // +2 lines after base 10
    const zones = computeZones(buildClusters(boxes, true));
    expect(zones[0].orig).toEqual([]);
    expect(zones[1].orig).toEqual([{ afterLine: 10, lines: 2 }]);
    expect(zones[1].mod).toEqual([{ afterLine: 10, lines: 2 }]);
  });

  it("balances asymmetric modify blocks and maps to side coordinates", () => {
    // Panel 0 grows 5-6 into three lines; panel 1 shrinks 5-6 into one.
    const boxes = [...toBoxes(0, [change(5, 6, 5, 7)]), ...toBoxes(1, [change(5, 6, 5, 5)])];
    const zones = computeZones(buildClusters(boxes, true));
    expect(zones[0].orig).toEqual([]);
    // Panel 1 needs one filler row after base 6, which is side line 5 there.
    expect(zones[1].orig).toEqual([{ afterLine: 6, lines: 1 }]);
    expect(zones[1].mod).toEqual([{ afterLine: 5, lines: 1 }]);
  });

  it("counts removed rows too in the inline view", () => {
    // Inline stacks removed + added rows: panel 0 renders 2+3 rows, panel 1
    // renders 2+1 -> panel 1 needs 2 filler rows.
    const boxes = [...toBoxes(0, [change(5, 6, 5, 7)]), ...toBoxes(1, [change(5, 6, 5, 5)])];
    const zones = computeZones(buildClusters(boxes, false));
    expect(zones[0].mod).toEqual([]);
    expect(zones[1].mod).toEqual([{ afterLine: 5, lines: 2 }]);
  });

  it("merges overlapping base intervals from both panels into one cluster", () => {
    const boxes = [
      ...toBoxes(0, [change(5, 8, 5, 9)]), // 4 -> 5 lines (+1)
      ...toBoxes(1, [change(7, 10, 7, 8)]), // 4 -> 2 lines (-2)
    ];
    const clusters = buildClusters(boxes, true);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].end).toBe(10);
    const zones = computeZones(clusters);
    // Panel 0 has 1 extra row; panel 1 none -> filler of 1 in panel 1 after
    // base 10 (its own side is 2 lines shorter there).
    expect(zones[1].orig).toEqual([{ afterLine: 10, lines: 1 }]);
    expect(zones[1].mod).toEqual([{ afterLine: 8, lines: 1 }]);
  });

  it("supports insertions before the first line", () => {
    const boxes = toBoxes(0, [change(0, 0, 1, 2)]);
    const zones = computeZones(buildClusters(boxes, true));
    expect(zones[1].orig).toEqual([{ afterLine: 0, lines: 2 }]);
    expect(zones[1].mod).toEqual([{ afterLine: 0, lines: 2 }]);
  });

  it("adds no zones when both panels grow equally", () => {
    const boxes = [...toBoxes(0, [change(5, 6, 5, 7)]), ...toBoxes(1, [change(5, 6, 5, 7)])];
    const zones = computeZones(buildClusters(boxes, true));
    expect(zones[0].orig).toEqual([]);
    expect(zones[0].mod).toEqual([]);
    expect(zones[1].orig).toEqual([]);
    expect(zones[1].mod).toEqual([]);
  });
});
