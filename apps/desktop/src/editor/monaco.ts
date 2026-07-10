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

export type ThemeName = "dark" | "light" | "system" | "high-contrast";

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

export function resolveMonacoTheme(theme: ThemeName): string {
  if (theme === "high-contrast") return "mergescope-hc";
  if (theme === "system") {
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
    return dark ? "mergescope-dark" : "mergescope-light";
  }
  return theme === "dark" ? "mergescope-dark" : "mergescope-light";
}

export function applyTheme(theme: ThemeName): void {
  monaco.editor.setTheme(resolveMonacoTheme(theme));
  const effective =
    theme === "system"
      ? window.matchMedia?.("(prefers-color-scheme: dark)").matches !== false
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = effective;
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
