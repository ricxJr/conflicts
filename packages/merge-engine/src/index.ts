import { computeLineDiff, type LineDiffOptions } from "./diff";
import { correlateHunks } from "./correlate";
import { applyDefaultResolutions } from "./resolve";
import { normalizeEol, splitLines } from "./text";
import type { MergeAnalysis } from "./types";

export * from "./types";
export * from "./text";
export { computeLineDiff, type LineDiffOptions } from "./diff";
export { correlateHunks, hunksTouch } from "./correlate";
export { classifyGroup } from "./classify";
export { applyHunksToRange, applyCombined } from "./apply";
export {
  buildResult,
  resolutionOutput,
  defaultResolution,
  applyDefaultResolutions,
  isConflicting,
  strategyLabel,
  type MarkerLabels,
} from "./resolve";
export { parseConflictMarkers, hasConflictMarkers } from "./markers";

export interface AnalyzeOptions extends LineDiffOptions {
  /** Apply safe automatic resolutions (single-sided, same-change, independent). */
  autoResolve?: boolean;
}

/**
 * Full analysis pipeline: normalize -> diff both sides against base ->
 * correlate into conflict groups -> classify -> (optionally) auto-resolve.
 *
 * A missing base (git without a common ancestor) is treated as an empty file,
 * which turns the whole content into an add/add conflict — mirroring git.
 */
export function analyzeMerge(
  baseText: string | undefined,
  currentText: string,
  incomingText: string,
  options: AnalyzeOptions = {},
): MergeAnalysis {
  const baseLines = splitLines(normalizeEol(baseText ?? "")).lines;
  const currentLines = splitLines(normalizeEol(currentText)).lines;
  const incomingLines = splitLines(normalizeEol(incomingText)).lines;

  const currentHunks = computeLineDiff(baseLines, currentLines, "current", options);
  const incomingHunks = computeLineDiff(baseLines, incomingLines, "incoming", options);

  let groups = correlateHunks(baseLines, currentHunks, incomingHunks);
  if (options.autoResolve !== false) {
    groups = applyDefaultResolutions(groups);
  }

  return { baseLines, currentLines, incomingLines, groups, currentHunks, incomingHunks };
}
