import { useTranslation } from "react-i18next";
import { useSession } from "../../stores/session";

const STATUS_ICON: Record<string, string> = {
  unresolved: "●",
  partial: "◐",
  resolved: "✓",
  reviewed: "✔",
};

/** Sidebar with every conflict group, its classification and status (RF-008). */
export function ConflictList() {
  const { t } = useTranslation();
  const groups = useSession((s) => s.groups);
  const activeIndex = useSession((s) => s.activeIndex);
  const setActiveIndex = useSession((s) => s.setActiveIndex);

  return (
    <aside className="conflict-list" aria-label={t("conflictList.aria")}>
      <header className="panel-header">
        <span className="panel-title">{t("conflictList.title")}</span>
        <span className="panel-path">{groups.length}</span>
      </header>
      <ul>
        {groups.map((group, i) => (
          <li key={group.id}>
            <button
              className={`conflict-item ${i === activeIndex ? "active" : ""} status-${group.status}`}
              onClick={() => setActiveIndex(i)}
              aria-current={i === activeIndex}
            >
              <span className={`status-dot status-${group.status}`} aria-hidden>
                {STATUS_ICON[group.status] ?? "●"}
              </span>
              <span className="conflict-lines">
                L{group.baseRange.start + 1}
                {group.baseRange.end > group.baseRange.start + 1 ? `–${group.baseRange.end}` : ""}
              </span>
              <span className={`badge badge-${group.classification}`}>
                {t(`classification.${group.classification}`)}
              </span>
            </button>
          </li>
        ))}
        {groups.length === 0 && <li className="conflict-empty">{t("conflictList.empty")}</li>}
      </ul>
    </aside>
  );
}
