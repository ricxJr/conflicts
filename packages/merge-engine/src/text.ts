/** Text utilities. The engine always works on `\n`-normalized text. */

export interface SplitResult {
  lines: string[];
  /** True when the original text ended with a newline. */
  trailingNewline: boolean;
}

export function splitLines(text: string): SplitResult {
  if (text === "") return { lines: [], trailingNewline: false };
  const trailingNewline = text.endsWith("\n");
  const body = trailingNewline ? text.slice(0, -1) : text;
  return { lines: body.split("\n"), trailingNewline };
}

export function joinLines(lines: string[], trailingNewline: boolean): string {
  if (lines.length === 0) return "";
  return lines.join("\n") + (trailingNewline ? "\n" : "");
}

export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function linesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
