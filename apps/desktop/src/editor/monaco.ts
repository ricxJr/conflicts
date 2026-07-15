/**
 * Monaco bootstrap: bundled workers (no CDN — RNF-004), semantic themes and
 * language detection by file extension.
 */
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// Result files are plain project files; disable TS semantic validation noise.
monaco.languages.typescript?.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
});
monaco.languages.typescript?.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
});

import type { CustomTheme, Preferences, ThemeName } from "../types/session";

const sharedRules: monaco.editor.ITokenThemeRule[] = [];

monaco.editor.defineTheme("mergescope-dark", {
  base: "vs-dark",
  inherit: true,
  rules: sharedRules,
  colors: {
    "editor.background": "#16181d",
    "editor.lineHighlightBackground": "#1e2128",
    "diffEditor.insertedTextBackground": "#2ea04326",
    "diffEditor.removedTextBackground": "#f8514926",
    "diffEditor.insertedLineBackground": "#2ea04315",
    "diffEditor.removedLineBackground": "#f8514915",
  },
});

monaco.editor.defineTheme("mergescope-light", {
  base: "vs",
  inherit: true,
  rules: sharedRules,
  colors: {
    "editor.background": "#ffffff",
    "diffEditor.insertedTextBackground": "#2ea04333",
    "diffEditor.removedTextBackground": "#f8514933",
  },
});

monaco.editor.defineTheme("mergescope-hc", {
  base: "hc-black",
  inherit: true,
  rules: sharedRules,
  colors: {},
});

/** Maps custom-theme tokens to the CSS custom properties in global.css. */
const CSS_VAR_MAP: Partial<Record<keyof CustomTheme, string>> = {
  bg: "--bg",
  bgElevated: "--bg-elevated",
  bgPanelHeader: "--bg-panel-header",
  border: "--border",
  text: "--text",
  textDim: "--text-dim",
  accent: "--accent",
  danger: "--danger",
  ok: "--ok",
  warn: "--warn",
  conflict: "--conflict",
  independent: "--independent",
  resolved: "--resolved",
  reviewed: "--reviewed",
};

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 140;
}

function applyCustomCssVars(theme: CustomTheme | null): void {
  const root = document.documentElement;
  for (const [token, cssVar] of Object.entries(CSS_VAR_MAP) as [keyof CustomTheme, string][]) {
    if (theme) root.style.setProperty(cssVar, theme[token]);
    else root.style.removeProperty(cssVar);
  }
}

function defineCustomMonacoTheme(theme: CustomTheme): void {
  monaco.editor.defineTheme("mergescope-custom", {
    base: isLight(theme.editorBg) ? "vs" : "vs-dark",
    inherit: true,
    rules: sharedRules,
    colors: {
      "editor.background": theme.editorBg,
      "editor.foreground": theme.text,
      "editor.lineHighlightBackground": theme.bgElevated,
      "diffEditor.insertedTextBackground": theme.diffInserted + "26",
      "diffEditor.removedTextBackground": theme.diffRemoved + "26",
      "diffEditor.insertedLineBackground": theme.diffInserted + "15",
      "diffEditor.removedLineBackground": theme.diffRemoved + "15",
    },
  });
}

export function resolveMonacoTheme(theme: ThemeName): string {
  if (theme === "custom") return "mergescope-custom";
  if (theme === "high-contrast") return "mergescope-hc";
  if (theme === "system") {
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
    return dark ? "mergescope-dark" : "mergescope-light";
  }
  return theme === "dark" ? "mergescope-dark" : "mergescope-light";
}

/** Applies theme colors (incl. the user's custom theme) and UI fonts. */
export function applyTheme(prefs: Preferences): void {
  const { theme, customTheme } = prefs;
  if (theme === "custom") {
    applyCustomCssVars(customTheme);
    defineCustomMonacoTheme(customTheme);
    monaco.editor.setTheme("mergescope-custom");
    document.documentElement.dataset.theme = isLight(customTheme.bg) ? "light" : "dark";
  } else {
    applyCustomCssVars(null);
    monaco.editor.setTheme(resolveMonacoTheme(theme));
    const effective =
      theme === "system"
        ? window.matchMedia?.("(prefers-color-scheme: dark)").matches !== false
          ? "dark"
          : "light"
        : theme;
    document.documentElement.dataset.theme = effective;
  }

  const root = document.documentElement;
  if (prefs.uiFontFamily) root.style.setProperty("--ui-font", prefs.uiFontFamily);
  else root.style.removeProperty("--ui-font");
  root.style.setProperty("--ui-font-size", `${prefs.uiFontSize}px`);
}

/**
 * Width reserved for the line-number gutter. One char wider than the largest
 * number so 4+ digit files keep a visible gap between adjacent gutters and
 * content (RF feedback: 1000+ line files became hard to read).
 */
export function lineNumberGutterChars(lineCount: number): number {
  return Math.max(4, String(Math.max(1, lineCount)).length + 1);
}

export function detectLanguage(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "plaintext";
  const ext = fileName.slice(dot).toLowerCase();
  for (const lang of monaco.languages.getLanguages()) {
    if (lang.extensions?.some((e) => e.toLowerCase() === ext)) return lang.id;
  }
  return "plaintext";
}

export { monaco };
