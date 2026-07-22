import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFloatingMenuStyle } from "./floatingMenu";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Custom-styled replacement for <select>: the popup list of a native select
 * is drawn by the OS/WebView and ignores the app's theme (light/dark/custom),
 * so we render our own listbox instead to keep it consistent.
 */
export function Select({ id, value, options, onChange, ariaLabel, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuStyle = useFloatingMenuStyle(open, triggerRef);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    setHighlight(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
    // Only re-run when the popup opens/closes — re-syncing highlight on every
    // value/options change would fight the arrow-key navigation below.
  }, [open]);

  const commit = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    // Consume the key so it doesn't also reach the global shortcut handler
    // (e.g. Escape closing Settings, or Enter/arrows dispatching a command).
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        e.stopPropagation();
        commit(highlight);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        break;
    }
  };

  return (
    <div className={`select ${className ?? ""}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{selected?.label ?? ""}</span>
        <span className="select-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open &&
        menuStyle &&
        createPortal(
          <ul className="select-menu" role="listbox" ref={menuRef} style={menuStyle}>
            {options.map((opt, i) => (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={`${i === highlight ? "highlighted" : ""} ${opt.value === value ? "selected" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => commit(i)}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
