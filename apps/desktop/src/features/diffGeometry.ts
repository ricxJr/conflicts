/**
 * Pure geometry over Monaco line changes: mapping side lines back to BASE
 * lines and computing the cross-panel filler rows that keep both top panels
 * vertically aligned (see panelAlignment.ts for the editor wiring).
 *
 * Only the shape of ILineChange is used; everything here is unit-testable.
 */

export interface LineChangeShape {
  originalStartLineNumber: number;
  /** 0 = insertion (no original lines covered). */
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  /** 0 = deletion (no modified lines produced). */
  modifiedEndLineNumber: number;
}

export type PanelIndex = 0 | 1;

export interface ChangeBox {
  panel: PanelIndex;
  /** Base interval; insertions sit between lines at `start = line + 0.5`. */
  start: number;
  end: number;
  origLen: number;
  modLen: number;
}

export interface Cluster {
  end: number;
  /** Rows each panel renders beyond the base rows, per view mode. */
  extra: [number, number];
  /** Net modified-minus-original line delta, to map base -> side lines. */
  delta: [number, number];
}

export interface ZoneSpec {
  afterLine: number;
  lines: number;
}

export interface PanelZones {
  orig: ZoneSpec[];
  mod: ZoneSpec[];
}

export function toBoxes(panel: PanelIndex, changes: readonly LineChangeShape[]): ChangeBox[] {
  return changes.map((c) => {
    const origLen =
      c.originalEndLineNumber === 0 ? 0 : c.originalEndLineNumber - c.originalStartLineNumber + 1;
    const modLen =
      c.modifiedEndLineNumber === 0 ? 0 : c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
    const start = origLen === 0 ? c.originalStartLineNumber + 0.5 : c.originalStartLineNumber;
    const end = origLen === 0 ? start : c.originalEndLineNumber;
    return { panel, start, end, origLen, modLen };
  });
}

/**
 * Merge both panels' changes into base-interval clusters. Extra rows per
 * change: side-by-side pads the shorter side to max(orig, mod), so only the
 * insertion excess counts; the inline view stacks removed + added rows, so
 * every modified line is an extra row on top of the base ones.
 */
export function buildClusters(boxes: ChangeBox[], sideBySide: boolean): Cluster[] {
  const sorted = [...boxes].sort((a, b) => a.start - b.start || a.end - b.end);
  const clusters: Cluster[] = [];
  let current: Cluster | null = null;
  for (const box of sorted) {
    if (!current || box.start > current.end) {
      current = { end: box.end, extra: [0, 0], delta: [0, 0] };
      clusters.push(current);
    }
    current.end = Math.max(current.end, box.end);
    current.extra[box.panel] += sideBySide ? Math.max(0, box.modLen - box.origLen) : box.modLen;
    current.delta[box.panel] += box.modLen - box.origLen;
  }
  return clusters;
}

/**
 * Filler zones per panel: after each cluster the shorter panel receives the
 * row difference, once in BASE coordinates (original editor) and once mapped
 * to its own side coordinates (modified editor).
 */
export function computeZones(clusters: Cluster[]): [PanelZones, PanelZones] {
  const zones: [PanelZones, PanelZones] = [
    { orig: [], mod: [] },
    { orig: [], mod: [] },
  ];
  const cumDelta: [number, number] = [0, 0];
  for (const cluster of clusters) {
    cumDelta[0] += cluster.delta[0];
    cumDelta[1] += cluster.delta[1];
    const afterBase = Math.floor(cluster.end);
    for (const panel of [0, 1] as const) {
      const filler = cluster.extra[1 - panel] - cluster.extra[panel];
      if (filler > 0) {
        zones[panel].orig.push({ afterLine: afterBase, lines: filler });
        zones[panel].mod.push({ afterLine: afterBase + cumDelta[panel], lines: filler });
      }
    }
  }
  return zones;
}

/** Maps a modified-editor line to its BASE (original) line via the diff. */
export function modifiedLineToBase(changes: readonly LineChangeShape[], line: number): number {
  let delta = 0;
  for (const c of changes) {
    const modLen =
      c.modifiedEndLineNumber === 0 ? 0 : c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
    const origLen =
      c.originalEndLineNumber === 0 ? 0 : c.originalEndLineNumber - c.originalStartLineNumber + 1;
    if (modLen > 0 && line >= c.modifiedStartLineNumber && line <= c.modifiedEndLineNumber) {
      // Inside the changed block: clamp into its original range; insertions
      // resolve to the base line right before the block.
      if (origLen === 0) return c.originalStartLineNumber;
      return Math.min(
        c.originalStartLineNumber + (line - c.modifiedStartLineNumber),
        c.originalEndLineNumber,
      );
    }
    const blockEnd = modLen === 0 ? c.modifiedStartLineNumber : c.modifiedEndLineNumber;
    if (blockEnd < line) delta += modLen - origLen;
    else break;
  }
  return line - delta;
}
