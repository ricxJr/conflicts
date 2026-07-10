/**
 * Backend access layer. When running inside Tauri, calls the Rust commands.
 * When running in a plain browser (vite dev / vitest), falls back to an
 * in-memory demo session so the UI can be exercised standalone.
 */
import type { OpenSessionOutput, Preferences, SaveResultOutput } from "../types/session";
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
    git: { operation: "merge", branch: "feature/discounts", worktreeRoot: "demo" },
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

export async function getPreferences(): Promise<Preferences> {
  if (isTauri()) {
    try {
      const stored = await invoke<Partial<Preferences> | null>("get_preferences");
      return { ...DEFAULT_PREFERENCES, ...(stored ?? {}) };
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
