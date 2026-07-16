import { create } from "zustand";
import {
  analyzeMerge,
  buildResult,
  hasConflictMarkers,
  isConflicting,
  joinLines,
  normalizeEol,
  parseConflictMarkers,
  reconstructSides,
  resolutionOutput,
  splitLines,
  type BuildResultOutput,
  type ConflictGroup,
  type MergeAnalysis,
  type Resolution,
  type ResolutionStrategy,
} from "@mergescope/merge-engine";
import type { BackendError, CommitInfo, OpenSessionOutput, Preferences } from "../types/session";
import { DEFAULT_PREFERENCES } from "../types/session";
import * as backend from "../services/backend";
import { editors, revealBaseLine } from "./controllers";
import i18n from "../i18n";

export type Phase = "loading" | "ready" | "settings" | "error";

export interface RevealOptions {
  /** Scroll the top diff panels to the group's base line (default true). */
  revealPanels?: boolean;
  /** Scroll/position the result editor on the group's region (default true). */
  revealResult?: boolean;
}

export interface DialogState {
  kind: "confirm-cancel" | "confirm-save-unresolved" | "external-change" | "info";
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  extraActions?: { label: string; action: () => void }[];
}

interface SessionStore {
  phase: Phase;
  errorMessage?: string;
  /** Settings mode via --file: the file that turned out to have no conflict. */
  noConflictPath?: string;
  session?: OpenSessionOutput;
  analysis?: MergeAnalysis;
  initialResult?: BuildResultOutput;
  groups: ConflictGroup[];
  activeIndex: number;
  unresolvedCount: number;
  dirty: boolean;
  savedCleanly: boolean;
  resultHash: string;
  prefs: Preferences;
  paletteOpen: boolean;
  settingsOpen: boolean;
  /** Commit whose diff is shown in the in-app viewer, plus which side it backs. */
  commitDiff: { commit: CommitInfo; side: "left" | "right" } | null;
  dialog: DialogState | null;
  cursor: { line: number; column: number };

  init(): Promise<void>;
  currentLabel(): string;
  incomingLabel(): string;
  displayCurrentLabel(): string;
  displayIncomingLabel(): string;
  applyStrategy(groupId: string, strategy: ResolutionStrategy): void;
  applyStrategyToAll(strategy: "current" | "incoming"): void;
  resetGroup(groupId: string): void;
  markReviewed(groupId: string): void;
  setActiveIndex(index: number, opts?: RevealOptions): void;
  activateGroupAtBaseLine(baseLine: number, opts?: RevealOptions): void;
  nextConflict(): void;
  prevConflict(): void;
  onRegionsEdited(changedGroupIds: string[]): void;
  save(closeAfter: boolean): Promise<void>;
  cancel(): void;
  setPrefs(patch: Partial<Preferences>): void;
  setPaletteOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  openCommitDiff(commit: CommitInfo, side: "left" | "right"): void;
  closeCommitDiff(): void;
  setDialog(dialog: DialogState | null): void;
  setCursor(line: number, column: number): void;
  rebuildResult(): void;
}

function countUnresolved(groups: ConflictGroup[]): number {
  return groups.filter((g) => g.status === "unresolved").length;
}

function makeResolution(strategy: ResolutionStrategy, manualLines?: string[]): Resolution {
  return { strategy, manualLines, updatedAt: new Date().toISOString() };
}

