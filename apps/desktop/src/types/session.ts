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

export interface Preferences {
  theme: "dark" | "light" | "system" | "high-contrast";
  showBasePanel: boolean;
  showConflictList: boolean;
  hideUnchangedRegions: boolean;
  ignoreWhitespace: boolean;
  createBackup: boolean;
  topPanelRatio: number;
  resultPanelRatio: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "dark",
  showBasePanel: false,
  showConflictList: true,
  hideUnchangedRegions: false,
  ignoreWhitespace: false,
  createBackup: false,
  topPanelRatio: 0.5,
  resultPanelRatio: 0.45,
};
