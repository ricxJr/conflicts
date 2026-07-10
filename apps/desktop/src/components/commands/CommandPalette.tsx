import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";
import { getCommands } from "../../features/commands";

export function CommandPalette() {
  const { t, i18n } = useTranslation();
  const open = useSession((s) => s.paletteOpen);
  const setOpen = useSession((s) => s.setPaletteOpen);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => (open ? getCommands(t) : []), [open, t, i18n.language]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.title.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const run = (index: number) => {
    const cmd = filtered[index];
    setOpen(false);
    cmd?.run();
  };

  return (
    <div className="overlay" onMouseDown={() => setOpen(false)}>
      <div
        className="palette"
        role="dialog"
        aria-label={t("palette.aria")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          placeholder={t("palette.placeholder")}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(selected);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
        />
        <ul>
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                className={i === selected ? "selected" : ""}
                onMouseEnter={() => setSelected(i)}
                onClick={() => run(i)}
              >
                <span>{cmd.title}</span>
                {cmd.shortcut && <kbd>{cmd.shortcut}</kbd>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="palette-empty">{t("palette.empty")}</li>}
        </ul>
      </div>
    </div>
  );
}