export const useSession = create<SessionStore>((set, get) => ({
  phase: "loading",
  groups: [],
  activeIndex: 0,
  unresolvedCount: 0,
  dirty: false,
  savedCleanly: false,
  resultHash: "",
  prefs: DEFAULT_PREFERENCES,
  paletteOpen: false,
  settingsOpen: false,
  commitDiff: null,
  dialog: null,
  cursor: { line: 1, column: 1 },

  async init() {
    try {
      const [prefs, launch] = await Promise.all([
        backend.getPreferences(),
        backend.getLaunchContext(),
      ]);
      void i18n.changeLanguage(prefs.language);

      // Settings-only mode: no files to merge, open straight into the
      // preferences so theme/language/etc. can be adjusted and persisted.
      if (launch.mode === "settings") {
        set({
          phase: "settings",
          prefs,
          settingsOpen: true,
          noConflictPath: launch.noConflictPath,
        });
        return;
      }

      let session = await backend.openMergeSession();
      if (session.cli.singleFile) {
        session = expandSingleFileSession(session);
      }
      const analysis = analyzeMerge(
        session.files.base?.content,
        session.files.current.content,
        session.files.incoming.content,
      );
      const initialResult = buildResult(analysis.baseLines, analysis.groups, {
        currentLabel: session.cli.currentLabel ?? i18n.t("marker.current"),
        incomingLabel: session.cli.incomingLabel ?? i18n.t("marker.incoming"),
      });
      const firstUnresolved = analysis.groups.findIndex((g) => g.status === "unresolved");
      set({
        phase: "ready",
        prefs,
        session,
        analysis,
        initialResult,
        groups: analysis.groups,
        activeIndex: firstUnresolved >= 0 ? firstUnresolved : 0,
        unresolvedCount: countUnresolved(analysis.groups),
        resultHash: session.files.result.hash,
        savedCleanly: false,
        dirty: false,
      });
    } catch (error) {
      set({
        phase: "error",
        errorMessage:
          typeof error === "string" ? error : ((error as BackendError)?.message ?? String(error)),
      });
    }
  },

  currentLabel() {
    return get().session?.cli.currentLabel ?? i18n.t("marker.current");
  },
  incomingLabel() {
    return get().session?.cli.incomingLabel ?? i18n.t("marker.incoming");
  },

  // Marker labels above keep whatever the CLI passed (git semantics); for the
  // UI the detected branch name is far more recognizable than HEAD/CURRENT.
  displayCurrentLabel() {
    return get().session?.git?.currentBranch ?? get().currentLabel();
  },
  displayIncomingLabel() {
    return get().session?.git?.incomingBranch ?? get().incomingLabel();
  },

  applyStrategy(groupId, strategy) {
    const { analysis, groups } = get();
    const group = groups.find((g) => g.id === groupId);
    if (!analysis || !group) return;

    const resolution = makeResolution(strategy);
    const lines = resolutionOutput(analysis.baseLines, group, resolution);
    editors.result?.replaceRegion(groupId, lines);

    set({
      groups: groups.map((g) => (g.id === groupId ? { ...g, status: "resolved", resolution } : g)),
      dirty: true,
    });
    set((s) => ({ unresolvedCount: countUnresolved(s.groups) }));
  },

  applyStrategyToAll(strategy) {
    const { analysis, groups } = get();
    if (!analysis || groups.length === 0) return;

    // One resolution object per group so later edits don't share timestamps.
    const resolved = groups.map((group) => {
      const resolution = makeResolution(strategy);
      const lines = resolutionOutput(analysis.baseLines, group, resolution);
      editors.result?.replaceRegion(group.id, lines);
      return { ...group, status: "resolved" as const, resolution };
    });

    set({ groups: resolved, dirty: true, unresolvedCount: 0 });
  },

  resetGroup(groupId) {
    const { analysis, groups, currentLabel, incomingLabel } = get();
    const group = groups.find((g) => g.id === groupId);
    if (!analysis || !group) return;

    const conflicting = isConflicting(group);
    if (conflicting) {
      // Restore the conflict-marker block.
      const markerGroup: ConflictGroup = { ...group, status: "unresolved", resolution: undefined };
      const rebuilt = buildResult(analysis.baseLines, [markerGroup], {
        currentLabel: currentLabel(),
        incomingLabel: incomingLabel(),
      });
      const region = rebuilt.regions[0];
      editors.result?.replaceRegion(groupId, rebuilt.lines.slice(region.startLine, region.endLine));
      set({
        groups: groups.map((g) =>
          g.id === groupId ? { ...g, status: "unresolved", resolution: undefined } : g,
        ),
        dirty: true,
      });
    } else {
      // Non-conflicting groups reset to their automatic resolution.
      const original = analysis.groups.find((g) => g.id === groupId);
      const resolution = original?.resolution;
      if (!resolution) return;
      const lines = resolutionOutput(analysis.baseLines, group, resolution);
      editors.result?.replaceRegion(groupId, lines);
      set({
        groups: groups.map((g) =>
          g.id === groupId ? { ...g, status: "resolved", resolution } : g,
        ),
        dirty: true,
      });
    }
    set((s) => ({ unresolvedCount: countUnresolved(s.groups) }));
  },

  markReviewed(groupId) {
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId && g.status !== "unresolved" ? { ...g, status: "reviewed" } : g,
      ),
    }));
  },

  setActiveIndex(index, opts) {
    const { groups } = get();
    if (groups.length === 0) return;
    const clamped = ((index % groups.length) + groups.length) % groups.length;
    set({ activeIndex: clamped });
    const group = groups[clamped];
    if (opts?.revealPanels !== false) revealBaseLine(group.baseRange.start);
    if (opts?.revealResult !== false) editors.result?.revealGroup(group.id);
  },

  activateGroupAtBaseLine(baseLine, opts) {
    const { groups, activeIndex } = get();
    // Nearest group within one line of the click; covers insertion points,
    // whose clicked side lines map to the base line just before the range.
    let best = -1;
    let bestDist = 2;
    groups.forEach((group, i) => {
      const { start, end } = group.baseRange;
      const dist =
        end > start
          ? baseLine < start
            ? start - baseLine
            : baseLine >= end
              ? baseLine - end + 1
              : 0
          : Math.abs(baseLine - start);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best >= 0 && best !== activeIndex) get().setActiveIndex(best, opts);
  },

  nextConflict() {
    get().setActiveIndex(get().activeIndex + 1);
  },
  prevConflict() {
    get().setActiveIndex(get().activeIndex - 1);
  },

  onRegionsEdited(changedGroupIds) {
    if (changedGroupIds.length === 0) return;
    const { groups } = get();
    const updated = groups.map((g) => {
      if (!changedGroupIds.includes(g.id)) return g;
      const lines = editors.result?.getRegionLines(g.id) ?? [];
      if (hasConflictMarkers(lines)) {
        return { ...g, status: "unresolved" as const, resolution: undefined };
      }
      return {
        ...g,
        status: "resolved" as const,
        resolution: makeResolution("manual", lines),
      };
    });
    set({ groups: updated, dirty: true, unresolvedCount: countUnresolved(updated) });
  },

  async save(closeAfter) {
    const state = get();
    const controller = editors.result;
    if (!controller || !state.session) return;

    const text = controller.getText();
    const { lines } = splitLines(text);
    const unresolvedMarkers = hasConflictMarkers(lines);

    const doSave = async (allowOverwrite: boolean) => {
      try {
        const saved = await backend.saveMergeResult(text, get().resultHash, allowOverwrite);
        const cleanly = !unresolvedMarkers && countUnresolved(get().groups) === 0;
        set({ dirty: false, savedCleanly: cleanly, resultHash: saved.hash, dialog: null });
        await backend.setExitCode(cleanly ? 0 : 1);
        if (closeAfter) await backend.exitApp(cleanly ? 0 : 1);
      } catch (error) {
        const err = error as BackendError;
        if (err?.code === "external-change") {
          set({
            dialog: {
              kind: "external-change",
              title: i18n.t("dialog.externalChange.title"),
              message: i18n.t("dialog.externalChange.message"),
              confirmLabel: i18n.t("dialog.externalChange.confirm"),
              onConfirm: () => void doSave(true),
            },
          });
        } else {
          set({
            dialog: {
              kind: "info",
              title: i18n.t("dialog.saveFailed.title"),
              message: err?.message ?? String(error),
            },
          });
        }
      }
    };

    if (unresolvedMarkers) {
      set({
        dialog: {
          kind: "confirm-save-unresolved",
          title: i18n.t("dialog.unresolved.title"),
          message: i18n.t("dialog.unresolved.message"),
          confirmLabel: i18n.t("dialog.unresolved.confirm"),
          onConfirm: () => void doSave(false),
        },
      });
      return;
    }
    await doSave(false);
  },

  cancel() {
    const { dirty } = get();
    const doCancel = () => void backend.exitApp(1);
    if (dirty) {
      set({
        dialog: {
          kind: "confirm-cancel",
          title: i18n.t("dialog.discard.title"),
          message: i18n.t("dialog.discard.message"),
          confirmLabel: i18n.t("dialog.discard.confirm"),
          onConfirm: doCancel,
        },
      });
      return;
    }
    doCancel();
  },

  setPrefs(patch) {
    set((s) => {
      const prefs = { ...s.prefs, ...patch };
      if (patch.language && patch.language !== s.prefs.language) {
        // Unresolved conflicts already in the result editor embed the
        // CURRENT/INCOMING fallback marker text baked in at build time, so
        // switching languages needs an explicit rebuild to retranslate them.
        void i18n.changeLanguage(patch.language).then(() => get().rebuildResult());
      }
      void backend.savePreferences(prefs);
      return { prefs };
    });
  },

  setPaletteOpen(open) {
    set({ paletteOpen: open });
  },

  setSettingsOpen(open) {
    set({ settingsOpen: open });
  },

  openCommitDiff(commit, side) {
    set({ commitDiff: { commit, side } });
  },

  closeCommitDiff() {
    set({ commitDiff: null });
  },

  setDialog(dialog) {
    set({ dialog });
  },

  setCursor(line, column) {
    set({ cursor: { line, column } });
  },

  rebuildResult() {
    // Recovery command: regenerate the whole result from current resolutions.
    const { analysis, groups, currentLabel, incomingLabel } = get();
    if (!analysis) return;
    const rebuilt = buildResult(analysis.baseLines, groups, {
      currentLabel: currentLabel(),
      incomingLabel: incomingLabel(),
    });
    set({ initialResult: rebuilt, dirty: true });
  },
}));

