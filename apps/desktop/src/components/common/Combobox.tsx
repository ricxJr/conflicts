import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFloatingMenuStyle } from "./floatingMenu";

interface ComboboxProps {
  id?: string;
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}

/**
 * Free-text input with a filtered, theme-styled suggestion list. Replaces
 * <input list="datalist">, whose native suggestion popup can't be restyled
 * and ends up looking out of place next to the app's own theme.
 */
export function Combobox({ id, value, options, placeholder, onChange }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuStyle = useFloatingMenuStyle(open, rootRef);

  const query = value.trim().toLowerCase();
  const filtered = query ? options.filter((o) => o.toLowerCase().includes(query)) : options;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const commit = (index: number) => {
    const opt = filtered[index];
    if (!opt) return;
    onChange(opt);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      if (open && highlight >= 0) {
        e.preventDefault();
        e.stopPropagation();
        commit(highlight);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="combobox" ref={rootRef}>
      <input
        id={id}
        type="text"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open &&
        filtered.length > 0 &&
        menuStyle &&
        createPortal(
          <ul className="select-menu combobox-menu" role="listbox" ref={menuRef} style={menuStyle}>
            {filtered.map((opt, i) => (
              <li key={opt} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={opt === value}
                  className={i === highlight ? "highlighted" : ""}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(i)}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
