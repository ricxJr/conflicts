/**
 * Cross-panel alignment (TortoiseGit-style): the two top panels diff each
 * side against the same BASE, but insertions inflate each panel differently,
 * so equal base lines drift apart vertically. This feature adds hatched
 * filler view zones after each change cluster so both panels consume the
 * same number of rows, keeping equal base content at equal heights.
 *
 * Zones are derived arithmetically from each diff editor's own line changes
 * (not from the merge engine) so they always match what Monaco rendered,
 * including the "ignore whitespace" toggle. Disabled while unchanged regions
 * are collapsed — folding differs per panel and makes row math meaningless.
 */
import type { monaco } from "../editor/monaco";
import { editors } from "../stores/controllers";
import { useSession } from "../stores/session";
import { buildClusters, computeZones, toBoxes, type ChangeBox, type ZoneSpec } from "./diffGeometry";

function fillerNode(): HTMLElement {
  const el = document.createElement("div");
  el.className = "msr-align-filler";
  return el;
}

const zoneIds: { orig: string[]; mod: string[] }[] = [
  { orig: [], mod: [] },
  { orig: [], mod: [] },
];

function setZones(editor: monaco.editor.ICodeEditor, ids: string[], specs: ZoneSpec[]): string[] {
  const next: string[] = [];
  editor.changeViewZones((accessor) => {
    ids.forEach((id) => accessor.removeZone(id));
    for (const spec of specs) {
      next.push(
        accessor.addZone({
          afterLineNumber: spec.afterLine,
          heightInLines: spec.lines,
          domNode: fillerNode(),
        }),
      );
    }
  });
  return next;
}

/** Recomputes and (re)applies the filler zones on both panels. */
export function realignPanels(): void {
  const left = editors.left;
  const right = editors.right;
  if (!left || !right) return;

  const prefs = useSession.getState().prefs;
  const sideBySide = !prefs.showConflictList;
  const changesL = left.getLineChanges();
  const changesR = right.getLineChanges();

  const boxes: ChangeBox[] = [];
  if (!prefs.hideUnchangedRegions && changesL && changesR) {
    boxes.push(...toBoxes(0, changesL), ...toBoxes(1, changesR));
  }
  const zones = computeZones(buildClusters(boxes, sideBySide));

  ([left, right] as const).forEach((diff, i) => {
    // Original editor zones only matter side by side (it is hidden inline).
    zoneIds[i].orig = setZones(
      diff.getOriginalEditor(),
      zoneIds[i].orig,
      sideBySide ? zones[i].orig : [],
    );
    zoneIds[i].mod = setZones(diff.getModifiedEditor(), zoneIds[i].mod, zones[i].mod);
  });
}

/** Wires realignment to diff updates and the prefs that change row math. */
export function attachPanelAlignment(): () => void {
  const disposers: { dispose(): void }[] = [];
  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(realignPanels);
  };

  for (const side of ["left", "right"] as const) {
    const sub = editors[side]?.onDidUpdateDiff(schedule);
    if (sub) disposers.push(sub);
  }
  const unsubscribe = useSession.subscribe((state, prev) => {
    if (
      state.prefs.hideUnchangedRegions !== prev.prefs.hideUnchangedRegions ||
      state.prefs.showConflictList !== prev.prefs.showConflictList
    ) {
      schedule();
    }
  });
  schedule();

  return () => {
    cancelAnimationFrame(raf);
    disposers.forEach((d) => d.dispose());
    unsubscribe();
  };
}
