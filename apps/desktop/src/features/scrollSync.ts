import { editors } from "../stores/controllers";

let suppressUntil = 0;

/**
 * Base-anchored scroll sync: both top panels show BASE as their original
 * side, so syncing their original editors keeps logically-equal content
 * aligned even when line numbers diverge on the modified sides (RF-016).
 */
export function attachScrollSync(): () => void {
  const disposers: { dispose(): void }[] = [];

  const wire = (from: "left" | "right", to: "left" | "right") => {
    const fromEditor = editors[from]?.getOriginalEditor();
    if (!fromEditor) return;
    disposers.push(
      fromEditor.onDidScrollChange((e) => {
        if (!e.scrollTopChanged) return;
        if (performance.now() < suppressUntil) return;
        const target = editors[to]?.getOriginalEditor();
        if (!target) return;
        const range = fromEditor.getVisibleRanges()[0];
        if (!range) return;
        const line = range.startLineNumber;
        const offsetInLine = fromEditor.getTopForLineNumber(line) - e.scrollTop;
        suppressUntil = performance.now() + 60;
        target.setScrollTop(target.getTopForLineNumber(line) - offsetInLine);
      }),
    );
  };

  wire("left", "right");
  wire("right", "left");
  return () => disposers.forEach((d) => d.dispose());
}
