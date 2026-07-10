import type { TFunction } from "i18next";
import { useSession } from "../stores/session";
import { effectiveKeybindings, formatChord } from "./keybindings";

export interface Command {
  id: string;
  title: string;
  shortcut?: string;
  run(): void;
}

/** Command id + translation key, in Command Palette display order. */
export const COMMAND_META: { id: string; titleKey: string }[] = [
  { id: "next", titleKey: "command.next" },
  { id: "prev", titleKey: "command.prev" },
  { id: "first", titleKey: "command.first" },
  { id: "last", titleKey: "command.last" },
  { id: "accept-current", titleKey: "command.accept-current" },
  { id: "accept-incoming", titleKey: "command.accept-incoming" },
  { id: "accept-both", titleKey: "command.accept-both" },
  { id: "accept-both-incoming", titleKey: "command.accept-both-incoming" },
  { id: "accept-base", titleKey: "command.accept-base" },
  { id: "reject-both", titleKey: "command.reject-both" },
  { id: "reset", titleKey: "command.reset" },
  { id: "mark-reviewed", titleKey: "command.mark-reviewed" },
  { id: "toggle-base", titleKey: "command.toggle-base" },
  { id: "toggle-list", titleKey: "command.toggle-list" },
  { id: "toggle-changes-only", titleKey: "command.toggle-changes-only" },
  { id: "toggle-whitespace", titleKey: "command.toggle-whitespace" },
  { id: "theme-dark", titleKey: "command.theme-dark" },
  { id: "theme-light", titleKey: "command.theme-light" },
  { id: "theme-system", titleKey: "command.theme-system" },
  { id: "theme-hc", titleKey: "command.theme-hc" },
  { id: "palette", titleKey: "command.palette" },
  { id: "open-settings", titleKey: "command.open-settings" },
  { id: "save", titleKey: "command.save" },
  { id: "save-close", titleKey: "command.save-close" },
  { id: "cancel", titleKey: "command.cancel" },
];

/** id -> action, resolved against the current store state on each call. */
export function getCommandActions(): Record<string, () => void> {
  const s = useSession.getState();
  const group = s.groups[s.activeIndex];

  return {
    next: () => s.nextConflict(),
    prev: () => s.prevConflict(),
    first: () => s.setActiveIndex(0),
    last: () => s.setActiveIndex(s.groups.length - 1),
    "accept-current": () => group && s.applyStrategy(group.id, "current"),
    "accept-incoming": () => group && s.applyStrategy(group.id, "incoming"),
    "accept-both": () => group && s.applyStrategy(group.id, "both-current-first"),
    "accept-both-incoming": () => group && s.applyStrategy(group.id, "both-incoming-first"),
    "accept-base": () => group && s.applyStrategy(group.id, "base"),
    "reject-both": () => group && s.applyStrategy(group.id, "none"),
    reset: () => group && s.resetGroup(group.id),
    "mark-reviewed": () => group && s.markReviewed(group.id),
    "toggle-base": () => s.setPrefs({ showBasePanel: !s.prefs.showBasePanel }),
    "toggle-list": () => s.setPrefs({ showConflictList: !s.prefs.showConflictList }),
    "toggle-changes-only": () =>
      s.setPrefs({ hideUnchangedRegions: !s.prefs.hideUnchangedRegions }),
    "toggle-whitespace": () => s.setPrefs({ ignoreWhitespace: !s.prefs.ignoreWhitespace }),
    "theme-dark": () => s.setPrefs({ theme: "dark" }),
    "theme-light": () => s.setPrefs({ theme: "light" }),
    "theme-system": () => s.setPrefs({ theme: "system" }),
    "theme-hc": () => s.setPrefs({ theme: "high-contrast" }),
    palette: () => s.setPaletteOpen(!s.paletteOpen),
    "open-settings": () => s.setSettingsOpen(true),
    save: () => void s.save(false),
    "save-close": () => void s.save(true),
    cancel: () => s.cancel(),
  };
}

/** Command registry backing the Command Palette (RF-022), localized. */
export function getCommands(t: TFunction): Command[] {
  const actions = getCommandActions();
  const kb = effectiveKeybindings(useSession.getState().prefs.keybindings);
  return COMMAND_META.map((m) => ({
    id: m.id,
    title: t(m.titleKey),
    shortcut: kb[m.id] ? formatChord(kb[m.id]) : undefined,
    run: actions[m.id] ?? (() => {}),
  }));
}

/** Dispatch a command by id (used by the global shortcut handler). */
export function runCommand(id: string): void {
  getCommandActions()[id]?.();
}
