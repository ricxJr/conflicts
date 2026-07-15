# Architecture Decision Records

ADR-001 to ADR-006 come from the technical specification (§36) and were
confirmed during implementation. ADR-007+ record decisions made while building
the MVP.

## ADR-001 — Standalone desktop application

**Decision:** build an independent desktop app.
**Rationale:** integrates with any Git client via the mergetool protocol; no
IDE-specific APIs required.

## ADR-002 — `git mergetool` as the primary contract

**Decision:** the CLI accepts `--base/--current/--incoming/--result` plus the
`--local/--remote/--merged` aliases and honors the mergetool exit-code
contract.
**Rationale:** guaranteed interoperability with Git CLI, Fork, GitKraken (via
terminal), VS Code and worktrees.

## ADR-003 — Tauri instead of Electron

**Decision:** Tauri 2 + system WebView2.
**Rationale:** smaller footprint, Rust backend with least-privilege IPC
(single capability, custom commands only), native OS integration.

## ADR-004 — Monaco for rendering and editing

**Decision:** Monaco diff editors for the two top panels; Monaco editor for
the result. Workers bundled locally (no CDN).

## ADR-005 — Merge engine decoupled from Monaco

**Decision:** `@mergescope/merge-engine` is a pure TypeScript package (jsdiff
line diff + own hunk normalization, correlation, classification and
resolution application). Monaco is only a renderer.
**Rationale:** deterministic unit tests (30 tests + spec fixtures), algorithm
can be swapped later (Patience/Histogram/moves).

## ADR-006 — No network by default

**Decision:** all processing is local. CSP restricts the webview to `'self'`;
no telemetry; logs never contain file contents, full paths, repo or branch
names.

## ADR-007 — Result is derived from BASE + resolutions, not from MERGED

**Decision:** the initial result buffer is rebuilt by the engine from the
three inputs: safe groups (single-sided, same-change, independent) are
auto-applied and flagged for review; conflicting groups are emitted as
standard conflict-marker blocks. The `MERGED` file's markers are parsed for
diagnostics, and `MERGED` metadata (encoding/EOL/hash) governs saving.
**Rationale:** guarantees exact region tracking for resolution actions and
never inherits ambiguity from partially-edited marker files. Trade-off:
manual pre-edits made to `MERGED` _before_ opening MergeScope are not carried
into the initial buffer (the engine recomputes an equivalent or better
merge). Revisit if real-world usage shows people pre-edit before launching
the tool.

## ADR-008 — Region tracking via Monaco decorations

**Decision:** each conflict group owns a tracked decoration in the result
editor (`AlwaysGrowsWhenTypingAtEdges`). Actions replace the decoration's
current range; manual edits inside a region reclassify it (markers present →
unresolved; otherwise → resolved/manual).
**Rationale:** users get completely free editing of the result while
Accept/Reset actions keep working, without a custom text-anchoring layer.

## ADR-009 — Exit code semantics for "saved with markers"

**Decision:** saving a result that still contains conflict markers is allowed
(after an explicit confirmation) but the process exits with code 1, so Git
keeps the file as conflicted.
**Rationale:** spec §16.3 defines exit 1 as "canceled **or left unresolved**";
this preserves the user's partial work without lying to Git.

## ADR-010 — MSVC toolchain, NSIS installer, per-user install

**Decision:** build with `x86_64-pc-windows-msvc`; ship an NSIS installer in
per-user mode.
**Rationale:** MSVC is the supported Tauri target on Windows; per-user install
avoids elevation and matches the "developer tool" profile.

## ADR-011 — Cross-panel alignment via arithmetic view zones

**Decision:** keep the two top panels vertically aligned by inserting hatched
filler view zones (`.msr-align-filler`) after each change cluster, sized so
both panels consume the same number of rows. Filler rows are derived
arithmetically from each diff editor's own `getLineChanges()` (union-merged
into base-interval clusters), never from pixel measurement and never from the
merge engine's hunks. Scroll sync then simply mirrors `scrollTop` between the
visible (modified) editors. Alignment is disabled while "changes only"
(hidden unchanged regions) is active, where per-panel folding makes row math
meaningless; scroll sync falls back to base-line anchoring there.
**Rationale:** using Monaco's own diff keeps the filler consistent with what
is rendered (including the ignore-whitespace toggle); arithmetic zones are
font-size independent (`heightInLines`) and avoid measure/re-layout feedback
loops. The math differs per view mode: side by side only the insertion excess
adds rows; the inline view stacks removed + added rows, so every modified
line counts (see `features/diffGeometry.ts`, unit-tested).
