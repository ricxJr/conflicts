import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  analyzeMerge,
  buildResult,
  hasConflictMarkers,
  joinLines,
  normalizeEol,
} from "../src/index";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "fixtures");

interface FixtureMeta {
  name: string;
  classification: string;
  autoResolvable: boolean;
  eol: string;
  encoding: string;
}

function loadFixture(dir: string) {
  const read = (file: string) => {
    // Strip a UTF-8 BOM if present (the Rust backend does this in production).
    const raw = readFileSync(join(fixturesDir, dir, file));
    const body = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf ? raw.subarray(3) : raw;
    return body.toString("utf-8");
  };
  const meta = JSON.parse(read("metadata.json")) as FixtureMeta;
  return {
    meta,
    base: read("base.txt"),
    current: read("current.txt"),
    incoming: read("incoming.txt"),
    expected: read("merged.expected.txt"),
  };
}

describe("spec fixtures (§28.4)", () => {
  const dirs = readdirSync(fixturesDir);
  expect(dirs.length).toBeGreaterThanOrEqual(6);

  for (const dir of dirs) {
    it(`handles fixture '${dir}'`, () => {
      const { meta, base, current, incoming, expected } = loadFixture(dir);
      const analysis = analyzeMerge(base, current, incoming);
      expect(analysis.groups.length).toBeGreaterThan(0);

      const { lines } = buildResult(analysis.baseLines, analysis.groups);
      const text = joinLines(lines, true);

      if (meta.autoResolvable) {
        // Safe fixtures must fully auto-resolve to the expected merge.
        expect(analysis.groups.every((g) => g.status !== "unresolved")).toBe(true);
        expect(hasConflictMarkers(lines)).toBe(false);
        expect(text).toBe(normalizeEol(expected));
      } else {
        // Conflicting fixtures must surface as unresolved marker blocks —
        // never silently pick a side.
        expect(analysis.groups.some((g) => g.status === "unresolved")).toBe(true);
        expect(hasConflictMarkers(lines)).toBe(true);
      }
    });
  }

  it("collapses whitespace-only sides when ignoreWhitespace is enabled", () => {
    const { base, current, incoming } = loadFixture("whitespace");
    const analysis = analyzeMerge(base, current, incoming, { ignoreWhitespace: true });
    // The indentation-only change on current disappears; incoming's comment
    // change remains as the only (auto-resolvable) group.
    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].classification).toBe("incoming-only");
  });
});
