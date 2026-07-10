import { useSession } from "../stores/session";

export interface Command {
  id: string;
  title: string;
  shortcut?: string;
  run(): void;
}

/** Command registry backing the Command Palette (RF-022). */
export function getCommands(): Command[] {
  const s = useSession.getState();
  const group = s.groups[s.activeIndex];

  return [
    { id: "next", title: "Go to next conflict", shortcut: "Alt+Down", run: () => s.nextConflict() },
    {
      id: "prev",
      title: "Go to previous conflict",
      shortcut: "Alt+Up",
      run: () => s.prevConflict(),
    },
    { id: "first", title: "Go to first conflict", run: () => s.setActiveIndex(0) },
    { id: "last", title: "Go to last conflict", run: () => s.setActiveIndex(s.groups.length - 1) },
    {
      id: "accept-current",
      title: "Accept Current",
      shortcut: "Alt+1",
      run: () => group && s.applyStrategy(group.id, "current"),
    },
    {
      id: "accept-incoming",
      title: "Accept Incoming",
      shortcut: "Alt+2",
      run: () => group && s.applyStrategy(group.id, "incoming"),
    },
    {
      id: "accept-both",
      title: "Accept Both (Current first)",
      shortcut: "Alt+3",
      run: () => group && s.applyStrategy(group.id, "both-current-first"),
    },
    {
      id: "accept-both-incoming",
      title: "Accept Both (Incoming first)",
      run: () => group && s.applyStrategy(group.id, "both-incoming-first"),
    },
    {
      id: "accept-base",
      title: "Accept Base",
      run: () => group && s.applyStrategy(group.id, "base"),
    },
    {
      id: "reject-both",
      title: "Reject Both",
      run: () => group && s.applyStrategy(group.id, "none"),
    },
    { id: "reset", title: "Reset conflict", run: () => group && s.resetGroup(group.id) },
    {
      id: "mark-reviewed",
      title: "Mark conflict as reviewed",
      run: () => group && s.markReviewed(group.id),
    },
    {
      id: "toggle-base",
      title: "Toggle base panel",
      run: () => s.setPrefs({ showBasePanel: !s.prefs.showBasePanel }),
    },
    {
      id: "toggle-list",
      title: "Toggle conflict list",
      run: () => s.setPrefs({ showConflictList: !s.prefs.showConflictList }),
    },
    {
      id: "toggle-changes-only",
      title: "Toggle changes-only view",
      run: () => s.setPrefs({ hideUnchangedRegions: !s.prefs.hideUnchangedRegions }),
    },
    {
      id: "toggle-whitespace",
      title: "Toggle ignore whitespace",
      run: () => s.setPrefs({ ignoreWhitespace: !s.prefs.ignoreWhitespace }),
    },
    { id: "theme-dark", title: "Theme: Dark", run: () => s.setPrefs({ theme: "dark" }) },
    { id: "theme-light", title: "Theme: Light", run: () => s.setPrefs({ theme: "light" }) },
    { id: "theme-system", title: "Theme: System", run: () => s.setPrefs({ theme: "system" }) },
    {
      id: "theme-hc",
      title: "Theme: High Contrast",
      run: () => s.setPrefs({ theme: "high-contrast" }),
    },
    { id: "save", title: "Save result", shortcut: "Ctrl+S", run: () => void s.save(false) },
    { id: "save-close", title: "Save result and close", run: () => void s.save(true) },
    {
      id: "cancel",
      title: "Cancel and close (keep conflict pending)",
      shortcut: "Esc",
      run: () => s.cancel(),
    },
  ];
}
