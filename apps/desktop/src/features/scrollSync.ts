import { editors } from "../stores/controllers";
import { useSession } from "../stores/session";

let suppressUntil = 0;

/**
 * Scroll sync between the two top panels (RF-016).
 *
 * With the alignment filler active (see panelAlignment.ts) both panels have
 * identical row heights everywhere, so mirroring the pixel offset of the
 * visible (modified) editors is exact in both view modes.
 *
 * When unchanged regions are collapsed the filler is disabled and each panel
 * folds differently; fall back to anchoring on the shared BASE line via the
 * original editors (side-by-side only — inline hides them).
 */
export function attachScrollSync(): () => void {
  const disposers: { dispose(): void }[] = [];

  const wire = (from: "left" | "right", to: "left" | "right") => {
    const fromDiff = editors[from];
    const source = fromDiff?.getModifiedEditor();
    if (!fromDiff || !source) return;
    disposers.push(
      source.onDidScrollChange((e) => {
        if (!e.scrollTopChanged) return;
        if (performance.now() < suppressUntil) return;
        const target = editors[to];
        if (!target) return;
        suppressUntil = performance.now() + 60;

        const prefs = useSession.getState().prefs;
        if (prefs.hideUnchangedRegions && !prefs.showConflictList) {
          const fromOrig = fromDiff.getOriginalEditor();
          const toOrig = target.getOriginalEditor();
          const range = fromOrig.getVisibleRanges()[0];
          if (!range) return;
          const line = range.startLineNumber;
          const offsetInLine = fromOrig.getTopForLineNumber(line) - fromOrig.getScrollTop();
          toOrig.setScrollTop(toOrig.getTopForLineNumber(line) - offsetInLine);
        } else {
          target.getModifiedEditor().setScrollTop(e.scrollTop);
        }
      }),
    );
  };

  wire("left", "right");
  wire("right", "left");
  return () => disposers.forEach((d) => d.dispose());
}
