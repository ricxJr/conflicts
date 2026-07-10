/**
 * Imperative bridge between the store and the Monaco editors.
 * Editors register themselves on mount; store actions drive them.
 */
import type { monaco } from "../editor/monaco";

export interface ResultController {
  /** Replaces a group's region with the given lines (undo-able edit). */
  replaceRegion(groupId: string, lines: string[]): void;
  /** Current text lines of a group's region ([] when collapsed). */
  getRegionLines(groupId: string): string[];
  /** 1-based [startLine, endLineExclusive) of a region, or null. */
  getRegionSpan(groupId: string): { startLine: number; endLine: number } | null;
  getText(): string;
  revealGroup(groupId: string): void;
  focus(): void;
}

interface Registry {
  left?: monaco.editor.IStandaloneDiffEditor;
  right?: monaco.editor.IStandaloneDiffEditor;
  result?: ResultController;
  resultEditor?: monaco.editor.IStandaloneCodeEditor;
}

export const editors: Registry = {};

export function revealBaseLine(baseLine: number): void {
  const line = Math.max(1, baseLine + 1);
  editors.left?.getOriginalEditor().revealLineInCenter(line);
  editors.right?.getOriginalEditor().revealLineInCenter(line);
}
