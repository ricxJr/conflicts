import type {
  BuildResultOutput,
  ConflictGroup,
  Resolution,
  ResolutionStrategy,
  ResultRegion,
} from "./types";
import { applyCombined, applyHunksToRange } from "./apply";

export interface MarkerLabels {
  currentLabel: string;
  incomingLabel: string;
}

const DEFAULT_LABELS: MarkerLabels = { currentLabel: "CURRENT", incomingLabel: "INCOMING" };

/** Lines a group contributes to the result for a given strategy. */
export function resolutionOutput(
  baseLines: string[],
  group: ConflictGroup,
  resolution: Resolution,
): string[] {
  const { baseRange, currentHunks, incomingHunks } = group;
  switch (resolution.strategy) {
    case "current":
      return applyHunksToRange(baseLines, baseRange, currentHunks);
    case "incoming":
      return applyHunksToRange(baseLines, baseRange, incomingHunks);
    case "both-current-first":
      if (group.classification === "independent") {
        return applyCombined(baseLines, baseRange, currentHunks, incomingHunks);
      }
      return [
        ...applyHunksToRange(baseLines, baseRange, currentHunks),
        ...applyHunksToRange(baseLines, baseRange, incomingHunks),
      ];
    case "both-incoming-first":
      if (group.classification === "independent") {
        return applyCombined(baseLines, baseRange, currentHunks, incomingHunks);
      }
      return [
        ...applyHunksToRange(baseLines, baseRange, incomingHunks),
        ...applyHunksToRange(baseLines, baseRange, currentHunks),
      ];
    case "base":
    case "none":
      return baseLines.slice(group.baseRange.start, group.baseRange.end);
    case "manual":
      return resolution.manualLines ?? [];
    default:
      return baseLines.slice(group.baseRange.start, group.baseRange.end);
  }
}

/** Conflict-marker block emitted for unresolved groups. */
function markerBlock(baseLines: string[], group: ConflictGroup, labels: MarkerLabels): string[] {
  const current = applyHunksToRange(baseLines, group.baseRange, group.currentHunks);
  const incoming = applyHunksToRange(baseLines, group.baseRange, group.incomingHunks);
  return [
    `<<<<<<< ${labels.currentLabel}`,
    ...current,
    "=======",
    ...incoming,
    `>>>>>>> ${labels.incomingLabel}`,
  ];
}

/**
 * Rebuilds the whole result from the base plus per-group resolutions.
 * Unresolved groups are emitted as standard conflict-marker blocks.
 *
 * Returns the result lines and the region occupied by each group, so the UI
 * can anchor decorations/actions on them.
 */
export function buildResult(
  baseLines: string[],
  groups: ConflictGroup[],
  labels: MarkerLabels = DEFAULT_LABELS,
): BuildResultOutput {
  const sorted = [...groups].sort(
    (a, b) => a.baseRange.start - b.baseRange.start || a.baseRange.end - b.baseRange.end,
  );

  const lines: string[] = [];
  const regions: ResultRegion[] = [];
  let basePos = 0;

  for (const group of sorted) {
    for (let i = basePos; i < group.baseRange.start; i++) lines.push(baseLines[i]);

    const startLine = lines.length;
    const resolved = group.status !== "unresolved" && group.resolution !== undefined;
    if (resolved && group.resolution) {
      lines.push(...resolutionOutput(baseLines, group, group.resolution));
    } else {
      lines.push(...markerBlock(baseLines, group, labels));
    }
    regions.push({ groupId: group.id, startLine, endLine: lines.length, resolved });

    basePos = Math.max(basePos, group.baseRange.end);
  }
  for (let i = basePos; i < baseLines.length; i++) lines.push(baseLines[i]);

  return { lines, regions };
}

/**
 * Initial resolution suggested by the engine:
 *  - single-sided and same-change groups resolve automatically;
 *  - independent groups auto-apply BOTH but stay flagged for review;
 *  - conflicting groups (overlapping / delete-modify / unknown) stay unresolved.
 */
export function defaultResolution(group: ConflictGroup): Resolution | undefined {
  const now = new Date().toISOString();
  switch (group.classification) {
    case "current-only":
    case "same-change":
      return { strategy: "current", autoApplied: true, updatedAt: now };
    case "incoming-only":
      return { strategy: "incoming", autoApplied: true, updatedAt: now };
    case "independent":
      return { strategy: "both-current-first", autoApplied: true, updatedAt: now };
    default:
      return undefined;
  }
}

export function applyDefaultResolutions(groups: ConflictGroup[]): ConflictGroup[] {
  return groups.map((group) => {
    const resolution = defaultResolution(group);
    if (!resolution) return { ...group, status: "unresolved" as const };
    return { ...group, status: "resolved" as const, resolution };
  });
}

export function isConflicting(group: ConflictGroup): boolean {
  return (
    group.classification === "overlapping" ||
    group.classification === "delete-modify" ||
    group.classification === "unknown"
  );
}

export function strategyLabel(strategy: ResolutionStrategy): string {
  switch (strategy) {
    case "current":
      return "Current";
    case "incoming":
      return "Incoming";
    case "both-current-first":
      return "Both (Current first)";
    case "both-incoming-first":
      return "Both (Incoming first)";
    case "base":
      return "Base";
    case "none":
      return "None";
    case "manual":
      return "Manual";
  }
}
