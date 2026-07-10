import type { ConflictGroup, DiffHunk, LineRange } from "./types";
import { classifyGroup } from "./classify";

function isEmpty(range: LineRange): boolean {
  return range.start === range.end;
}

/** Strict overlap between two non-empty intervals. */
function strictOverlap(a: LineRange, b: LineRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Two hunks are related ("touch") when:
 *  - their base intervals strictly overlap; or
 *  - one is an insertion located at (or inside) the boundary of the other; or
 *  - both are insertions at the same base position.
 *
 * Two adjacent-but-disjoint modifications do NOT touch, so they stay in
 * separate groups (they are independent by construction).
 */
export function hunksTouch(a: DiffHunk, b: DiffHunk): boolean {
  const ra = a.baseRange;
  const rb = b.baseRange;
  if (isEmpty(ra) && isEmpty(rb)) return ra.start === rb.start;
  if (isEmpty(ra)) return ra.start >= rb.start && ra.start <= rb.end;
  if (isEmpty(rb)) return rb.start >= ra.start && rb.start <= ra.end;
  return strictOverlap(ra, rb);
}

/**
 * Builds the conflict graph: connected components of hunks related through
 * their base intervals. Within one side, hunks never touch each other, so the
 * relation is effectively evaluated across sides.
 */
export function correlateHunks(
  baseLines: string[],
  currentHunks: DiffHunk[],
  incomingHunks: DiffHunk[],
): ConflictGroup[] {
  const all = [...currentHunks, ...incomingHunks];
  const parent = all.map((_, i) => i);

  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < currentHunks.length; i++) {
    for (let j = 0; j < incomingHunks.length; j++) {
      if (hunksTouch(currentHunks[i], incomingHunks[j])) {
        union(i, currentHunks.length + j);
      }
    }
  }

  const components = new Map<number, DiffHunk[]>();
  all.forEach((hunk, i) => {
    const root = find(i);
    const bucket = components.get(root);
    if (bucket) bucket.push(hunk);
    else components.set(root, [hunk]);
  });

  const groups: ConflictGroup[] = [];
  for (const hunks of components.values()) {
    const current = hunks
      .filter((h) => h.source === "current")
      .sort((a, b) => a.baseRange.start - b.baseRange.start);
    const incoming = hunks
      .filter((h) => h.source === "incoming")
      .sort((a, b) => a.baseRange.start - b.baseRange.start);

    const start = Math.min(...hunks.map((h) => h.baseRange.start));
    const end = Math.max(...hunks.map((h) => h.baseRange.end));

    groups.push({
      id: "",
      baseRange: { start, end },
      currentHunks: current,
      incomingHunks: incoming,
      classification: classifyGroup(baseLines, current, incoming),
      status: "unresolved",
    });
  }

  groups.sort((a, b) => a.baseRange.start - b.baseRange.start || a.baseRange.end - b.baseRange.end);
  groups.forEach((group, i) => {
    group.id = `cg-${i}`;
  });
  return groups;
}
