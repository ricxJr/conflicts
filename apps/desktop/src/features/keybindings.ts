/**
 * Keyboard shortcut model (RF-021, now user-configurable).
 *
 * A "chord" is a canonical string like `Ctrl+Shift+P`, `Alt+ArrowDown` or
 * `Escape`. `chordFromEvent` produces the same canonical form the defaults and
 * the settings editor store, so matching is a plain string comparison.
 */

/** Default chord per command id. Only commands with a built-in shortcut appear. */
export const DEFAULT_KEYBINDINGS: Record<string, string> = {
  save: "Ctrl+S",
  next: "Alt+ArrowDown",
  prev: "Alt+ArrowUp",
  "accept-current": "Alt+1",
  "accept-incoming": "Alt+2",
  "accept-both": "Alt+3",
  palette: "Ctrl+Shift+P",
  "open-settings": "Ctrl+,",
  cancel: "Escape",
};

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);
const SPECIAL_STANDALONE = /^(Escape|F\d{1,2})$/;

function normalizeKey(key: string): string {
  if (MODIFIER_KEYS.has(key)) return "";
  if (key === " " || key === "Spacebar") return "Space";
  // Single letters are stored uppercase so `p` and `Shift+P` share a base key.
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** Canonical chord for a keyboard event, or "" if only modifiers are held. */
export function chordFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  const key = normalizeKey(e.key);
  if (!key) return "";
  parts.push(key);
  return parts.join("+");
}

/**
 * Whether a chord may trigger a command. Bare keys (plain typing) are ignored
 * so remapping never eats normal input; only chords with a modifier or a safe
 * standalone key (Escape, F1–F12) dispatch.
 */
export function isDispatchableChord(chord: string): boolean {
  return chord.includes("+") || SPECIAL_STANDALONE.test(chord);
}

/** Defaults with user overrides applied; empty overrides unassign a command. */
export function effectiveKeybindings(
  overrides: Record<string, string> = {},
): Record<string, string> {
  const merged: Record<string, string> = { ...DEFAULT_KEYBINDINGS, ...overrides };
  for (const id of Object.keys(merged)) {
    if (!merged[id]) delete merged[id];
  }
  return merged;
}

/** chord -> commandId lookup for the global handler. */
export function invertKeybindings(bindings: Record<string, string>): Record<string, string> {
  const inverted: Record<string, string> = {};
  for (const [id, chord] of Object.entries(bindings)) {
    if (chord) inverted[chord] = id;
  }
  return inverted;
}

const SYMBOLS: Record<string, string> = {
  ArrowDown: "↓",
  ArrowUp: "↑",
  ArrowLeft: "←",
  ArrowRight: "→",
  Meta: "⌘",
};

/** Human-friendly rendering of a chord for tooltips and the palette. */
export function formatChord(chord: string): string {
  if (!chord) return "";
  return chord
    .split("+")
    .map((part) => SYMBOLS[part] ?? part)
    .join("+");
}
