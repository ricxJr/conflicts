import { diffArrays } from "diff";
import type { DiffHunk, LineRange } from "./types";

export interface LineDiffOptions {
  /** Compare lines ignoring leading/trailing whitespace. */
  ignoreWhitespace?: boolean;
}

/**
 * Computes normalized hunks for `base -> side`.
 *
 * Consecutive removed/added runs are merged into a single hunk:
 *  - removed + added => "modify"
 *  - removed only    => "delete"
 *  - added only      => "insert"
 */
export function computeLineDiff(
  baseLines: string[],
  sideLines: string[],
  source: "current" | "incoming",
  options: LineDiffOptions = {},
): DiffHunk[] {
  const comparator = options.ignoreWhitespace
    ? (left: string, right: string) => left.trim() === right.trim()
    : undefined;

  const parts = diffArrays(baseLines, sideLines, comparator ? { comparator } : undefined);

  const hunks: DiffHunk[] = [];
  let basePos = 0;
  let sidePos = 0;
  let pendingRemoved: string[] | null = null;
  let pendingBaseStart = 0;

  const flush = (added: string[] | null, sideStart: number) => {
    const removed = pendingRemoved ?? [];
    const addedLines = added ?? [];
    if (removed.length === 0 && addedLines.length === 0) return;

    const baseRange: LineRange = {
      start: pendingBaseStart,
      end: pendingBaseStart + removed.length,
    };
    const targetRange: LineRange = { start: sideStart, end: sideStart + addedLines.length };
    const kind = removed.length === 0 ? "insert" : addedLines.length === 0 ? "delete" : "modify";

    hunks.push({
      id: `h-${source}-${hunks.length}`,
      source,
      baseRange,
      targetRange,
      kind,
      originalLines: removed,
      modifiedLines: addedLines,
    });
    pendingRemoved = null;
  };

  for (const part of parts) {
    const count = part.count ?? part.value.length;
    if (part.removed) {
      if (pendingRemoved) flush(null, sidePos);
      pendingRemoved = part.value.slice();
      pendingBaseStart = basePos;
      basePos += count;
    } else if (part.added) {
      if (!pendingRemoved) pendingBaseStart = basePos;
      flush(part.value.slice(), sidePos);
      sidePos += count;
    } else {
      if (pendingRemoved) flush(null, sidePos);
      basePos += count;
      sidePos += count;
    }
  }
  if (pendingRemoved) flush(null, sidePos);

  return hunks;
}
