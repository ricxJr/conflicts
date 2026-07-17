/**
 * Backend access layer. When running inside Tauri, calls the Rust commands.
 * When running in a plain browser (vite dev / vitest), falls back to an
 * in-memory demo session so the UI can be exercised standalone.
 */
import type {
  LaunchContext,
  OpenSessionOutput,
  Preferences,
  SaveResultOutput,
  WindowStartMode,
} from "../types/session";
import { DEFAULT_PREFERENCES } from "../types/session";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const DEMO_BASE = `import { Order } from "./order";

export function processOrder(order: Order) {
  validateOrder(order);
  calculateTotal(order);
  saveOrder(order);
}

const timeout = 3000;

export function retry(times: number) {
  for (let i = 0; i < times; i++) {
    attempt(i);
  }
}
`;

const DEMO_CURRENT = `import { Order } from "./order";

export function processOrder(order: Order) {
  validateOrder(order);
  applyDiscount(order);
  calculateTotal(order);
  saveOrder(order);
}

const timeout = 5000;

export function retry(times: number) {
  for (let i = 0; i < times; i++) {
    attempt(i);
  }
}
`;

const DEMO_INCOMING = `import { Order } from "./order";

export function processOrder(order: Order) {
  validateOrder(order);
  calculateTotal(order);
  validateCreditLimit(order);
  saveOrder(order);
}

const requestTimeout = 3000;

export function retry(times: number) {
  for (let i = 0; i < times; i++) {
    attempt(i);
  }
}
`;

/** Demo file for `?mode=single-file`: one file with standard conflict markers. */
const DEMO_CONFLICTED = `import { Order } from "./order";

export function processOrder(order: Order) {
  validateOrder(order);
<<<<<<< HEAD
  applyDiscount(order);
  calculateTotal(order);
=======
  calculateTotal(order);
  validateCreditLimit(order);
>>>>>>> feature/credit-limit
  saveOrder(order);
}

<<<<<<< HEAD
const timeout = 5000;
=======
const requestTimeout = 3000;
>>>>>>> feature/credit-limit

export function retry(times: number) {
  for (let i = 0; i < times; i++) {
    attempt(i);
  }
}
`;

/** Browser-only knob so demo mode can exercise the non-merge launch paths. */
function demoModeParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mode");
}

export async function getLaunchContext(): Promise<LaunchContext> {
  if (isTauri()) return invoke<LaunchContext>("get_launch_context");
  if (demoModeParam() === "settings") {
    const file = new URLSearchParams(window.location.search).get("file");
    return { mode: "settings", noConflictPath: file ?? undefined };
  }
  return { mode: "merge" };
}

function demoSnapshot(path: string, content: string) {
  return {
    path,
    fileName: path.split(/[\\/]/).pop() ?? path,
    content,
    encoding: "utf-8" as const,
    eol: "lf" as const,
    trailingNewline: true,
    hash: `demo-${content.length}`,
    sizeBytes: content.length,
    hadDecodeErrors: false,
  };
}

