import type { ConflictClassification, DiffHunk, LineRange } from "./types";
import { applyHunksToRange } from "./apply";
import { linesEqual } from "./text";

function isEmpty(range: LineRange): boolean {
  return range.start === range.end;
}

/**
 * A cross-side pair is conflicting when both hunks compete for the same base
 * content: strict interval overlap, or two insertions at the exact same point
 * (ambiguous order).
 */
function pairConflicts(a: DiffHunk, b: DiffHunk): boolean {
  const ra = a.baseRange;
  const rb = b.baseRange;
  if (isEmpty(ra) && isEmpty(rb)) return ra.start === rb.start;
  if (isEmpty(ra) || isEmpty(rb)) return false;
  return ra.start < rb.end && rb.start < ra.end;
}

export function classifyGroup(
  baseLines: string[],
  currentHunks: DiffHunk[],
  incomingHunks: DiffHunk[],
): ConflictClassification {
  try {
    if (currentHunks.length === 0 && incomingHunks.length === 0) return "unknown";
    if (incomingHunks.length === 0) return "current-only";
    if (currentHunks.length === 0) return "incoming-only";

    const hunks = [...currentHunks, ...incomingHunks];
    const start = Math.min(...hunks.map((h) => h.baseRange.start));
    const end = Math.max(...hunks.map((h) => h.baseRange.end));
    const range: LineRange = { start, end };

    const currentOut = applyHunksToRange(baseLines, range, currentHunks);
    const incomingOut = applyHunksToRange(baseLines, range, incomingHunks);
    if (linesEqual(currentOut, incomingOut)) return "same-change";

    let anyConflict = false;
    let deleteVsModify = false;
    for (const c of currentHunks) {
      for (const i of incomingHunks) {
        if (!pairConflicts(c, i)) continue;
        anyConflict = true;
        const oneDeletes = c.kind === "delete" || i.kind === "delete";
        const otherKeepsContent =
          (c.kind === "delete" && i.modifiedLines.length > 0) ||
          (i.kind === "delete" && c.modifiedLines.length > 0);
        if (oneDeletes && otherKeepsContent) deleteVsModify = true;
      }
    }

    if (!anyConflict) return "independent";
    if (deleteVsModify) return "delete-modify";
    return "overlapping";
  } catch {
    return "unknown";
  }
}
