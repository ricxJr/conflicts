import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const GAP = 4;
const MIN_MENU_HEIGHT = 120;
const MAX_MENU_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;

/**
 * Position for a menu portaled to document.body. Computed from the anchor's
 * viewport rect so it's immune to clipping by scrolling/overflow-hidden
 * ancestors (e.g. the settings panel's scroll body, or html/body's
 * overflow: hidden), and flips above the anchor when there isn't enough
 * room below.
 */
export function useFloatingMenuStyle(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - GAP - VIEWPORT_MARGIN;
      const spaceAbove = r.top - GAP - VIEWPORT_MARGIN;
      const openUp = spaceBelow < MIN_MENU_HEIGHT && spaceAbove > spaceBelow;
      const maxHeight = Math.max(80, Math.min(MAX_MENU_HEIGHT, openUp ? spaceAbove : spaceBelow));

      // The menu is at least as wide as its trigger but grows to fit longer
      // option labels (e.g. a narrow "Theme" trigger with "High contrast"
      // inside). Anchor it to whichever edge leaves the most room so the
      // extra width never spills off-screen.
      const vertical = openUp
        ? { bottom: window.innerHeight - r.top + GAP }
        : { top: r.bottom + GAP };
      const alignRight = r.left + r.width / 2 > window.innerWidth / 2;
      const horizontal = alignRight
        ? { right: window.innerWidth - r.right, maxWidth: r.right - VIEWPORT_MARGIN }
        : { left: r.left, maxWidth: window.innerWidth - r.left - VIEWPORT_MARGIN };

      setStyle({ position: "fixed", minWidth: r.width, maxHeight, ...vertical, ...horizontal });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  return style;
}