export async function openMergeSession(): Promise<OpenSessionOutput> {
  if (isTauri()) return invoke<OpenSessionOutput>("open_merge_session");
  if (demoModeParam() === "single-file") {
    const path = "demo/OrderService.ts";
    const snapshot = demoSnapshot(path, DEMO_CONFLICTED);
    return {
      cli: {
        currentPath: path,
        incomingPath: path,
        resultPath: path,
        readonly: false,
        noBackup: true,
        singleFile: true,
      },
      files: {
        current: snapshot,
        incoming: snapshot,
        result: snapshot,
      },
    };
  }
  return {
    cli: {
      currentPath: "demo/OrderService_LOCAL.ts",
      incomingPath: "demo/OrderService_REMOTE.ts",
      basePath: "demo/OrderService_BASE.ts",
      resultPath: "demo/OrderService.ts",
      readonly: false,
      noBackup: true,
    },
    files: {
      base: demoSnapshot("demo/OrderService_BASE.ts", DEMO_BASE),
      current: demoSnapshot("demo/OrderService_LOCAL.ts", DEMO_CURRENT),
      incoming: demoSnapshot("demo/OrderService_REMOTE.ts", DEMO_INCOMING),
      result: demoSnapshot("demo/OrderService.ts", DEMO_CURRENT),
    },
    git: {
      operation: "merge",
      branch: "feature/discounts",
      worktreeRoot: "demo",
      currentBranch: "feature/discounts",
      incomingBranch: "feature/credit-limit",
      currentCommit: {
        sha: "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d",
        shortSha: "1a2b3c4",
        author: "Ada Lovelace",
        subject: "Apply order discount before totals",
      },
      incomingCommit: {
        sha: "9f8e7d6c5b4a3928170615243342516071829304",
        shortSha: "9f8e7d6",
        author: "Alan Turing",
        subject: "Enforce customer credit limit",
      },
      remoteUrl: "git@github.com:mergescope/demo.git",
    },
  };
}

export async function saveMergeResult(
  content: string,
  expectedHash: string,
  allowOverwrite: boolean,
): Promise<SaveResultOutput> {
  if (isTauri()) {
    return invoke<SaveResultOutput>("save_merge_result", {
      content,
      expectedHash,
      allowOverwrite,
    });
  }
  return { hash: `demo-${content.length}` };
}

/**
 * Applies the window's display mode. No-op in the browser demo. Driven by the
 * `windowStartMode` preference so the choice sticks across launches, while the
 * window-state plugin remembers size/position in "default" mode.
 *
 * "default" only clears fullscreen (it leaves maximize to the plugin/user, so
 * a restored maximized window stays maximized); "maximized" fills the work
 * area keeping the title bar; "fullscreen" is true OS fullscreen.
 */
export async function applyWindowStartMode(mode: WindowStartMode): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    if (mode === "fullscreen") {
      await win.setFullscreen(true);
      return;
    }
    await win.setFullscreen(false);
    if (mode === "maximized") await win.maximize();
  } catch {
    // Window control is best-effort; never block the merge flow on it.
  }
}

export async function setExitCode(code: number): Promise<void> {
  if (isTauri()) await invoke("set_exit_code", { code });
}

export async function exitApp(code: number): Promise<void> {
  if (isTauri()) {
    await invoke("exit_app", { code });
    return;
  }
  console.info(`[demo] exit requested with code ${code}`);
}

/**
 * Merge stored prefs over the defaults. `customTheme` and `keybindings` are
 * nested objects, so they need a deep merge — a shallow spread would drop any
 * token/binding introduced after the settings file was last written.
 */
export function mergePreferences(stored: Partial<Preferences> | null): Preferences {
  // `openFullscreen` was the legacy boolean; strip it here and migrate below.
  const { openFullscreen, ...s } = (stored ?? {}) as Partial<Preferences> & {
    openFullscreen?: boolean;
  };
  const merged: Preferences = {
    ...DEFAULT_PREFERENCES,
    ...s,
    customTheme: { ...DEFAULT_PREFERENCES.customTheme, ...(s.customTheme ?? {}) },
    keybindings: { ...DEFAULT_PREFERENCES.keybindings, ...(s.keybindings ?? {}) },
  };
  // Migrate the old boolean: a stored `openFullscreen: true` becomes the
  // "fullscreen" mode when no explicit windowStartMode was ever saved.
  if (s.windowStartMode === undefined && openFullscreen) {
    merged.windowStartMode = "fullscreen";
  }
  return merged;
}

export async function getPreferences(): Promise<Preferences> {
  if (isTauri()) {
    try {
      const stored = await invoke<Partial<Preferences> | null>("get_preferences");
      return mergePreferences(stored);
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }
  return DEFAULT_PREFERENCES;
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  if (isTauri()) {
    try {
      await invoke("save_preferences", { prefs });
    } catch {
      // Preferences are best-effort; never block the merge flow on them.
    }
  }
}
