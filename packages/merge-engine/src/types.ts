/**
 * Domain model of the MergeScope merge analysis engine.
 *
 * Line ranges are 0-based and end-exclusive. An empty range (start === end)
 * represents an insertion point *before* line `start`.
 */

export type Side = "base" | "current" | "incoming" | "result";

export type ChangeKind = "equal" | "insert" | "delete" | "modify" | "move";

export type ConflictStatus = "unresolved" | "partial" | "resolved" | "reviewed";

export type ConflictClassification =
  | "independent"
  | "overlapping"
  | "current-only"
  | "incoming-only"
  | "same-change"
  | "delete-modify"
  | "unknown";

export type ResolutionStrategy =
  | "current"
  | "incoming"
  | "both-current-first"
  | "both-incoming-first"
  | "base"
  | "none"
  | "manual";

export interface LineRange {
  /** 0-based inclusive start line. */
  start: number;
  /** 0-based exclusive end line. */
  end: number;
}

export interface DiffHunk {
  id: string;
  source: "current" | "incoming";
  /** Range of base lines replaced by this hunk (empty range = insertion point). */
  baseRange: LineRange;
  /** Range of lines in the side file that this hunk produced. */
  targetRange: LineRange;
  kind: ChangeKind;
  /** The base lines covered by `baseRange`. */
  originalLines: string[];
  /** The side lines covered by `targetRange`. */
  modifiedLines: string[];
}

export interface Resolution {
  strategy: ResolutionStrategy;
  /** Only meaningful for `strategy === "manual"`. */
  manualLines?: string[];
  /** True when the engine applied this resolution automatically (safe groups). */
  autoApplied?: boolean;
  updatedAt: string;
}

export interface ConflictGroup {
  id: string;
  /** Covered base interval (union of all member hunks). */
  baseRange: LineRange;
  currentHunks: DiffHunk[];
  incomingHunks: DiffHunk[];
  classification: ConflictClassification;
  status: ConflictStatus;
  resolution?: Resolution;
}

export interface ResultRegion {
  groupId: string;
  /** 0-based inclusive start line of the region inside the generated result. */
  startLine: number;
  /** 0-based exclusive end line of the region inside the generated result. */
  endLine: number;
  resolved: boolean;
}

export interface BuildResultOutput {
  lines: string[];
  regions: ResultRegion[];
}

export interface MergeAnalysis {
  baseLines: string[];
  currentLines: string[];
  incomingLines: string[];
  groups: ConflictGroup[];
  currentHunks: DiffHunk[];
  incomingHunks: DiffHunk[];
}

export interface ConflictMarkerRegion {
  /** 0-based line of the `<<<<<<<` marker. */
  startLine: number;
  /** 0-based line of the `>>>>>>>` marker. */
  endLine: number;
  currentLabel: string;
  incomingLabel: string;
  /** Present when the region uses diff3/zdiff3 style with a base section. */
  baseLabel?: string;
  currentLines: string[];
  incomingLines: string[];
  baseLines?: string[];
}

export interface ConflictMarkerParseResult {
  regions: ConflictMarkerRegion[];
  diagnostics: string[];
}

/** Merge inputs rebuilt from a conflicted file's markers (single-file mode). */
export interface ReconstructedSides {
  baseLines: string[];
  currentLines: string[];
  incomingLines: string[];
  /** Labels taken from the first region's markers (e.g. HEAD / branch name). */
  currentLabel?: string;
  incomingLabel?: string;
}
