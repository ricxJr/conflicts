import type { ConflictMarkerParseResult, ConflictMarkerRegion, ReconstructedSides } from "./types";

const START = /^<{7}(?:\s+(.*))?$/;
const BASE_SEP = /^\|{7}(?:\s+(.*))?$/;
const SEPARATOR = /^={7}$/;
const END = /^>{7}(?:\s+(.*))?$/;

type State = "outside" | "current" | "base" | "incoming";

/**
 * Parses standard, diff3 and zdiff3 conflict markers.
 * Nested or malformed markers produce diagnostics instead of throwing.
 */
export function parseConflictMarkers(lines: string[]): ConflictMarkerParseResult {
  const regions: ConflictMarkerRegion[] = [];
  const diagnostics: string[] = [];

  let state: State = "outside";
  let startLine = -1;
  let currentLabel = "";
  let baseLabel: string | undefined;
  let currentLines: string[] = [];
  let baseLines: string[] | undefined;
  let incomingLines: string[] = [];

  const reset = () => {
    state = "outside";
    startLine = -1;
    currentLabel = "";
    baseLabel = undefined;
    currentLines = [];
    baseLines = undefined;
    incomingLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = START.exec(line);
    if (start) {
      if (state !== "outside") {
        diagnostics.push(`Nested conflict start marker at line ${i + 1}`);
        reset();
      }
      state = "current";
      startLine = i;
      currentLabel = start[1] ?? "";
      continue;
    }

    if (state === "current" && BASE_SEP.test(line)) {
      state = "base";
      baseLabel = BASE_SEP.exec(line)?.[1] ?? "";
      baseLines = [];
      continue;
    }

    if ((state === "current" || state === "base") && SEPARATOR.test(line)) {
      state = "incoming";
      continue;
    }

    const end = END.exec(line);
    if (end) {
      if (state !== "incoming") {
        diagnostics.push(`Unexpected conflict end marker at line ${i + 1}`);
        reset();
        continue;
      }
      regions.push({
        startLine,
        endLine: i,
        currentLabel,
        incomingLabel: end[1] ?? "",
        baseLabel,
        currentLines,
        incomingLines,
        baseLines,
      });
      reset();
      continue;
    }

    switch (state) {
      case "current":
        currentLines.push(line);
        break;
      case "base":
        baseLines?.push(line);
        break;
      case "incoming":
        incomingLines.push(line);
        break;
      case "outside":
        break;
    }
  }

  if (state !== "outside") {
    diagnostics.push(`Unterminated conflict region starting at line ${startLine + 1}`);
  }

  return { regions, diagnostics };
}

export function hasConflictMarkers(lines: string[]): boolean {
  return lines.some((line) => START.test(line) || END.test(line));
}

/**
 * Rebuilds the three merge inputs from a single conflicted file, so the
 * regular analysis pipeline can run on a file opened by itself (e.g. from
 * the Explorer context menu). Shared context outside the regions goes to
 * every side; each region contributes its own lines. Standard markers carry
 * no base section, so there the base keeps only the context and both sides
 * read as insertions at the same point — an add/add conflict, like git.
 *
 * Returns null when the file has no complete conflict region.
 */
export function reconstructSides(lines: string[]): ReconstructedSides | null {
  const { regions } = parseConflictMarkers(lines);
  if (regions.length === 0) return null;

  const baseLines: string[] = [];
  const currentLines: string[] = [];
  const incomingLines: string[] = [];
  let cursor = 0;
  for (const region of regions) {
    const context = lines.slice(cursor, region.startLine);
    baseLines.push(...context, ...(region.baseLines ?? []));
    currentLines.push(...context, ...region.currentLines);
    incomingLines.push(...context, ...region.incomingLines);
    cursor = region.endLine + 1;
  }
  const tail = lines.slice(cursor);
  baseLines.push(...tail);
  currentLines.push(...tail);
  incomingLines.push(...tail);

  const first = regions[0];
  return {
    baseLines,
    currentLines,
    incomingLines,
    currentLabel: first.currentLabel || undefined,
    incomingLabel: first.incomingLabel || undefined,
  };
}
