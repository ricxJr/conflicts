import type { ConflictMarkerParseResult, ConflictMarkerRegion } from "./types";

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
