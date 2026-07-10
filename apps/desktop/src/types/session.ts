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
}

export type GitOperation = "merge" | "rebase" | "cherry-pick" | "unknown";

export interface GitContext {
  worktreeRoot?: string;
  branch?: string;
  operation: GitOperation;
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
  bg: "#16181d",
  bgElevated: "#1e2128",
  bgPanelHeader: "#20242c",
  border: "#2c313a",
  text: "#d7dce3",
  textDim: "#8b93a1",
  accent: "#4d9fff",
  danger: "#f85149",
  ok: "#2ea043",
  warn: "#d29922",
  conflict: "#f85149",
  independent: "#a371f7",
  resolved: "#2ea043",
  reviewed: "#58a6ff",
  diffInserted: "#2ea043",
  diffRemoved: "#f85149",
  editorBg: "#16181d",
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
  createBackup: boolean;
  topPanelRatio: number;
  resultPanelRatio: number;
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
  createBackup: false,
  topPanelRatio: 0.5,
  resultPanelRatio: 0.45,
};
