/** Contract between the React frontend and the Rust backend (serde camelCase). */

export type EncodingKind = "utf-8" | "utf-8-bom";
export type EolKind = "lf" | "crlf" | "mixed";

export interface FileSnapshot {
  path: string;
  fileName: string;
  /** Content normalized to `\n`. */
  content: string;
  encoding: EncodingKind;
  eol: EolKind;
  trailingNewline: boolean;
  /** SHA-256 of the raw bytes on disk. */
  hash: string;
  sizeBytes: number;
  /** True when invalid UTF-8 bytes were replaced during decoding. */
  hadDecodeErrors: boolean;
}

export interface CliContext {
  basePath?: string;
  currentPath: string;
  incomingPath: string;
  resultPath: string;
  repoPath?: string;
  title?: string;
  currentLabel?: string;
  incomingLabel?: string;
  readonly: boolean;
  noBackup: boolean;
  /**
   * True for `--file <path>` launches (Explorer context menu / "Open with"):
   * current/incoming/result all point at the same conflicted file and the
   * sides are rebuilt from its conflict markers.
   */
  singleFile?: boolean;
}

export type LaunchMode = "merge" | "settings";

/** How MergeScope was launched — decides the screen before any file is read. */
export interface LaunchContext {
  mode: LaunchMode;
  /** Set when a --file launch pointed at a file without conflict markers. */
  noConflictPath?: string;
}

export type GitOperation = "merge" | "rebase" | "cherry-pick" | "unknown";

/** Identity of the commit backing one side of the conflict. */
export interface CommitInfo {
  /** Full 40-char object name. */
  sha: string;
  /** Abbreviated hash git chose (unambiguous in this repo). */
  shortSha: string;
  author: string;
  /** First line of the commit message. */
  subject: string;
}

export interface GitContext {
  worktreeRoot?: string;
  branch?: string;
  operation: GitOperation;
  /** Branch name of the "ours" side (current/LOCAL), when detectable. */
  currentBranch?: string;
  /** Branch name of the "theirs" side (incoming/REMOTE), when detectable. */
  incomingBranch?: string;
  /** Commit backing the "ours" side (HEAD/onto), when detectable. */
  currentCommit?: CommitInfo;
  /** Commit backing the "theirs" side (MERGE_HEAD/etc.), when detectable. */
  incomingCommit?: CommitInfo;
  /** Raw `origin` remote URL, used to build a web link to each commit. */
  remoteUrl?: string;
}

export interface OpenSessionOutput {
  cli: CliContext;
  files: {
    base?: FileSnapshot;
    current: FileSnapshot;
    incoming: FileSnapshot;
    result: FileSnapshot;
  };
  git?: GitContext;
}

export interface SaveResultOutput {
  hash: string;
}

export interface BackendError {
  code: "external-change" | "read-error" | "write-error" | "invalid-session" | "internal";
  message: string;
}

export type ThemeName = "dark" | "light" | "system" | "high-contrast" | "custom";
export type Language = "en" | "pt-br";
/**
 * How the app window opens:
 * - "default": restore the last size/position (window-state plugin);
 * - "maximized": fill the work area, keeping the title bar (tela cheia);
 * - "fullscreen": true OS fullscreen with no window chrome.
 */
export type WindowStartMode = "default" | "maximized" | "fullscreen";

/** Every color token the UI and editors expose for the "custom" theme. */
export interface CustomTheme {
  bg: string;
  bgElevated: string;
  bgPanelHeader: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  danger: string;
  ok: string;
  warn: string;
  conflict: string;
  independent: string;
  resolved: string;
  reviewed: string;
  /** Diff added/removed backgrounds inside the Monaco editors. */
  diffInserted: string;
  diffRemoved: string;
  editorBg: string;
}

/** Seed for the custom theme = the built-in dark palette (global.css / monaco.ts). */
export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  bg: "#0b1029",
  bgElevated: "#111c44",
  bgPanelHeader: "#182452",
  border: "#2a3564",
  text: "#e9edf7",
  textDim: "#9aa8c7",
  accent: "#7a5cff",
  danger: "#f53c5b",
  ok: "#01b574",
  warn: "#ffb547",
  conflict: "#f53c5b",
  independent: "#b982ff",
  resolved: "#01b574",
  reviewed: "#2d8cff",
  diffInserted: "#01b574",
  diffRemoved: "#f53c5b",
  editorBg: "#111c44",
};

export interface Preferences {
  theme: ThemeName;
  customTheme: CustomTheme;
  language: Language;
  /** Empty string = inherit the built-in default font. */
  uiFontFamily: string;
  editorFontFamily: string;
  uiFontSize: number;
  editorFontSize: number;
  /** Overrides on top of DEFAULT_KEYBINDINGS: commandId -> chord. */
  keybindings: Record<string, string>;
  showBasePanel: boolean;
  showConflictList: boolean;
  conflictListWidth: number;
  conflictListCollapsed: boolean;
  hideUnchangedRegions: boolean;
  ignoreWhitespace: boolean;
  /** Render whitespace glyphs (· for spaces, → for tabs) in every editor. */
  renderWhitespace: boolean;
  /** Default tab width (columns) for files without a per-extension override. */
  tabSize: number;
  /**
   * Per-extension tab-width overrides. Keys are lowercase extensions without
   * the dot (e.g. "mac", "cls"); the value wins over `tabSize` for that type.
   * User-owned: it replaces the default map wholesale when persisted, so an
   * extension the user removed here stays removed.
   */
  tabSizeOverrides: Record<string, number>;
  showResultMinimap: boolean;
  createBackup: boolean;
  topPanelRatio: number;
  resultPanelRatio: number;
  /** Horizontal split between the Current panel and the rest of the diff row. */
  diffSplitRatio: number;
  /** Persisted size (px) of the single-side commit diff viewer, so it sticks. */
  commitDiffWidth: number;
  commitDiffHeight: number;
  /** How the window opens: last size, maximized, or true fullscreen. */
  windowStartMode: WindowStartMode;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  customTheme: DEFAULT_CUSTOM_THEME,
  language: "en",
  uiFontFamily: "",
  editorFontFamily: "",
  uiFontSize: 13,
  editorFontSize: 13,
  keybindings: {},
  showBasePanel: false,
  showConflictList: true,
  conflictListWidth: 230,
  conflictListCollapsed: false,
  hideUnchangedRegions: false,
  ignoreWhitespace: false,
  renderWhitespace: false,
  tabSize: 4,
  tabSizeOverrides: { mac: 10, cls: 10 },
  showResultMinimap: true,
  createBackup: false,
  topPanelRatio: 0.5,
  resultPanelRatio: 0.45,
  diffSplitRatio: 0.5,
  commitDiffWidth: 1100,
  commitDiffHeight: 720,
  windowStartMode: "default",
};