/**
 * Single-file launches (context menu / --file) read one conflicted file. When
 * the file is an unmerged path in a git repo the backend already replaced the
 * three inputs with the real base/ours/theirs blobs from the index, so the
 * analysis matches a mergetool launch; here we only lift the marker labels.
 * Otherwise (opened outside a repo, or already resolved in the index) the
 * three inputs are still the same file, so we rebuild the sides from its
 * markers. Either way the result keeps pointing at the same file so saving
 * writes back in place.
 */
export function expandSingleFileSession(session: OpenSessionOutput): OpenSessionOutput {
  const result = session.files.result;
  const { lines } = splitLines(normalizeEol(result.content));
  const first = parseConflictMarkers(lines).regions[0];
  const cli = {
    ...session.cli,
    currentLabel: session.cli.currentLabel ?? first?.currentLabel ?? undefined,
    incomingLabel: session.cli.incomingLabel ?? first?.incomingLabel ?? undefined,
  };

  // Real three-way inputs already came from the git index when the sides no
  // longer match the conflicted file itself (a base was provided, or a side
  // lost its markers). Keep them and only carry the labels over.
  const backendProvidedSides =
    !!session.files.base ||
    session.files.current.content !== result.content ||
    session.files.incoming.content !== result.content;
  if (backendProvidedSides) {
    return { ...session, cli };
  }

  const sides = reconstructSides(lines);
  if (!sides) {
    throw i18n.t("app.singleFile.noMarkers", { file: result.path });
  }
  const trailing = result.trailingNewline;
  return {
    ...session,
    cli,
    files: {
      base: { ...result, content: joinLines(sides.baseLines, trailing) },
      current: { ...result, content: joinLines(sides.currentLines, trailing) },
      incoming: { ...result, content: joinLines(sides.incomingLines, trailing) },
      result,
    },
  };
}

/** Serialization helper used on save paths that need the file's original EOL flags. */
export function textStats(text: string): { lineCount: number; hasMarkers: boolean } {
  const { lines } = splitLines(text);
  return { lineCount: lines.length, hasMarkers: hasConflictMarkers(lines) };
}

export { joinLines };
