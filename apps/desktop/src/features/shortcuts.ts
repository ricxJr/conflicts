import { useEffect } from "react";
import { useSession } from "../stores/session";

/** Global keyboard shortcuts (RF-021). */
export function useShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = useSession.getState();
      const group = s.groups[s.activeIndex];
      const key = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "p") {
        e.preventDefault();
        s.setPaletteOpen(!s.paletteOpen);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === "s") {
        e.preventDefault();
        void s.save(false);
        return;
      }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        s.nextConflict();
        return;
      }
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        s.prevConflict();
        return;
      }
      if (e.altKey && key === "1" && group) {
        e.preventDefault();
        s.applyStrategy(group.id, "current");
        return;
      }
      if (e.altKey && key === "2" && group) {
        e.preventDefault();
        s.applyStrategy(group.id, "incoming");
        return;
      }
      if (e.altKey && key === "3" && group) {
        e.preventDefault();
        s.applyStrategy(group.id, "both-current-first");
        return;
      }
      if (e.key === "Escape") {
        if (s.paletteOpen) {
          s.setPaletteOpen(false);
          return;
        }
        if (s.dialog) {
          s.setDialog(null);
          return;
        }
        // Only treat Esc as cancel when the editors are not consuming it
        // (find widget, suggestions). Monaco stops propagation in that case.
        s.cancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
