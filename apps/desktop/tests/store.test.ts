import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSession } from "../src/stores/session";
import { editors, type ResultController } from "../src/stores/controllers";

/**
 * Store-level behavior tests (spec §28.2). They run against the demo session
 * (no Tauri runtime in vitest) with a fake result controller standing in for
 * the Monaco editor.
 */

function fakeController(): ResultController & { regions: Map<string, string[]> } {
  const regions = new Map<string, string[]>();
  return {
    regions,
    replaceRegion(groupId, lines) {
      regions.set(groupId, lines);
    },
    getRegionLines(groupId) {
      return regions.get(groupId) ?? [];
    },
    getRegionSpan() {
      return { startLine: 1, endLine: 2 };
    },
    getText() {
      return [...regions.values()].flat().join("\n");
    },
    revealGroup: vi.fn(),
    focus: vi.fn(),
  };
}

describe("session store", () => {
  beforeEach(async () => {
    editors.result = fakeController();
    await useSession.getState().init();
  });

  it("loads the demo session and classifies its groups", () => {
    const s = useSession.getState();
    expect(s.phase).toBe("ready");
    expect(s.groups.length).toBeGreaterThanOrEqual(2);
    // Demo data reproduces the spec examples: independent inserts (auto) and
    // the rename-vs-value overlapping conflict (unresolved).
    expect(s.groups.some((g) => g.classification === "overlapping")).toBe(true);
    expect(s.unresolvedCount).toBeGreaterThan(0);
    // First unresolved group is pre-selected.
    expect(s.groups[s.activeIndex].status).toBe("unresolved");
  });

  it("applyStrategy resolves the group and updates the counter", () => {
    const s = useSession.getState();
    const target = s.groups.find((g) => g.status === "unresolved")!;
    const before = s.unresolvedCount;

    s.applyStrategy(target.id, "current");

    const after = useSession.getState();
    const updated = after.groups.find((g) => g.id === target.id)!;
    expect(updated.status).toBe("resolved");
    expect(updated.resolution?.strategy).toBe("current");
    expect(after.unresolvedCount).toBe(before - 1);
    expect(after.dirty).toBe(true);
  });

  it("resetGroup restores conflicting groups to unresolved markers", () => {
    const s = useSession.getState();
    const target = s.groups.find((g) => g.classification === "overlapping")!;
    s.applyStrategy(target.id, "incoming");
    expect(useSession.getState().groups.find((g) => g.id === target.id)!.status).toBe("resolved");

    useSession.getState().resetGroup(target.id);
    const after = useSession.getState();
    expect(after.groups.find((g) => g.id === target.id)!.status).toBe("unresolved");
    const controller = editors.result as ReturnType<typeof fakeController>;
    expect(controller.regions.get(target.id)?.[0]).toMatch(/^<{7}/);
  });

  it("navigation wraps around the group list", () => {
    const s = useSession.getState();
    s.setActiveIndex(s.groups.length - 1);
    useSession.getState().nextConflict();
    expect(useSession.getState().activeIndex).toBe(0);
    useSession.getState().prevConflict();
    expect(useSession.getState().activeIndex).toBe(s.groups.length - 1);
  });

  it("manual edits with markers keep the group unresolved", () => {
    const s = useSession.getState();
    const target = s.groups[0];
    const controller = editors.result as ReturnType<typeof fakeController>;

    controller.regions.set(target.id, ["<<<<<<< HEAD", "x", "=======", "y", ">>>>>>> f"]);
    s.onRegionsEdited([target.id]);
    expect(useSession.getState().groups[0].status).toBe("unresolved");

    controller.regions.set(target.id, ["resolved by hand"]);
    useSession.getState().onRegionsEdited([target.id]);
    const after = useSession.getState().groups[0];
    expect(after.status).toBe("resolved");
    expect(after.resolution?.strategy).toBe("manual");
  });

  it("applyStrategyToAll resolves every group from one side", () => {
    const s = useSession.getState();
    const controller = editors.result as ReturnType<typeof fakeController>;

    s.applyStrategyToAll("incoming");

    const after = useSession.getState();
    expect(after.unresolvedCount).toBe(0);
    expect(after.dirty).toBe(true);
    expect(after.groups.every((g) => g.status === "resolved")).toBe(true);
    expect(after.groups.every((g) => g.resolution?.strategy === "incoming")).toBe(true);
    // Every region got rewritten in the result editor.
    expect(controller.regions.size).toBe(after.groups.length);
  });

  it("activateGroupAtBaseLine focuses the group containing the clicked line", () => {
    const s = useSession.getState();
    const targetIndex = s.groups.length - 1;
    const target = s.groups[targetIndex];

    s.activateGroupAtBaseLine(target.baseRange.start, { revealPanels: false });
    expect(useSession.getState().activeIndex).toBe(targetIndex);

    // Clicks far from any change keep the current selection.
    s.activateGroupAtBaseLine(9999);
    expect(useSession.getState().activeIndex).toBe(targetIndex);
  });

  it("markReviewed only applies to already-resolved groups", () => {
    const s = useSession.getState();
    const unresolved = s.groups.find((g) => g.status === "unresolved")!;
    s.markReviewed(unresolved.id);
    expect(useSession.getState().groups.find((g) => g.id === unresolved.id)!.status).toBe(
      "unresolved",
    );

    const resolved = s.groups.find((g) => g.status === "resolved")!;
    s.markReviewed(resolved.id);
    expect(useSession.getState().groups.find((g) => g.id === resolved.id)!.status).toBe("reviewed");
  });
});
