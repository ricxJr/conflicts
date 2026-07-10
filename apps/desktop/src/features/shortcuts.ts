import { useEffect } from "react";
import { useSession } from "../stores/session";
import {
  chordFromEvent,
  effectiveKeybindings,
  invertKeybindings,
  isDispatchableChord,
} from "./keybindings";
import { runCommand } from "./commands";

/** Global keyboard shortcuts (RF-021), driven by the configurable keybindings. */
export function useShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = useSession.getState();

      // Escape closes overlays first. When nothing is open it falls through to
      // whatever command is bound to Escape (cancel, by default). Monaco stops
      // propagation when it consumes Escape (find widget, suggestions), so this
      // handler never sees those cases.
      if (e.key === "Escape") {
        if (s.settingsOpen) {
          s.setSettingsOpen(false);
          return;
        }
        if (s.paletteOpen) {
          s.setPaletteOpen(false);
          return;
        }
        if (s.dialog) {
          s.setDialog(null);
          return;
        }
      }

      // While Settings is open, suppress global shortcuts so shortcut capture
      // and form fields aren't hijacked (capture stops propagation itself).
      if (s.settingsOpen) return;

      const chord = chordFromEvent(e);
      if (!isDispatchableChord(chord)) return;

      const commandId = invertKeybindings(effectiveKeybindings(s.prefs.keybindings))[chord];
      if (!commandId) return;

      e.preventDefault();
      runCommand(commandId);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
