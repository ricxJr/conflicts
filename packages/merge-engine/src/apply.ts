import type { DiffHunk, LineRange } from "./types";

/**
 * Applies one side's hunks to a slice of the base file, producing the lines
 * that side would have for `range`. Hunks must be sorted and disjoint (which
 * holds for hunks produced by a single diff).
 */
export function applyHunksToRange(
  baseLines: string[],
  range: LineRange,
  hunks: DiffHunk[],
): string[] {
  const out: string[] = [];
  let pos = range.start;
  for (const hunk of hunks) {
    for (let i = pos; i < hunk.baseRange.start; i++) out.push(baseLines[i]);
    out.push(...hunk.modifiedLines);
    pos = Math.max(pos, hunk.baseRange.end);
  }
  for (let i = pos; i < range.end; i++) out.push(baseLines[i]);
  return out;
}

/**
 * Applies hunks from BOTH sides at once. Only valid for independent groups
 * (no cross-side interval conflicts). Insertions sort before modifications at
 * the same start position; ties across sides put `current` first.
 */
export function applyCombined(
  baseLines: string[],
  range: LineRange,
  currentHunks: DiffHunk[],
  incomingHunks: DiffHunk[],
): string[] {
  const merged = [...currentHunks, ...incomingHunks].sort((a, b) => {
    if (a.baseRange.start !== b.baseRange.start) return a.baseRange.start - b.baseRange.start;
    const aLen = a.baseRange.end - a.baseRange.start;
    const bLen = b.baseRange.end - b.baseRange.start;
    if (aLen !== bLen) return aLen - bLen;
    if (a.source !== b.source) return a.source === "current" ? -1 : 1;
    return 0;
  });
  return applyHunksToRange(baseLines, range, merged);
}
