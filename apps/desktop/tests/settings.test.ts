import { describe, expect, it } from "vitest";
import {
  chordFromEvent,
  effectiveKeybindings,
  formatChord,
  invertKeybindings,
  isDispatchableChord,
  DEFAULT_KEYBINDINGS,
} from "../src/features/keybindings";
import { mergePreferences } from "../src/services/backend";
import { DEFAULT_PREFERENCES } from "../src/types/session";
import en from "../src/i18n/locales/en.json";
import ptBR from "../src/i18n/locales/pt-br.json";

describe("keybindings", () => {
  it("builds a canonical chord from an event", () => {
    expect(chordFromEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }))).toBe(
      "Ctrl+S",
    );
    expect(
      chordFromEvent(new KeyboardEvent("keydown", { key: "P", ctrlKey: true, shiftKey: true })),
    ).toBe("Ctrl+Shift+P");
    expect(chordFromEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true }))).toBe(
      "Alt+ArrowDown",
    );
    expect(chordFromEvent(new KeyboardEvent("keydown", { key: "Escape" }))).toBe("Escape");
  });

  it("returns empty for modifier-only events", () => {
    expect(chordFromEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true }))).toBe(
      "",
    );
  });

  it("only dispatches chords with a modifier or safe standalone key", () => {
    expect(isDispatchableChord("Ctrl+S")).toBe(true);
    expect(isDispatchableChord("Escape")).toBe(true);
    expect(isDispatchableChord("F5")).toBe(true);
    expect(isDispatchableChord("A")).toBe(false); // bare typing never triggers commands
  });

  it("applies overrides and drops unassigned commands", () => {
    const eff = effectiveKeybindings({ save: "Ctrl+K", cancel: "" });
    expect(eff.save).toBe("Ctrl+K");
    expect(eff.cancel).toBeUndefined();
    expect(eff.next).toBe(DEFAULT_KEYBINDINGS.next);
  });

  it("inverts to chord -> commandId", () => {
    expect(invertKeybindings({ save: "Ctrl+S" })["Ctrl+S"]).toBe("save");
  });

  it("formats chords for display", () => {
    expect(formatChord("Alt+ArrowDown")).toBe("Alt+↓");
    expect(formatChord("Ctrl+Shift+P")).toBe("Ctrl+Shift+P");
  });
});

describe("preferences merge", () => {
  it("returns defaults for empty stored prefs", () => {
    expect(mergePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("deep-merges customTheme and keybindings, keeping new tokens", () => {
    const merged = mergePreferences({
      theme: "custom",
      customTheme: { accent: "#123456" } as never,
      keybindings: { save: "Ctrl+K" },
    });
    expect(merged.theme).toBe("custom");
    expect(merged.customTheme.accent).toBe("#123456");
    // A token not present in the stored file falls back to the default.
    expect(merged.customTheme.bg).toBe(DEFAULT_PREFERENCES.customTheme.bg);
    expect(merged.keybindings.save).toBe("Ctrl+K");
  });
});

describe("i18n locales", () => {
  function flatten(obj: unknown, prefix = ""): string[] {
    if (obj === null || typeof obj !== "object") return [prefix];
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      flatten(v, prefix ? `${prefix}.${k}` : k),
    );
  }

  it("English and Português share the exact same keys", () => {
    const enKeys = flatten(en).sort();
    const ptKeys = flatten(ptBR).sort();
    expect(ptKeys).toEqual(enKeys);
  });
});
