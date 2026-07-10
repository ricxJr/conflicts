import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";

const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const COMPACT_WIDTH = 58;

const STATUS_ICON: Record<string, string> = {
  unresolved: "●",
  partial: "◐",
  resolved: "✓",
  reviewed: "✔",
};

/** Resizable and collapsible sidebar with every conflict group (RF-008). */
export function ConflictList() {
  const { t } = useTranslation();
  const groups = useSession((s) => s.groups);
  const activeIndex = useSession((s) => s.activeIndex);
  const setActiveIndex = useSession((s) => s.setActiveIndex);
  const width = useSession((s) => s.prefs.conflictListWidth);
  const collapsed = useSession((s) => s.prefs.conflictListCollapsed);
  const setPrefs = useSession((s) => s.setPrefs);
  const [localWidth, setLocalWidth] = useState(width);
  const [dragging, setDragging] = useState(false);

  useEffect(() => setLocalWidth(width), [width]);

  const resizeTo = useCallback((next: number) => {
    setLocalWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: MouseEvent) => resizeTo(event.clientX);
    const onUp = () => {
      setDragging(false);
      setLocalWidth((current) => {
        setPrefs({ conflictListWidth: current });
        return current;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, resizeTo, setPrefs]);

  const onResizeKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = Math.min(
      MAX_WIDTH,
      Math.max(MIN_WIDTH, localWidth + (event.key === "ArrowRight" ? 16 : -16)),
    );
    resizeTo(next);
    setPrefs({ conflictListWidth: next });
  };

  return (
    <aside
      className={`conflict-list ${collapsed ? "collapsed" : ""} ${dragging ? "resizing" : ""}`}
      aria-label={t("conflictList.aria")}
      style={{ width: collapsed ? COMPACT_WIDTH : localWidth }}
    >
      <header className="panel-header">
        {!collapsed && <span className="panel-title">{t("conflictList.title")}</span>}
        {!collapsed && <span className="panel-path">{groups.length}</span>}
        <button
          className="conflict-list-toggle"
          onClick={() => setPrefs({ conflictListCollapsed: !collapsed })}
          title={t(collapsed ? "conflictList.expand" : "conflictList.collapse")}
          aria-label={t(collapsed ? "conflictList.expand" : "conflictList.collapse")}
          aria-expanded={!collapsed}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </header>
      <ul>
        {groups.map((group, i) => (
          <li key={group.id}>
            <button
              className={`conflict-item ${i === activeIndex ? "active" : ""} status-${group.status}`}
              onClick={() => setActiveIndex(i)}
              aria-current={i === activeIndex}
              title={
                collapsed
                  ? `L${group.baseRange.start + 1} — ${t(`classification.${group.classification}`)}`
                  : undefined
              }
            >
              <span className={`status-dot status-${group.status}`} aria-hidden>
                {STATUS_ICON[group.status] ?? "●"}
              </span>
              <span className="conflict-lines">
                L{group.baseRange.start + 1}
                {!collapsed && group.baseRange.end > group.baseRange.start + 1
                  ? `–${group.baseRange.end}`
                  : ""}
              </span>
              {!collapsed && (
                <span className={`badge badge-${group.classification}`}>
                  {t(`classification.${group.classification}`)}
                </span>
              )}
            </button>
          </li>
        ))}
        {groups.length === 0 && <li className="conflict-empty">{t("conflictList.empty")}</li>}
      </ul>
      {!collapsed && (
        <div
          className="conflict-list-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t("conflictList.resize")}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={Math.round(localWidth)}
          tabIndex={0}
          onMouseDown={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onKeyDown={onResizeKeyDown}
        />
      )}
    </aside>
  );
}
